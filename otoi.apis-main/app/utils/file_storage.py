import os
import base64

def save_base64_image(base64_data, folder_path, filename):
    """
    Saves a base64 image to the specified folder, creating the folder if it doesn't exist.
    """
    # Automatically create the folder if it doesn't exist
    os.makedirs(folder_path, exist_ok=True)
    
    # Strip base64 prefix if exists (e.g., "data:image/png;base64,")
    if "," in base64_data:
        base64_data = base64_data.split(",")[1]
        
    decoded_data = base64.b64decode(base64_data)
    filepath = os.path.join(folder_path, filename)
    
    with open(filepath, "wb") as f:
        f.write(decoded_data)
        
    return filename
