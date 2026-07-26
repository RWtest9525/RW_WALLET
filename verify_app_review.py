import sys
import json
import os
import cv2
import numpy as np
import easyocr
from rapidfuzz import fuzz

# Global EasyOCR Reader instance to avoid reloading models on every call when imported as module
_OCR_READER = None

def get_ocr_reader() -> easyocr.Reader:
    """Lazily initializes and returns the EasyOCR Reader instance."""
    global _OCR_READER
    if _OCR_READER is None:
        _OCR_READER = easyocr.Reader(['en', 'hi'], gpu=False)
    return _OCR_READER


def crop_and_optimize_image(image_path: str) -> tuple[np.ndarray, str]:
    """
    Loads an image, dynamically crops the region of interest between 'Your Review'
    and 'Edit your review' / 'Edit' anchor words, resizes width to 800px while
    maintaining aspect ratio, and applies 85% JPEG compression in memory.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not load image at path: {image_path}")

    h, w, _ = img.shape
    reader = get_ocr_reader()

    # Pass 1: Bounding-box detection for anchor words
    detection_results = reader.readtext(img)

    y_start = 0
    y_end = h

    for bbox, text, _ in detection_results:
        text_clean = text.strip().lower()

        # Identify top anchor ("Your Review")
        if "your review" in text_clean:
            y_start = max(y_start, int(max(pt[1] for pt in bbox)))

        # Identify bottom anchor ("Edit your review" or "Edit")
        elif "edit your review" in text_clean or text_clean == "edit" or text_clean.startswith("edit"):
            y_end = min(y_end, int(min(pt[1] for pt in bbox)))

    # Fallback to full height if anchor points are invalid or not found
    if y_end <= y_start or y_end == h and y_start == 0:
        cropped = img
    else:
        cropped = img[y_start:y_end, 0:w]

    # Resize width to 800px maintaining aspect ratio to minimize RAM consumption
    crop_h, crop_w, _ = cropped.shape
    if crop_w > 0 and crop_h > 0:
        target_w = 800
        target_h = max(1, int(crop_h * (target_w / float(crop_w))))
        resized = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_AREA)
    else:
        resized = cropped

    # In-memory JPEG compression at 85% quality to optimize memory footprint
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
    success, encoded_buf = cv2.imencode('.jpg', resized, encode_params)
    if success:
        optimized_img = cv2.imdecode(encoded_buf, cv2.IMREAD_COLOR)
    else:
        optimized_img = resized

    # Pass 2: Extract text strictly from optimized cropped image
    ocr_lines = reader.readtext(optimized_img, detail=0)
    scanned_text = " ".join(ocr_lines).strip()

    return optimized_img, scanned_text


def verify_app_review(image_path: str, assigned_comment: str) -> dict:
    """
    Verifies whether the assigned Google Play Store review comment exists in the screenshot.
    Handles truncated long comments (30-40+ words) gracefully by matching the first visible lines.
    """
    try:
        # Step 1: Crop ROI, resize to 800px width, compress JPEG 85%, & scan OCR text
        _, scanned_text = crop_and_optimize_image(image_path)

        # Step 2: Smart Comment Truncation Logic
        cleaned_comment = assigned_comment.strip()
        words = cleaned_comment.split()

        # If comment is long (> 60 chars or > 12 words), slice the first 60 chars (always visible before '...')
        is_long_comment = len(cleaned_comment) > 60 or len(words) > 12
        if is_long_comment:
            target_segment = cleaned_comment[:60].strip()
        else:
            target_segment = cleaned_comment

        # Step 3: RapidFuzz partial ratio comparison
        match_score = fuzz.partial_ratio(target_segment.lower(), scanned_text.lower())

        # Step 4: Verification flag check (>= 85% threshold)
        is_verified = bool(match_score >= 85.0)

        return {
            "verified": is_verified,
            "score": round(float(match_score), 2),
            "truncated": is_long_comment,
            "target_segment": target_segment,
            "extracted_text": scanned_text
        }

    except Exception as e:
        return {
            "verified": False,
            "error": str(e),
            "score": 0.0,
            "truncated": False,
            "target_segment": "",
            "extracted_text": ""
        }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        error_res = {
            "verified": False,
            "error": "Usage: python verify_app_review.py <image_path> <assigned_comment>",
            "score": 0.0
        }
        print(json.dumps(error_res, ensure_ascii=False))
        sys.exit(1)

    input_image_path = sys.argv[1]
    input_assigned_comment = sys.argv[2]

    result = verify_app_review(input_image_path, input_assigned_comment)
    print(json.dumps(result, ensure_ascii=False, indent=2))
