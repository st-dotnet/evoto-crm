from sqlalchemy.dialects.postgresql import UUID
from app.extensions import db
from sqlalchemy.dialects.postgresql import UUID
import uuid

user_business = db.Table(
    "user_business",
    db.Column(
        "user_id",
        UUID(),
        db.ForeignKey("users.uuid"),
        primary_key=True
    ),
    db.Column(
        "business_id",
        db.Integer,
        db.ForeignKey("businesses.id"),
        primary_key=True
    )
)

