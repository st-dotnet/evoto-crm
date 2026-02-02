from app.models.common import Address
from app.extensions import db

def clean_orphaned_addresses():
    """
    Remove addresses that are not referenced by any shipping records or leads.
    Note: This function is kept for backward compatibility but is now a no-op
    since shipping addresses are now denormalized into the Shipping model.
    Returns 0 as no addresses will be cleaned by this function anymore.
    """
    # Since shipping addresses are now denormalized, we don't need to clean up
    # addresses from the Shipping model anymore.
    # This function is kept for backward compatibility but returns 0.
    return 0

def validate_address_type(address_type):
    """Validate that address_type is one of the allowed values."""
    return address_type in {'home', 'work', 'other'}
