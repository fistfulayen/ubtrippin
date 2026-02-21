#!/usr/bin/env python3
"""Generate PWA icons from the ubtrippin logo."""
import sys
sys.path.insert(0, '/tmp/imgtools/lib/python3.14/site-packages')

from PIL import Image
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_ROOT, 'public', 'ubtrippin_logo.png')
ICONS_DIR = os.path.join(PROJECT_ROOT, 'public', 'icons')

# Cream background color matching the site
BG_COLOR = (237, 230, 207, 255)  # #ede6cf

def generate_icon(size, output_name):
    """Generate a square icon by centering the logo character on a cream background."""
    logo = Image.open(LOGO_PATH).convert('RGBA')

    # The character is roughly in the left-center portion of the image
    # Crop to focus on the character + speech bubble (top portion)
    w, h = logo.size
    # Crop a square-ish region focusing on the character
    # The character is roughly from 0-70% width and 0-75% height
    crop_right = int(w * 0.85)
    crop_bottom = int(h * 0.78)
    crop_left = int(w * 0.02)
    crop_top = 0

    cropped = logo.crop((crop_left, crop_top, crop_right, crop_bottom))

    # Make it square by adding padding
    cw, ch = cropped.size
    max_dim = max(cw, ch)

    # Create square canvas with cream background
    square = Image.new('RGBA', (max_dim, max_dim), BG_COLOR)

    # Center the cropped logo on the canvas
    paste_x = (max_dim - cw) // 2
    paste_y = (max_dim - ch) // 2

    # Composite to handle transparency
    square.paste(cropped, (paste_x, paste_y), cropped)

    # Resize to target size
    resized = square.resize((size, size), Image.LANCZOS)

    output_path = os.path.join(ICONS_DIR, output_name)
    resized.save(output_path, 'PNG', optimize=True)
    print(f"Generated: {output_path} ({size}x{size})")

os.makedirs(ICONS_DIR, exist_ok=True)

generate_icon(192, 'icon-192x192.png')
generate_icon(512, 'icon-512x512.png')
generate_icon(180, 'apple-touch-icon.png')

print("Done! All PWA icons generated.")
