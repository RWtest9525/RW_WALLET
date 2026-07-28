import json
from rapidfuzz import fuzz
from .text_normalizer import normalize_for_matching, clean_reviewer_name

def parse_comment_candidates(assigned_input) -> list:
    """
    Parses assigned_input into a list of candidate comments.
    Supports JSON arrays, pipe-separated '|', newline-separated '\\n', or single string.
    """
    if not assigned_input:
        return []
    if isinstance(assigned_input, list):
        return [str(c).strip() for c in assigned_input if str(c).strip()]
    
    raw = str(assigned_input).strip()
    if not raw:
        return []

    # Check if JSON array string
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(c).strip() for c in parsed if str(c).strip()]
        except Exception:
            pass

    # Check if pipe-separated
    if "|||" in raw or " | " in raw or "|" in raw:
        sep = "|||" if "|||" in raw else (" | " if " | " in raw else "|")
        parts = [p.strip() for p in raw.split(sep) if p.strip()]
        if len(parts) > 1:
            return parts

    # Check if newline-separated
    if "\n" in raw:
        parts = [p.strip() for p in raw.split("\n") if p.strip()]
        if len(parts) > 1:
            return parts

    return [raw]

def compare_review_comment_single(extracted_comment: str, assigned_comment: str) -> dict:
    """
    Compares extracted review comment against a single assigned comment using RapidFuzz.
    Handles truncated comments ending with '...' without rejecting them.
    
    Similarity threshold rules:
    - 95%+ -> PASS
    - 90-94.99% -> VISION_AI_REQUIRED
    - Below 90% -> FAIL
    """
    if not assigned_comment or not assigned_comment.strip():
        return {
            "status": "PASS",
            "score": 100.0,
            "truncated": False,
            "normalized_extracted": normalize_for_matching(extracted_comment),
            "normalized_assigned": "",
            "matched_comment": ""
        }

    norm_extracted = normalize_for_matching(extracted_comment)
    norm_assigned = normalize_for_matching(assigned_comment)

    if not norm_extracted:
        return {
            "status": "FAIL",
            "score": 0.0,
            "truncated": False,
            "normalized_extracted": "",
            "normalized_assigned": norm_assigned,
            "matched_comment": assigned_comment
        }

    # Detect if extracted review ends with '...' or '…' or seems truncated
    raw_extracted_trim = extracted_comment.strip()
    is_truncated = (
        raw_extracted_trim.endswith("...") or
        raw_extracted_trim.endswith("…") or
        raw_extracted_trim.endswith("..")
    )

    # If truncated or long review, slice assigned comment to match visible prefix length
    target_text = norm_assigned
    if is_truncated and len(norm_extracted) > 0 and len(norm_assigned) > len(norm_extracted):
        target_text = norm_assigned[:len(norm_extracted) + 15].strip()

    # RapidFuzz similarity ratio computation (highest of partial_ratio and token_set_ratio)
    score_partial = fuzz.partial_ratio(target_text, norm_extracted)
    score_token = fuzz.token_set_ratio(target_text, norm_extracted)
    
    # Also test against full norm_assigned if prefix slicing was used
    score_full = fuzz.partial_ratio(norm_assigned, norm_extracted)
    
    final_score = round(float(max(score_partial, score_token, score_full)), 2)

    # Apply threshold rules
    if final_score >= 95.0:
        status = "PASS"
    elif final_score >= 90.0:
        status = "VISION_AI_REQUIRED"
    else:
        status = "FAIL"

    return {
        "status": status,
        "score": final_score,
        "truncated": is_truncated,
        "normalized_extracted": norm_extracted,
        "normalized_assigned": norm_assigned,
        "matched_comment": assigned_comment
    }

def compare_review_comment(extracted_comment: str, assigned_comment_input) -> dict:
    """
    Compares extracted review comment against assigned_comment_input (which can be a single comment or a pool of candidate comments).
    Automatically matches against the candidate with the highest similarity score.
    """
    candidates = parse_comment_candidates(assigned_comment_input)
    
    if not candidates:
        return compare_review_comment_single(extracted_comment, "")

    if len(candidates) == 1:
        return compare_review_comment_single(extracted_comment, candidates[0])

    # Evaluate against pool of candidate comments
    best_result = None
    best_score = -1.0

    for idx, candidate in enumerate(candidates, 1):
        res = compare_review_comment_single(extracted_comment, candidate)
        res["candidate_index"] = idx
        if res["score"] > best_score:
            best_score = res["score"]
            best_result = res

    if best_result:
        best_result["total_candidates_tested"] = len(candidates)
        return best_result

    return compare_review_comment_single(extracted_comment, candidates[0])

def verify_reviewer_name(extracted_name: str, expected_name: str) -> dict:
    """
    Verifies reviewer name separately ignoring case and extra whitespace.
    """
    if not expected_name or not expected_name.strip():
        return {"match": True, "score": 100.0, "extracted": extracted_name, "expected": ""}

    clean_ext = clean_reviewer_name(extracted_name)
    clean_exp = clean_reviewer_name(expected_name)

    if not clean_ext:
        return {"match": False, "score": 0.0, "extracted": "", "expected": clean_exp}

    if clean_ext == clean_exp or clean_exp in clean_ext or clean_ext in clean_exp:
        return {"match": True, "score": 100.0, "extracted": clean_ext, "expected": clean_exp}

    score = fuzz.ratio(clean_exp, clean_ext)
    is_match = score >= 75.0 or clean_exp in clean_ext

    return {
        "match": is_match,
        "score": round(float(score), 2),
        "extracted": clean_ext,
        "expected": clean_exp
    }
