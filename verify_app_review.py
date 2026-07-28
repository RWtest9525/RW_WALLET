import sys
import json
import os

# Ensure verification_engine can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from verification_engine import verify_screenshot

def verify_app_review(image_path: str, assigned_comment: str = "", task_type: str = "google_play_review", reviewer_name: str = "") -> dict:
    """
    Production-Grade AI Verification Entry Point.
    Uses OpenCV for dynamic review card cropping, PaddleOCR for card text extraction,
    RapidFuzz for fuzzy comment comparison, and Vision AI fallback.
    """
    try:
        res = verify_screenshot(
            image_path=image_path,
            assigned_comment=assigned_comment,
            task_type=task_type,
            reviewer_name=reviewer_name
        )

        status = res.get("status", "FAIL")
        is_verified = (status == "PASS")

        return {
            "verified": is_verified,
            "status": status,
            "score": res.get("score", 0.0),
            "reviewer_name": res.get("reviewer_name", ""),
            "review_comment": res.get("review_comment", ""),
            "truncated": res.get("details", {}).get("truncated", False),
            "target_segment": assigned_comment,
            "extracted_text": res.get("review_comment", ""),
            "details": res.get("details", {})
        }

    except Exception as e:
        return {
            "verified": False,
            "status": "FAIL",
            "score": 0.0,
            "reviewer_name": "",
            "review_comment": "",
            "truncated": False,
            "target_segment": assigned_comment,
            "extracted_text": "",
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        error_res = {
            "verified": False,
            "status": "FAIL",
            "error": "Usage: python verify_app_review.py <image_path> [assigned_comment] [task_type] [reviewer_name]",
            "score": 0.0
        }
        print(json.dumps(error_res, ensure_ascii=False))
        sys.exit(1)

    input_image_path = sys.argv[1]
    input_assigned_comment = sys.argv[2] if len(sys.argv) > 2 else ""
    input_task_type = sys.argv[3] if len(sys.argv) > 3 else "google_play_review"
    input_reviewer_name = sys.argv[4] if len(sys.argv) > 4 else ""

    result = verify_app_review(
        image_path=input_image_path,
        assigned_comment=input_assigned_comment,
        task_type=input_task_type,
        reviewer_name=input_reviewer_name
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
