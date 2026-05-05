import os
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models.business import Business, GlobalConfig
from werkzeug.utils import secure_filename
from app.utils.stamping import set_updated_fields, set_created_fields
from app.utils.validators import is_allowed_image_file

business_config_blueprint = Blueprint("business_config", __name__)

@business_config_blueprint.route("/global-assets", methods=["POST"])
def update_global_assets():
    """
    Update business global assets (logo and e-sign) in global_config table.
    """
    try:
        business = Business.query.first()
        
        if not business:
            return jsonify({"message": "Business not found"}), 404
            
        assets_to_update = {
            "site_logo": request.files.get("logo"),
            "e_sign": request.files.get("esign")
        }
        
        updated_keys = []
        
        for key, file_obj in assets_to_update.items():
            if file_obj:
                # Validate file extension
                if not is_allowed_image_file(file_obj.filename):
                    return jsonify({"message": f"Invalid file type for {key}. Only JPG, JPEG, and PNG are allowed."}), 400
                
                # Secure the filename
                original_filename = secure_filename(file_obj.filename)
                ext = os.path.splitext(original_filename)[1] or '.png' # Fallback to png if no extension
                filename = f"{key}_{business.id}{ext}"
                
                # Save file to disk
                folder_path = current_app.config['BUSINESS_ASSETS_FOLDER']
                
                try:
                    if not os.path.exists(folder_path):
                        os.makedirs(folder_path, exist_ok=True)
                except Exception as e:
                    current_app.logger.error(f"Failed to create directory {folder_path}: {str(e)}")
                    return jsonify({"message": f"Server error: Could not create upload directory. {str(e)}"}), 500

                filepath = os.path.join(folder_path, filename)
                
                try:
                    file_obj.save(filepath)
                except Exception as e:
                    current_app.logger.error(f"Failed to save file to {filepath}: {str(e)}")
                    return jsonify({"message": f"Server error: Could not save file. {str(e)}"}), 500
                
                # Update or Create row in global_config
                asset = GlobalConfig.query.filter_by(business_id=business.id, key=key).first()
                if not asset:
                    asset = GlobalConfig(business_id=business.id, key=key, value=filename)
                    set_created_fields(asset)
                else:
                    asset.value = filename
                
                set_updated_fields(asset)
                db.session.add(asset)
                updated_keys.append(key)
            
        if updated_keys:
            db.session.commit()
            
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unexpected error in update_global_assets: {str(e)}")
        return jsonify({"message": f"An unexpected error occurred: {str(e)}"}), 500
    
    return jsonify({
        "message": f"Updated assets: {', '.join(updated_keys)}" if updated_keys else "No assets updated",
        "updated": updated_keys
    }), 200

@business_config_blueprint.route("/global-assets", methods=["GET"])
def get_global_assets():
    """
    Get current business global assets from global_config table.
    """
    business = Business.query.first()
    if not business:
        return jsonify({"message": "Business not found"}), 404
        
    assets = GlobalConfig.query.filter_by(business_id=business.id).all()
    
    result = {}
    for asset in assets:
        if asset.key == 'site_logo':
            result['logo_path'] = asset.value
        elif asset.key == 'e_sign':
            result['esign_path'] = asset.value
            
    return jsonify(result), 200
