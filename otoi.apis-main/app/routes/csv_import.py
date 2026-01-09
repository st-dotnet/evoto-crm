from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import pandas as pd
import os
import traceback
import numpy as np
from flask_cors import CORS

from app.extensions import db
from app.models.person import Lead, LeadAddress
from app.models.common import Address
from app.utils.stamping import set_created_fields, set_business

csv_import_bp = Blueprint("csv_import", __name__)
CORS(csv_import_bp)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

STATUS_MAPPING = {
    "new": 1,
    "inprogress": 2,
    "quotegiven": 3,
    "win": 4,
    "lose": 5,
}


@csv_import_bp.route("/import_leads", methods=["POST"])
def import_leads():
    if "csv_file" not in request.files:
        return jsonify({"error": "CSV file is required"}), 400

    file = request.files["csv_file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(filepath, dtype=str)
        else:
            df = pd.read_excel(filepath, dtype=str)

        df = df.replace({np.nan: None})

        df.columns = [c.strip().lower() for c in df.columns]

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

        required_fields = ["first_name", "last_name", "mobile", "email", "status"]
        for field in required_fields:
            if field not in df.columns:
                raise ValueError(f"Missing required column: {field}")

        # ---------- STATUS NORMALIZATION ----------
        df["status"] = (
            df["status"]
            .astype(str)
            .str.strip()
            .str.lower()
            .str.replace(" ", "")
            .str.replace("-", "")
        )

        df["status"] = df["status"].map(STATUS_MAPPING)

        if df["status"].isnull().any():
            bad_rows = (df[df["status"].isnull()].index + 2).tolist()
            raise ValueError(
                f"Invalid status in row(s) {bad_rows}. "
                f"Allowed values: New, In-Progress, Quote Given, Win, Lose"
            )

        records = df.to_dict(orient="records")

        for i, row in enumerate(records, start=2):
            for field in required_fields:
                value = row.get(field)
                if value is None or str(value).strip() == "":
                    raise ValueError(f"Row {i}: '{field}' is required")

        # ---------- INSERT DATA ----------
        for row in records:
            lead = Lead(
                first_name=row["first_name"],
                last_name=row["last_name"],
                mobile=row["mobile"],
                email=row["email"],
                gst=row.get("gst"),
                status=row["status"],
                reason=row.get("reason"),
            )
            set_created_fields(lead)
            set_business(lead)

            db.session.add(lead)
            db.session.flush()  # get lead.uuid

            # Create address only if address1 exists
            if row.get("address1") and str(row.get("address1")).strip() != "":
                address = Address(
                    address1=row.get("address1"),
                    address2=row.get("address2"),
                    city=row.get("city") or "",
                    state=row.get("state") or "",
                    country=row.get("country") or "",
                    pin=row.get("pin") or "",
                )
                set_created_fields(address)
                set_business(address)

                db.session.add(address)
                db.session.flush()  # get address.uuid

                lead_address = LeadAddress(
                    lead_id=lead.uuid,
                    address_id=address.uuid,
                )
                set_created_fields(lead_address)
                set_business(lead_address)

                db.session.add(lead_address)

        db.session.commit()

        return jsonify({
            "message": f"{len(records)} records imported successfully"
        }), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"error": str(ve)}), 400

    except Exception as e:
        db.session.rollback()
        print("ERROR IN CSV IMPORT:")
        print(traceback.format_exc())
        return jsonify({"error": "Internal server error during CSV import"}), 500
