from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import relationship
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.business import user_business
from datetime import datetime
import uuid

class Role(db.Model):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    users = relationship("User", back_populates="role")


class User(BaseMixin, db.Model):
    __tablename__ = "users"
    uuid = db.Column(postgresql.UUID(), primary_key=True, default=uuid.uuid4)
    firstName = Column(String(80), nullable=False)
    lastName = Column(String(80), nullable=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    mobileNo = Column(String(10), unique=True, nullable=False)
    password_hash = Column(String(), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    isActive = Column(db.Boolean, default=True, nullable=False)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    isUT = Column(db.Boolean, default=False, nullable=False)
    # Relationships
    role = relationship("Role", back_populates="users")
    businesses = relationship("Business", secondary=user_business, back_populates="users")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_ut_status(self):
        from app.models.location import UnionTerritory
        if not self.state:
            self.isUT = False
            return

        # Mapping of ISO codes to their full names as stored in union_territories table
        ut_mapping = {
            "AN": "Andaman and Nicobar Islands",
            "CH": "Chandigarh",
            "DH": "Dadra and Nagar Haveli and Daman and Diu",
            "DL": "Delhi",
            "JK": "Jammu and Kashmir",
            "LA": "Ladakh",
            "LD": "Lakshadweep",
            "PY": "Puducherry"
        }

        # Clean the input state
        clean_state = self.state.strip()
        
        # Check if the input is an ISO code we recognize
        search_name = ut_mapping.get(clean_state.upper(), clean_state)

        # Case-insensitive check against territory_name
        ut = UnionTerritory.query.filter(UnionTerritory.territory_name.ilike(search_name)).first()
        self.isUT = ut is not None

    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"