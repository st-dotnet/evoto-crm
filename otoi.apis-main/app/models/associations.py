from app.extensions import db

user_business = db.Table(
    "user_business",
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("business_id", db.Integer, db.ForeignKey("businesses.id"), primary_key=True)
)