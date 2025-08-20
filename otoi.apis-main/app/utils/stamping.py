from datetime import datetime
from flask import g

def set_created_fields(model_instance):
    """Set created_by and created_at fields."""
    model_instance.created_by = g.user_id  # Assuming `g.user_id` holds the current user's ID
    model_instance.created_at = datetime.utcnow()

def set_updated_fields(model_instance):
    """Set updated_by and updated_at fields."""
    model_instance.updated_by = g.user_id  # Assuming `g.user_id` holds the current user's ID
    model_instance.updated_at = datetime.utcnow()

def set_business(model_instance):
    """Set business_id field."""
    model_instance.business_id = g.business_id  # Assum