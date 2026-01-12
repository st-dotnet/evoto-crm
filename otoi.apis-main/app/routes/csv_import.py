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
        # Load data
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(filepath, dtype=str)
        else:
            df = pd.read_excel(filepath, dtype=str)

        df = df.replace({np.nan: None})
        df.columns = [c.strip().lower() for c in df.columns]

        # Map columns
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

        # Basic Check for columns
        required_cols = ["first_name", "last_name", "status"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing required column: {col}")

        # ---------- NORMALIZATION ----------
        def clean_val(val):
            if val is None: return None
            s = str(val).strip()
            if s.lower() in ["", "none", "nan", "null"]: return None
            return s

        df["first_name"] = df["first_name"].apply(clean_val)
        df["last_name"] = df["last_name"].apply(clean_val)
        df["mobile"] = df["mobile"].apply(clean_val)
        df["email"] = df["email"].apply(lambda x: clean_val(x).lower() if clean_val(x) else None)
        df["gst"] = df["gst"].apply(clean_val)
        df["status_raw"] = df["status"].apply(clean_val)

        # Map status
        def map_status(val):
            if not val: return None
            norm = val.lower().replace(" ", "").replace("-", "")
            return STATUS_MAPPING.get(norm)

        df["status"] = df["status_raw"].apply(map_status)

        # ---------- VALIDATION & DEDUPLICATION ----------
        initial_count = len(df)
        records_to_import = []
        skipped_status = 0
        skipped_contact = 0
        skipped_internal_dup = 0
        skipped_db_dup = 0
        
        # Fetch existing data for DB check
        db_mobiles = {str(m[0]).strip() for m in db.session.query(Lead.mobile).all() if m[0]}
        db_emails = {str(e[0]).strip().lower() for e in db.session.query(Lead.email).all() if e[0]}
        db_gsts = {str(g[0]).strip().upper() for g in db.session.query(Lead.gst).all() if g[0]}

        seen_mobiles = set()
        seen_emails = set()
        seen_gsts = set()

        for idx, row in df.iterrows():
            # 1. Required Fields
            if not row["first_name"] or not row["last_name"]:
                continue # Skip unnamed leads or handle error? Let's skip safely.
            
            if row["status"] is None:
                skipped_status += 1
                continue
                
            # 2. Contact Method (Mobile or Email)
            m = row["mobile"]
            e = row["email"]
            g = row["gst"]
            if not m and not e:
                skipped_contact += 1
                continue
            
            # 3. Internal Duplicate Check
            is_internal_dup = False
            if m and m in seen_mobiles: is_internal_dup = True
            if e and e in seen_emails: is_internal_dup = True
            if g and g.upper() in seen_gsts: is_internal_dup = True
            
            if is_internal_dup:
                skipped_internal_dup += 1
                continue
            
            # 4. Database Duplicate Check
            is_db_dup = False
            if m and m in db_mobiles: is_db_dup = True
            if e and e in db_emails: is_db_dup = True
            if g and g.upper() in db_gsts: is_db_dup = True
            
            if is_db_dup:
                skipped_db_dup += 1
                continue
            
            # Mark as seen
            if m: seen_mobiles.add(m)
            if e: seen_emails.add(e)
            if g: seen_gsts.add(g.upper())
            
            records_to_import.append(row.to_dict())

        # ---------- INSERT DATA ----------
        for row in records_to_import:
            lead = Lead(
                first_name=row["first_name"],
                last_name=row["last_name"],
                mobile=row["mobile"],
                email=row["email"],
                gst=row["gst"],
                status=row["status"],
                reason=row.get("reason"),
            )
            set_created_fields(lead)
            set_business(lead)
            db.session.add(lead)
            db.session.flush()

            if row.get("address1"):
                address = Address(
                    address1=row["address1"],
                    address2=row.get("address2"),
                    city=row.get("city") or "",
                    state=row.get("state") or "",
                    country=row.get("country") or "",
                    pin=row.get("pin") or "",
                )
                set_created_fields(address)
                set_business(address)
                db.session.add(address)
                db.session.flush()

                db.session.add(LeadAddress(lead_id=lead.uuid, address_id=address.uuid))

        db.session.commit()

        return jsonify({
            "message": f"{len(records_to_import)} records imported successfully.",
            "details": {
                "total_rows": initial_count,
                "imported": len(records_to_import),
                "skipped_invalid_status": skipped_status,
                "skipped_no_contact": skipped_contact,
                "skipped_internal_duplicates": skipped_internal_dup,
                "skipped_database_duplicates": skipped_db_dup
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print("ERROR IN CSV IMPORT:")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500
