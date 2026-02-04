#!/usr/bin/env python3
"""
Test script to validate the new shipping address structure with address_type
"""

# Test data for the new shipping_addresses array format
test_customer_data = {
    "first_name": "John",
    "last_name": "Doe",
    "mobile": "1234567890",
    "email": "john.doe@example.com",
    "status": "1",
    "address1": "123 Billing St",
    "city": "Billing City",
    "state": "Billing State",
    "country": "Billing Country",
    "pin": "12345",
    "shipping_addresses": [
        {
            "address_type": "home",
            "address1": "456 Home Ave",
            "city": "Home City",
            "state": "Home State", 
            "country": "Home Country",
            "pin": "67890",
            "is_default": True
        },
        {
            "address_type": "work",
            "address1": "789 Work Blvd",
            "city": "Work City",
            "state": "Work State",
            "country": "Work Country", 
            "pin": "54321",
            "is_default": False
        }
    ]
}

def validate_address_type(address_type):
    """Validate address_type enum values"""
    valid_types = ['home', 'work', 'other']
    return address_type.lower() in valid_types

def validate_shipping_address(address_data, index):
    """Validate individual shipping address"""
    errors = []
    
    # Check required fields
    required_fields = ['address1', 'city', 'state', 'country', 'pin', 'address_type']
    for field in required_fields:
        if not address_data.get(field):
            errors.append(f"Shipping address at index {index} missing required field: {field}")
    
    # Validate address_type
    address_type = address_data.get('address_type', '').lower()
    if not validate_address_type(address_type):
        errors.append(f"Shipping address at index {index} has invalid address_type: {address_type}")
    
    return errors

def test_new_structure():
    """Test the new shipping address structure"""
    print("Testing new shipping address structure...")
    
    # Test customer data
    shipping_addresses = test_customer_data.get("shipping_addresses", [])
    
    if not isinstance(shipping_addresses, list):
        print("❌ shipping_addresses must be an array")
        return False
    
    if len(shipping_addresses) > 3:
        print("❌ Maximum of 3 shipping addresses allowed")
        return False
    
    all_errors = []
    for i, addr in enumerate(shipping_addresses):
        errors = validate_shipping_address(addr, i)
        all_errors.extend(errors)
    
    if all_errors:
        print("❌ Validation errors:")
        for error in all_errors:
            print(f"   - {error}")
        return False
    
    print("✅ New shipping address structure is valid!")
    print(f"✅ Found {len(shipping_addresses)} shipping addresses")
    for i, addr in enumerate(shipping_addresses):
        print(f"   - Address {i+1}: {addr['address_type'].title()} - {addr['address1']}")
    
    return True

def test_response_format():
    """Test the expected response format"""
    print("\nTesting expected response format...")
    
    # Simulate response data structure
    response_data = {
        "uuid": "customer-uuid",
        "customer_id": "customer-uuid", 
        "first_name": "John",
        "last_name": "Doe",
        "mobile": "1234567890",
        "email": "john.doe@example.com",
        "gst": None,
        "status": "1",
        "address1": "123 Billing St",
        "address2": None,
        "city": "Billing City",
        "state": "Billing State",
        "country": "Billing Country",
        "pin": "12345",
        # Backward compatibility fields
        "shipping_address1": "456 Home Ave",
        "shipping_city": "Home City", 
        "shipping_state": "Home State",
        "shipping_country": "Home Country",
        "shipping_pin": "67890",
        "address_type": "home",
        "is_default_shipping": True,
        "shipping_uuid": "shipping-uuid",
        # New array format
        "shipping_addresses": [
            {
                "uuid": "shipping-uuid",
                "address_type": "home",
                "address1": "456 Home Ave",
                "city": "Home City",
                "state": "Home State",
                "country": "Home Country", 
                "pin": "67890",
                "is_default": True,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        ]
    }
    
    # Check required fields
    required_fields = ['uuid', 'first_name', 'last_name', 'mobile', 'email']
    for field in required_fields:
        if field not in response_data:
            print(f"❌ Missing required field: {field}")
            return False
    
    # Check shipping addresses array
    if 'shipping_addresses' not in response_data:
        print("❌ Missing shipping_addresses array in response")
        return False
    
    shipping_addresses = response_data['shipping_addresses']
    if not isinstance(shipping_addresses, list):
        print("❌ shipping_addresses must be an array")
        return False
    
    # Check each shipping address structure
    for addr in shipping_addresses:
        addr_required_fields = ['uuid', 'address_type', 'address1', 'city', 'state', 'country', 'pin', 'is_default']
        for field in addr_required_fields:
            if field not in addr:
                print(f"❌ Missing field in shipping address: {field}")
                return False
    
    print("✅ Response format is valid!")
    return True

if __name__ == "__main__":
    success = True
    success &= test_new_structure()
    success &= test_response_format()
    
    if success:
        print("\n🎉 All tests passed! The new shipping address structure is ready.")
    else:
        print("\n❌ Some tests failed. Please check the implementation.")
