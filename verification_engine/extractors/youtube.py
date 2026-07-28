import cv2
import numpy as np
from .base import BaseExtractor

class YouTubeExtractor(BaseExtractor):
    """
    Platform Extractor for YouTube Screenshots (Subscribe, Like, Comment tasks).
    Extensible module for future YouTube task verification.
    """

    def __init__(self):
        super().__init__(name="YouTubeExtractor")

    def extract_review_card(self, img: np.ndarray) -> np.ndarray:
        if img is None or img.size == 0:
            return img
        h, w, _ = img.shape
        return img[int(h * 0.06):int(h * 0.94), 0:w]

    def process_ocr(self, cropped_img: np.ndarray) -> dict:
        from .google_play import get_paddle_ocr
        ocr = get_paddle_ocr()
        ocr_result = ocr.ocr(cropped_img, cls=False)

        lines = []
        if ocr_result and ocr_result[0]:
            for res in ocr_result[0]:
                text = res[1][0].strip()
                if text:
                    lines.append(text)

        reviewer_name = lines[0] if lines else ""
        review_comment = " ".join(lines[1:]).strip() if len(lines) > 1 else " ".join(lines)

        return {
            "reviewer_name": reviewer_name,
            "review_comment": review_comment,
            "all_extracted_lines": lines
        }
