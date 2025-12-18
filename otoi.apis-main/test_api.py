import requests
import json

# API endpoint
url = "http://localhost:5000/api/items/"

# Request headers
headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"  # Explicitly ask for JSON response
}

# Test data
data = {
    "item_name": "Maggie-2",
    "item_type_id": 1,
    "category_id": "1",
    "measuring_unit": "PCS",
    "sales_price": 22,
    "gst_tax_rate": 18,
    "opening_stock": 10
}

try:
    # Make the POST request
    response = requests.post(url, json=data, headers=headers)
    
    # Print detailed response info
    print(f"Status Code: {response.status_code}")
    print("Headers:", response.headers)
    print("Raw Response:", response.text)
    
    try:
        print("Parsed JSON:", response.json())
    except ValueError:
        print("Could not parse JSON response")
        
except requests.exceptions.RequestException as e:
    print("Error making request:", e)
except Exception as e:
    print("An unexpected error occurred:", str(e))