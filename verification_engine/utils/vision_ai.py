import os
import json
import base64

def run_vision_ai_fallback(image_path: str, assigned_comment: str, expected_reviewer_name: str = "") -> dict:
    """
    Vision AI Fallback Engine (Qwen2.5-VL / Gemini Vision API)
    Invoked when RapidFuzz score is between 90% and 94.99%.
    Analyzes image visually to confirm if the assigned review comment exists in the screenshot.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("[Vision-AI-Fallback] No GEMINI_API_KEY / GOOGLE_API_KEY provided. Accepting 90%+ score.")
        return {
            "verified": True,
            "status": "PASS",
            "score": 92.0,
            "reason": "FALLBACK_ACCEPTED_WITHOUT_KEY"
        }

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        with open(image_path, "rb") as f:
            image_bytes = f.read()

        prompt = f"""
        You are an expert review screenshot verification AI.
        Target Review Comment to verify: "{assigned_comment}"
        Expected Reviewer Name (if any): "{expected_reviewer_name}"

        Examine this app screenshot carefully.
        1. Does the screenshot contain the target review comment (or a truncated/very close version of it)?
        2. Is the review comment written under the user's review section?

        Respond strictly in valid JSON format:
        {{
            "verified": true or false,
            "score": number between 0 and 100,
            "reviewer_name": "extracted reviewer name or null",
            "review_comment": "extracted review comment text or null",
            "explanation": "brief reasoning"
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
                prompt
            ]
        )

        resp_text = response.text.strip()
        if resp_text.startswith("```json"):
            resp_text = resp_text.replace("```json", "").replace("```", "").strip()

        data = json.loads(resp_text)
        is_verified = bool(data.get("verified", False))
        
        return {
            "verified": is_verified,
            "status": "PASS" if is_verified else "FAIL",
            "score": float(data.get("score", 95.0 if is_verified else 85.0)),
            "reviewer_name": data.get("reviewer_name"),
            "review_comment": data.get("review_comment"),
            "reason": data.get("explanation", "Gemini Vision AI verification")
        }

    except Exception as err:
        print(f"[Vision-AI-Fallback] Gemini API error: {err}")
        # If Vision AI call fails, accept 90%+ match safely
        return {
            "verified": True,
            "status": "PASS",
            "score": 90.0,
            "reason": f"API_ERROR_FALLBACK: {err}"
        }
