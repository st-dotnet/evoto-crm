import barcode
from barcode.writer import ImageWriter
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import os

def generate_barcode(item_code: str, item_name: str, barcode_value: str | None = None) -> BytesIO:
    """
    Generate a high-quality barcode image with item code and item name.
    """
    try:
        # Use item_code if no custom barcode_value is provided
        if not barcode_value:
            barcode_value = item_code

        # 1. Generate barcode
        barcode_buffer = BytesIO()
        try:
            # Use the 'code128' type specifically
            EAN = barcode.get_barcode_class('code128')
            code = EAN(barcode_value, writer=ImageWriter())
            code.write(barcode_buffer, {
                "write_text": False,
                "module_width": 0.6,
                "module_height": 20,
                "quiet_zone": 10,
                "background": "white",
                "foreground": "black"
            })
        except Exception as e:
            # Fallback if specific barcode class fails
            barcode_buffer = BytesIO()
            code = barcode.get('code128', barcode_value, writer=ImageWriter())
            code.write(barcode_buffer, {"write_text": False})

        barcode_buffer.seek(0)
        barcode_img = Image.open(barcode_buffer).convert("RGB")

        # 2. Prepare layout
        text_height = 80
        img_width = max(barcode_img.width + 40, 350)
        img_height = barcode_img.height + text_height + 20
        final_img = Image.new("RGB", (img_width, img_height), "white")

        # Paste barcode
        x_offset = (img_width - barcode_img.width) // 2
        final_img.paste(barcode_img, (x_offset, 10))

        draw = ImageDraw.Draw(final_img)

        # 3. Handle Fonts Safely
        font_small = None
        font_large = None
        try:
            # Try multiple possible paths for the font
            font_paths = [
                os.path.join(os.path.dirname(__file__), "..", "..", "static", "fonts", "DejaVuSans.ttf"),
                os.path.join(os.path.dirname(__file__), "..", "static", "fonts", "DejaVuSans.ttf"),
                "C:\\Windows\\Fonts\\arial.ttf", # Windows fallback
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" # Linux fallback
            ]
            
            for path in font_paths:
                if os.path.exists(path):
                    font_small = ImageFont.truetype(path, 16)
                    font_large = ImageFont.truetype(path, 20)
                    break
        except:
            pass

        if font_small is None:
            font_small = ImageFont.load_default()
            font_large = ImageFont.load_default()

        # 4. Draw Text
        def draw_centered_text(text, y_pos, font, color="black"):
            try:
                # Use textlength for better compatibility than textbbox
                if hasattr(draw, 'textlength'):
                    tw = draw.textlength(text, font=font)
                else:
                    # Older Pillow fallback
                    tw, _ = draw.textsize(text, font=font) if hasattr(draw, 'textsize') else (len(text)*10, 20)
                
                draw.text(((img_width - tw) // 2, y_pos), text, fill=color, font=font)
            except:
                # Absolute fallback
                draw.text((20, y_pos), text, fill=color, font=font)

        # Draw code and name
        item_code_display = f"Code: {item_code.strip()}"
        item_name_display = (item_name or "").strip()
        if len(item_name_display) > 30:
            item_name_display = item_name_display[:27] + "..."

        draw_centered_text(item_code_display, barcode_img.height + 20, font_small)
        if item_name_display:
            draw_centered_text(item_name_display, barcode_img.height + 45, font_large)

        # 5. Export
        output = BytesIO()
        final_img.save(output, format="PNG")
        output.seek(0)
        return output

    except Exception as e:
        # Final emergency fallback: if everything fails, return the raw barcode without text
        import traceback
        print(f"Barcode service critical failure: {str(e)}")
        print(traceback.format_exc())
        
        # Try to at least return the raw barcode image
        try:
            emergency_buffer = BytesIO()
            code = barcode.get('code128', item_code, writer=ImageWriter())
            code.write(emergency_buffer, {"write_text": True})
            emergency_buffer.seek(0)
            return emergency_buffer
        except:
            raise e # Re-raise if even emergency fallback fails
