import os
from typing import Dict, Type
from .extractors.base import BaseExtractor
from .extractors.google_play import GooglePlayExtractor
from .extractors.instagram import InstagramExtractor
from .extractors.youtube import YouTubeExtractor

class VerificationEngine:
    """
    Production-Grade AI Verification Engine.
    Dynamically routes screenshot verification to the appropriate platform extractor based on task type.
    """

    def __init__(self):
        self._registry: Dict[str, BaseExtractor] = {}
        # Register default extractors
        self.register_extractor("google_play_review", GooglePlayExtractor())
        self.register_extractor("google_play", GooglePlayExtractor())
        self.register_extractor("playstore", GooglePlayExtractor())
        self.register_extractor("app_review", GooglePlayExtractor())
        self.register_extractor("instagram", InstagramExtractor())
        self.register_extractor("youtube", YouTubeExtractor())

    def register_extractor(self, task_type_key: str, extractor: BaseExtractor):
        """Registers a platform-specific extractor for a task type key."""
        self._registry[task_type_key.lower().strip()] = extractor

    def get_extractor(self, task_type: str) -> BaseExtractor:
        """Retrieves matching extractor for task_type or defaults to GooglePlayExtractor."""
        if not task_type:
            return self._registry.get("google_play_review")

        key = str(task_type).lower().strip()
        if key in self._registry:
            return self._registry[key]

        # Partial matching for common keys
        if "play" in key or "store" in key or "review" in key or "app" in key:
            return self._registry.get("google_play_review")
        elif "insta" in key or "ig" in key:
            return self._registry.get("instagram")
        elif "you" in key or "yt" in key or "tube" in key:
            return self._registry.get("youtube")

        # Default fallback extractor
        return self._registry.get("google_play_review")

    def verify_screenshot(
        self,
        image_path: str,
        assigned_comment: str = "",
        task_type: str = "google_play_review",
        reviewer_name: str = ""
    ) -> dict:
        """
        Main entry point for verifying screenshot.
        Determines task type -> Loads platform extractor -> Runs verification pipeline.
        """
        extractor = self.get_extractor(task_type)
        return extractor.verify(
            image_path=image_path,
            assigned_comment=assigned_comment,
            expected_reviewer_name=reviewer_name
        )


# Global Engine Singleton Instance
_ENGINE_INSTANCE = None

def get_engine() -> VerificationEngine:
    global _ENGINE_INSTANCE
    if _ENGINE_INSTANCE is None:
        _ENGINE_INSTANCE = VerificationEngine()
    return _ENGINE_INSTANCE

def verify_screenshot(
    image_path: str,
    assigned_comment: str = "",
    task_type: str = "google_play_review",
    reviewer_name: str = ""
) -> dict:
    """
    Convenience function for verifying a screenshot using global VerificationEngine instance.
    """
    engine = get_engine()
    return engine.verify_screenshot(
        image_path=image_path,
        assigned_comment=assigned_comment,
        task_type=task_type,
        reviewer_name=reviewer_name
    )
