from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import pandas as pd
import os
from flask_cors import CORS
from app.extensions import db
from app.models.person import Lead
from app.models.common import Address

csv_import_bp = Blueprint('csv_import', __name__)
CORS(csv_import_bp)  # Enable CORS for this Blueprint

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Define status mappings
STATUS_MAPPING = {
    "New": 1,
    "In-Progress": 2,
    "Quote Given": 3,
    "Win": 4,
    "Lose": 5,
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

        #  Map status
        if 'status' in df.columns:
            df['status'] = df['status'].str.strip().str.title()
            df['status'] = df['status'].map(STATUS_MAPPING)
            if df['status'].isnull().any():
                invalid_status = df.loc[df['status'].isnull(), 'status'].unique()
                raise ValueError(f"Invalid status values in CSV: {invalid_status.tolist()}")

        # Convert to dicts
        records = df.to_dict(orient='records')

        #  Required fields check with row number
        required_fields = ['first_name', 'last_name', 'mobile', 'email', 'status']
        for i, record in enumerate(records, start=1):  # 1-based row index
            for field in required_fields:
                if record.get(field) in [None, ""]:
                    raise ValueError(f"Row {i}: Missing or empty required field '{field}'")

        # Insert Leads + Addresses
        leads = []
        for record in records:
            lead = Lead(
                first_name=record.get("first_name"),
                last_name=record.get("last_name"),
                mobile=record.get("mobile"),
                email=record.get("email"),
                gst=record.get("gst"),
                status=record.get("status"),
                reason=record.get("reason")
            )
            db.session.add(lead)
            db.session.flush()  # assign lead.id without committing

            address = Address(
                address1=record.get("address1"),
                address2=record.get("address2"),
                city=record.get("city"),
                state=record.get("state"),
                country=record.get("country"),
                pin=record.get("pin"),
                address_type=1,  # you may want to default this
            )
            db.session.add(address)

            leads.append(lead)

        db.session.commit()

        return jsonify({'message': f'{len(leads)} records imported successfully'}), 200

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to import data: {str(e)}'}), 500

