from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import pandas as pd
import os
from flask_cors import CORS
from app.extensions import db
from app.models.person import Person
from app.models.common import Address

csv_import_bp = Blueprint('csv_import', __name__)
CORS(csv_import_bp)  # Enable CORS for this Blueprint

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Define status and person type mappings
STATUS_MAPPING = {
    "New": 1,
    "In-progress": 2,
    "Quote Given": 3,
    "Win": 4,
    "Lose": 5,
}



PERSON_TYPE_MAPPING = {
    "Customer": 1,
    "Vendor": 2,
    "Provider": 3,
    "Lead": 4,
    "Employee": 5,
}


@csv_import_bp.route('/import_csv', methods=['POST'])
def import_csv():
    if 'csv_file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    uploaded_file = request.files['csv_file']
    if uploaded_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = secure_filename(uploaded_file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    uploaded_file.save(filepath)

    try:
        # Read file into Pandas DataFrame
        if filename.endswith('.csv'):
            df = pd.read_csv(filepath, dtype=str)
        else:
            df = pd.read_excel(filepath, dtype=str)

        # Normalize column names
        df.columns = [c.strip().lower() for c in df.columns]

        # Apply column mapping
        COLUMN_MAPPING = {
            "first name": "first_name",
            "last name": "last_name",
            "mobile": "mobile",
            "email": "email",
            "gst": "gst",
            "person type": "person_type",
            "status": "status",
            "reason": "reason",
            "address1": "address1",
            "address2": "address2",
            "city": "city",
            "state": "state",
            "country": "country",
            "pin": "pin",
        }

        df.rename(columns=COLUMN_MAPPING, inplace=True)

        # Map status and person type to IDs
        if 'status' in df.columns:
            df['status'] = df['status'].map(STATUS_MAPPING)
            df['status'] = df['status'].fillna(0).astype(int)
        if 'person_type' in df.columns:
            df['person_type_id'] = df['person_type'].map(PERSON_TYPE_MAPPING)

        # Convert to dicts
        records = df.to_dict(orient='records')

        required_fields = ['first_name', 'last_name', 'mobile', 'email', 'person_type_id', 'status']
        for record in records:
            for field in required_fields:
                if record.get(field) in [None, ""]:  # allow 0, reject only missing/blank
                    raise ValueError(f'Missing or empty required field: {field}')


        # Insert Persons + Addresses
        persons = []
        for record in records:
            person = Person(
                first_name=record.get("first_name"),
                last_name=record.get("last_name"),
                mobile=record.get("mobile"),
                email=record.get("email"),
                gst=record.get("gst"),
                person_type_id=record.get("person_type_id"),
                status=record.get("status"),
                reason=record.get("reason")
            )
            db.session.add(person)
            db.session.flush()  # assign person.id without committing

            address = Address(
                address1=record.get("address1"),
                address2=record.get("address2"),
                city=record.get("city"),
                state=record.get("state"),
                country=record.get("country"),
                pin=record.get("pin"),
            )
            db.session.add(address)

            persons.append(person)

        db.session.commit()

        return jsonify({'message': f'{len(persons)} records imported successfully'}), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to import data: {str(e)}'}), 500
