from io import BytesIO
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
import os

def generate_barcode(item_code: str, item_name: str, barcode_value: str | None = None) -> BytesIO:
    """
    Generate a high-quality barcode image with item code and item name.
    The entire image background is white.
    """

    # Use item_code if no custom barcode_value is provided
    if not barcode_value:
        barcode_value = item_code

    # Generate barcode with higher resolution and size
    barcode_buffer = BytesIO()
    barcode = Code128(barcode_value, writer=ImageWriter())
    barcode.write(
        barcode_buffer,
        {
            "write_text": False,
            "module_width": 0.6,  # Increased for better clarity
            "module_height": 20,   # Increased for better clarity
            "quiet_zone": 15,      # Increased for better spacing
            "font_size": 14,       # Increased font size if text is included
            "text_distance": 2,    # Distance between barcode and text
            "background": "white",
            "foreground": "black"
        },
    )

    barcode_buffer.seek(0)
    barcode_img = Image.open(barcode_buffer).convert("RGB")

    # Prepare final image with white background and more space for text
    text_height = 90  # Increased for better spacing
    img_width = max(barcode_img.width + 60, 400)  # Increased for better spacing
    img_height = barcode_img.height + text_height + 30  # Increased for better spacing

    final_img = Image.new("RGB", (img_width, img_height), "white")

    # Paste barcode in the center
    x_offset = (img_width - barcode_img.width) // 2
    final_img.paste(barcode_img, (x_offset, 20))  # Adjusted position for better spacing

    draw = ImageDraw.Draw(final_img)

    # Load font (fallback to default if missing)
    try:
        font_path = os.path.join(os.path.dirname(__file__), "..", "static", "fonts", "DejaVuSans.ttf")
        font_small = ImageFont.truetype(font_path, 18)  # Increased font size
        font_large = ImageFont.truetype(font_path, 22)  # Increased font size
    except Exception:
        font_small = ImageFont.load_default()
        font_large = ImageFont.load_default()

    # Clean and prepare text
    item_code = item_code.strip()
    item_name = (item_name or "").strip()

    # Draw item code
    code_text = f"Code: {item_code}"
    code_bbox = draw.textbbox((0, 0), code_text, font=font_small)
    code_width = code_bbox[2] - code_bbox[0]
    draw.text(
        ((img_width - code_width) // 2, barcode_img.height + 30),  # Adjusted position for better spacing
        code_text,
        fill="black",
        font=font_small,
    )

    # Draw item name (truncate if too long)
    name_text = f"Name: {item_name}" if item_name else ""
    max_width = img_width - 60  # Adjusted max width for better spacing
    while True:
        name_bbox = draw.textbbox((0, 0), name_text, font=font_large)
        if (name_bbox[2] - name_bbox[0]) <= max_width or len(name_text) <= 10:
            break
        name_text = name_text[:-4] + "..."
    name_width = name_bbox[2] - name_bbox[0]
    draw.text(
        ((img_width - name_width) // 2, barcode_img.height + 60),  # Adjusted position for better spacing
        name_text,
        fill="black",
        font=font_large,
    )

    # Save final image to BytesIO with higher quality
    output = BytesIO()
    final_img.save(output, format="PNG", dpi=(300, 300))  # Increased DPI for better quality
    output.seek(0)

    return output
