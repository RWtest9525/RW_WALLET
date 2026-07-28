import os
import cv2
import numpy as np
from abc import ABC, abstractmethod
from ..utils.matching import compare_review_comment, verify_reviewer_name
from ..utils.vision_ai import run_vision_ai_fallback

class BaseExtractor(ABC):
    """
    Abstract Base Extractor for Platform-Specific Screenshot Verification.
    Every platform (Google Play, Instagram, YouTube, etc.) inherits from this class.
    """

    def __init__(self, name: str = "BaseExtractor"):
        self.name = name

    @abstractmethod
    def extract_review_card(self, img: np.ndarray) -> np.ndarray:
        """
        Dynamically detects and crops ONLY the review card/region from the full screenshot using OpenCV.
        Do NOT use fixed hardcoded coordinates.
        """
        pass

    @abstractmethod
    def process_ocr(self, cropped_img: np.ndarray) -> dict:
        """
        Runs PaddleOCR ONLY on the cropped review card image.
        Extracts ONLY:
        - reviewer_name
        - review_comment
        Ignores platform UI noise elements.
        """
        pass

    def verify(self, image_path: str, assigned_comment: str, expected_reviewer_name: str = "") -> dict:
        """
        Executes end-to-end verification flow:
        Screenshot -> OpenCV Crop -> PaddleOCR -> RapidFuzz -> Fallback -> Output
        """
        if not os.path.exists(image_path):
            return {
                "status": "FAIL",
                "score": 0.0,
                "reviewer_name": "",
                "review_comment": "",
                "error": f"Image file not found: {image_path}"
            }

        # 1. Read image with OpenCV
        img = cv2.imread(image_path)
        if img is None:
            return {
                "status": "FAIL",
                "score": 0.0,
                "reviewer_name": "",
                "review_comment": "",
                "error": f"Failed to load image: {image_path}"
            }

        # 2. Dynamically crop ONLY the review card region using OpenCV
        cropped_img = self.extract_review_card(img)

        # 3. Run PaddleOCR ONLY on the cropped review card
        ocr_res = self.process_ocr(cropped_img)
        extracted_name = ocr_res.get("reviewer_name", "")
        extracted_comment = ocr_res.get("review_comment", "")

        # 4. RapidFuzz comment matching & scoring
        match_res = compare_review_comment(extracted_comment, assigned_comment)
        status = match_res["status"]
        score = match_res["score"]
        fallback_used = False

        # 5. Vision AI Fallback trigger for 90-94.99% score range
        if status == "VISION_AI_REQUIRED":
            fallback_res = run_vision_ai_fallback(image_path, assigned_comment, expected_reviewer_name)
            status = fallback_res.get("status", "PASS")
            score = fallback_res.get("score", score)
            fallback_used = True
            if fallback_res.get("reviewer_name"):
                extracted_name = fallback_res["reviewer_name"]
            if fallback_res.get("review_comment"):
                extracted_comment = fallback_res["review_comment"]

        # 6. Separate Reviewer Name Verification
        name_res = verify_reviewer_name(extracted_name, expected_reviewer_name)

        return {
            "status": status,
            "score": score,
            "reviewer_name": extracted_name,
            "review_comment": extracted_comment,
            "name_verification": name_res,
            "details": {
                "extractor": self.name,
                "truncated": match_res.get("truncated", False),
                "fallback_used": fallback_used,
                "normalized_comment": match_res.get("normalized_extracted", ""),
                "normalized_assigned": match_res.get("normalized_assigned", "")
            }
        }
