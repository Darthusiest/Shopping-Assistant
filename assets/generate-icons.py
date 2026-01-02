#!/usr/bin/env python3
"""
Script to generate PNG icons from SVG template
Requires: cairosvg or PIL/Pillow with svglib

Install dependencies:
pip install cairosvg
# OR
pip install svglib reportlab Pillow
"""

import os
import sys

try:
    import cairosvg
    USE_CAIRO = True
except ImportError:
    try:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPM
        USE_CAIRO = False
    except ImportError:
        print("Error: Please install either cairosvg or svglib+reportlab+Pillow")
        print("  pip install cairosvg")
        print("  OR")
        print("  pip install svglib reportlab Pillow")
        sys.exit(1)

def generate_icon(size, output_path):
    svg_path = os.path.join(os.path.dirname(__file__), 'icon-template.svg')
    
    if USE_CAIRO:
        cairosvg.svg2png(url=svg_path, write_to=output_path, output_width=size, output_height=size)
    else:
        drawing = svg2rlg(svg_path)
        scale = size / 128.0  # Original SVG is 128x128
        drawing.width = size
        drawing.height = size
        drawing.scale(scale, scale)
        renderPM.drawToFile(drawing, output_path, fmt='PNG')
    
    print(f"Generated {output_path} ({size}x{size})")

if __name__ == "__main__":
    sizes = [16, 48, 128]
    base_dir = os.path.dirname(__file__)
    
    for size in sizes:
        output_path = os.path.join(base_dir, f'icon{size}.png')
        generate_icon(size, output_path)
    
    print("\nAll icons generated successfully!")

