import os
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models.business import Business, GlobalConfig
from app.utils.file_storage import save_base64_image
from app.utils.stamping import set_updated_fields, set_created_fields

business_config_blueprint = Blueprint("business_config", __name__)

@business_config_blueprint.route("/global-assets", methods=["POST"])
def update_global_assets():
    """
    Update business global assets (logo and e-sign) in global_config table.
    """
    data = request.json
    business = Business.query.first()
    
    if not business:
        return jsonify({"message": "Business not found"}), 404
        
    assets_to_update = {
        "site_logo": data.get("logo"),
        "e_sign": data.get("esign")
    }
    
    updated_keys = []
    
    for key, base64_data in assets_to_update.items():
        if base64_data:
            # Save file to disk
            filename = f"{key}_{business.id}.png"
            save_base64_image(
                base64_data, 
                current_app.config['BUSINESS_ASSETS_FOLDER'], 
                filename
            )
            
            # Update or Create row in global_config
            asset = GlobalConfig.query.filter_by(business_id=business.id, key=key).first()
            if not asset:
                asset = GlobalConfig(business_id=business.id, key=key, path=filename)
                set_created_fields(asset)
            else:
                asset.path = filename
            
            set_updated_fields(asset)
            db.session.add(asset)
            updated_keys.append(key)
        
    if updated_keys:
        db.session.commit()
    
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
            result['logo_path'] = asset.path
        elif asset.key == 'e_sign':
            result['esign_path'] = asset.path
            
    return jsonify(result), 200
