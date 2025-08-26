from flask import g
from datetime import datetime


def set_business(instance):
    """Set business_id on the instance using safe default."""
    if hasattr(instance, 'business_id'):
        instance.business_id = getattr(g, 'business_id', 1)


def set_created_fields(instance):
    """Set created_at and created_by fields on the instance."""
    if hasattr(instance, 'created_at'):
        instance.created_at = datetime.utcnow()
    if hasattr(instance, 'created_by'):
        instance.created_by = getattr(g, 'user_id', None)


def set_updated_fields(instance):
    """Set updated_at and updated_by fields on the instance."""
    if hasattr(instance, 'updated_at'):
        instance.updated_at = datetime.utcnow()
    if hasattr(instance, 'updated_by'):
        instance.updated_by = getattr(g, 'user_id', None)
