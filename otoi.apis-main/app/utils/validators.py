import os

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg'}
ALLOWED_IMAGE_MIMETYPES = {'image/png', 'image/jpeg'}

def is_allowed_image_file(filename):
    """
    Check if the filename has an allowed image extension.
    """
    if not filename:
        return False
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

def is_allowed_image_mimetype(mimetype):
    """
    Check if the MIME type is an allowed image type.
    """
    return mimetype in ALLOWED_IMAGE_MIMETYPES
