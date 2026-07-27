#!/usr/bin/env python3
"""
=============================================================================
Asset Conversion & Optimization Script (PNG -> WebP)
=============================================================================
This script scans the '/public/assets/images/' directory, converts target
PNG assets to highly compressed .webp images while preserving RGBA transparency,
and removes the legacy PNG files to save storage space and bandwidth.

Requirements:
    pip install Pillow

Usage:
    python3 scripts/convert_assets.py
=============================================================================
"""

import os
import sys
from PIL import Image

# Directory containing application image assets
TARGET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'assets', 'images')

# Target PNG files to optimize
TARGET_FILES = [
    # 1. App Main Logos
    'logo_512.png',
    'logo_192.png',
    # 2. Withdraw Payment Method Logos
    'withdraw_upi.png',
    'withdraw_bank.png',
    'withdraw_playstore.png',
    'withdraw_amazon.png',
    'withdraw_flipkart.png',
    'withdraw_paypal.png',
    'withdraw_crypto.png',
    # 3. Cards & Background Graphics
    'profile_card_bg.png',
    'withdraw_confirm_bg.png',
    'referral_banner.png',
    'referral_howitworks_cards.png',
    # 4. System Icons
    'notification_bell.png',
    'whats_new_megaphone.png'
]

def convert_png_to_webp(folder_path, file_list):
    if not os.path.exists(folder_path):
        print(f"❌ Target directory not found: {folder_path}")
        return

    print(f"🚀 Starting Asset Optimization in: {folder_path}\n" + "-" * 60)
    
    total_original_bytes = 0
    total_webp_bytes = 0
    converted_count = 0

    for filename in file_list:
        png_path = os.path.join(folder_path, filename)
        if not os.path.exists(png_path):
            print(f"⚠️ File missing, skipping: {filename}")
            continue

        webp_filename = os.path.splitext(filename)[0] + '.webp'
        webp_path = os.path.join(folder_path, webp_filename)

        try:
            # Get original file size
            orig_size = os.path.getsize(png_path)
            total_original_bytes += orig_size

            # Open image with Pillow and preserve RGBA color modes for transparency
            with Image.open(png_path) as img:
                # Ensure palette and grayscale images with alpha convert cleanly to RGBA
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    img = img.convert('RGBA')
                else:
                    img = img.convert('RGB')

                # Save as WebP with high quality compression and lossless transparency preservation
                img.save(webp_path, 'WEBP', quality=85, method=6)

            new_size = os.path.getsize(webp_path)
            total_webp_bytes += new_size

            # Calculate savings
            savings_pct = ((orig_size - new_size) / orig_size) * 100 if orig_size > 0 else 0

            # Delete the legacy PNG file
            os.remove(png_path)
            converted_count += 1

            print(f"✅ Converted: {filename} ➔ {webp_filename}")
            print(f"   Size: {orig_size / 1024:.1f} KB ➔ {new_size / 1024:.1f} KB ({savings_pct:.1f}% saved)")

        except Exception as e:
            print(f"❌ Failed to convert {filename}: {str(e)}")

    print("-" * 60)
    if converted_count > 0:
        total_saved_bytes = total_original_bytes - total_webp_bytes
        total_savings_pct = (total_saved_bytes / total_original_bytes) * 100 if total_original_bytes > 0 else 0
        print(f"🎉 Optimization Complete!")
        print(f"   Files Converted: {converted_count}")
        print(f"   Original Size : {total_original_bytes / (1024 * 1024):.2f} MB")
        print(f"   New WebP Size : {total_webp_bytes / (1024 * 1024):.2f} MB")
        print(f"   Total Saved   : {total_saved_bytes / (1024 * 1024):.2f} MB ({total_savings_pct:.1f}% reduction)")
    else:
        print("ℹ️ No target PNG files were converted.")

if __name__ == '__main__':
    convert_png_to_webp(TARGET_DIR, TARGET_FILES)
