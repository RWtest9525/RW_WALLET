import os
import sys
import glob
import json
import time

# Ensure UTF-8 output encoding for Windows stdout
sys.stdout.reconfigure(encoding='utf-8')

from verification_engine import verify_screenshot

SAMPLE_DIR = r"C:\Users\Yash Vishal\Downloads\Sample review ocr"

def test_samples():
    image_paths = glob.glob(os.path.join(SAMPLE_DIR, "*.*"))
    print("=" * 60)
    print(f" Testing AI Verification Engine on {len(image_paths)} Sample Screenshots")
    print(f" Path: {SAMPLE_DIR}")
    print("=" * 60 + "\n")

    passed_count = 0
    total_time = 0.0

    for idx, img_path in enumerate(image_paths, 1):
        filename = os.path.basename(img_path)
        start_time = time.time()
        
        # Test candidate comment pool matching
        sample_pool = """What Android version is required to use the app? How does the app help me discover new movies?
Great app UI and fast performance.
Easy navigation and clean design.
Mukulsiwach14 Gift approved 22,184
Learn more about collection Data is encrypted in transit Account deletion available"""

        result = verify_screenshot(
            image_path=img_path,
            assigned_comment=sample_pool,
            task_type="google_play_review"
        )
        
        elapsed = round(time.time() - start_time, 2)
        total_time += elapsed

        status = result.get("status")
        score = result.get("score")
        reviewer_name = result.get("reviewer_name", "N/A")
        review_comment = result.get("review_comment", "N/A")
        matched_comment = result.get("matched_comment", "N/A")
        extractor = result.get("details", {}).get("extractor")

        print(f"[{idx}/{len(image_paths)}] {filename}")
        print(f"  |- Status: {status} | Score: {score}% | Extractor: {extractor} ({elapsed}s)")
        print(f"  |- Reviewer Name: {reviewer_name}")
        print(f"  |- Matched Comment from Pool: {matched_comment[:80]}...")
        print(f"  |- Extracted Review Comment: {review_comment[:80]}...\n")

        if review_comment or reviewer_name:
            passed_count += 1

    print("=" * 60)
    print(f" Test Results: {passed_count}/{len(image_paths)} Screenshots Extracted Successfully")
    print(f" Total Time: {round(total_time, 2)}s (Avg: {round(total_time/len(image_paths), 2)}s per screenshot)")
    print("=" * 60)

if __name__ == "__main__":
    test_samples()
