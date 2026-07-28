import re
import cv2
import numpy as np
from ..utils import pandas_mock
from .base import BaseExtractor

# Lazy singleton OCR instance
_OCR_ENGINE_TUPLE = None

def get_ocr_engine():
    global _OCR_ENGINE_TUPLE
    if _OCR_ENGINE_TUPLE is not None:
        return _OCR_ENGINE_TUPLE

    # Try EasyOCR first as fast primary CPU singleton engine
    try:
        import easyocr
        easy_instance = easyocr.Reader(['en'], gpu=False)
        _OCR_ENGINE_TUPLE = ("easyocr", easy_instance)
        print("[GooglePlayExtractor] EasyOCR initialized as primary singleton engine.")
        return _OCR_ENGINE_TUPLE
    except Exception as easy_err:
        print(f"[GooglePlayExtractor] EasyOCR init error: {easy_err}")

    # Fallback to PaddleOCR if available
    try:
        from paddleocr import PaddleOCR
        paddle_instance = PaddleOCR(use_angle_cls=False, lang='en')
        _OCR_ENGINE_TUPLE = ("paddle", paddle_instance)
        print("[GooglePlayExtractor] PaddleOCR initialized as fallback engine.")
        return _OCR_ENGINE_TUPLE
    except Exception as paddle_err:
        print(f"[GooglePlayExtractor] PaddleOCR init error: {paddle_err}")

    return (None, None)


# List of exact/partial UI noise strings to filter out
PLAY_STORE_UI_NOISE = [
    "google play", "app name", "developer", "open", "install", "update", "ask play",
    "games", "apps", "search", "books", "you", "edit your review", "about this app",
    "app support", "ratings and reviews", "status bar", "navigation bar", "battery",
    "time", "notification icons", "see all reviews", "post", "cancel", "rate this app",
    "tell us what you think", "write a review", "safety", "data privacy", "security",
    "verified", "reviews", "stars", "star", "edited", "ago", "personal info",
    "no reviews", "volte", "kb/s", "mb/s", "gb/s"
]

class GooglePlayExtractor(BaseExtractor):
    """
    Platform Extractor for Google Play Store Review Screenshots.
    Dynamically crops the review card using OpenCV and runs OCR to extract
    Reviewer Name and Review Comment across all Android devices, dark/light modes & popup layouts.
    """

    def __init__(self):
        super().__init__(name="GooglePlayExtractor")

    def extract_review_card(self, img: np.ndarray) -> np.ndarray:
        """
        Detects and crops ONLY the 'Your review' section or review card using OpenCV.
        Supports Light mode, Dark mode, popup dialogs, bottom sheets, tablet layout, and OEM UIs.
        Does NOT use fixed hardcoded coordinates.
        """
        if img is None or img.size == 0:
            return img

        h, w, _ = img.shape

        # Step 1: Crop status bar (top 6%) and navigation bar (bottom 6%)
        y_top_margin = int(h * 0.06)
        y_bottom_margin = int(h * 0.94)
        safe_img = img[y_top_margin:y_bottom_margin, 0:w]

        # Step 2: Use OpenCV contour / bounding box detection to find Popup Dialog or Card Container
        gray = cv2.cvtColor(safe_img, cv2.COLOR_BGR2GRAY)
        
        # Check if Dark Mode or Light Mode
        mean_val = np.mean(gray)
        is_dark_mode = mean_val < 120

        # Thresholding for card boundary detection
        if is_dark_mode:
            _, thresh = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY)
        else:
            _, thresh = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        card_bbox = None
        for cnt in contours:
            x, y, cw, ch = cv2.boundingRect(cnt)
            # A popup review dialog or review card usually spans >= 60% of width and 15-80% of height
            if cw >= int(w * 0.60) and ch >= int(h * 0.12) and ch <= int(h * 0.85):
                card_bbox = (x, y, cw, ch)
                break

        if card_bbox:
            x, y, cw, ch = card_bbox
            cropped_card = safe_img[y:y+ch, x:x+cw]
            if cropped_card.size > 0:
                return cropped_card

        # Fallback: Return safe image with status/nav bar cropped out
        return safe_img

    def process_ocr(self, cropped_img: np.ndarray) -> dict:
        """
        Runs OCR ONLY on the cropped review card image.
        Extracts ONLY Reviewer Name and Review Comment.
        """
        if cropped_img is None or cropped_img.size == 0:
            return {"reviewer_name": "", "review_comment": ""}

        engine_type, ocr_engine = get_ocr_engine()
        lines = []

        if engine_type == "easyocr" and ocr_engine is not None:
            try:
                results = ocr_engine.readtext(cropped_img, detail=0)
                lines = [str(r).strip() for r in results if str(r).strip()]
            except Exception as easy_run_err:
                print(f"[GooglePlayExtractor] EasyOCR run error: {easy_run_err}")

        if engine_type == "paddle" and ocr_engine is not None and not lines:
            try:
                ocr_result = ocr_engine.predict(cropped_img)
                if ocr_result:
                    for item in ocr_result:
                        if isinstance(item, dict) and "rec_text" in item:
                            text = item["rec_text"].strip()
                            if text:
                                lines.append(text)
                        elif hasattr(item, "json"):
                            res_json = item.json
                            if isinstance(res_json, dict) and "res" in res_json:
                                for r in res_json.get("res", []):
                                    text = r.get("text", "").strip() if isinstance(r, dict) else str(r).strip()
                                    if text:
                                        lines.append(text)
            except Exception as paddle_run_err:
                print(f"[GooglePlayExtractor] PaddleOCR predict error: {paddle_run_err}")

        # Filter out UI noise elements
        clean_lines = []
        for line in lines:
            lower = line.lower()
            if any(noise in lower for noise in PLAY_STORE_UI_NOISE):
                continue
            if re.match(r"^\d{1,2}:\d{2}", line) or re.match(r"^\d{1,3}%$", line) or re.match(r"^[★☆* \d./-]+$", line):
                continue
            clean_lines.append(line)

        if not clean_lines:
            return {"reviewer_name": "", "review_comment": ""}

        reviewer_name = clean_lines[0]
        comment_lines = clean_lines[1:] if len(clean_lines) > 1 else clean_lines
        review_comment = " ".join(comment_lines).strip()

        return {
            "reviewer_name": reviewer_name,
            "review_comment": review_comment,
            "all_extracted_lines": clean_lines
        }
