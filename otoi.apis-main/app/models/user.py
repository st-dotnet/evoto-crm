from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.business import user_business
from datetime import datetime

class Role(db.Model):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    users = relationship("User", back_populates="role")


class User(db.Model):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    # Relationships
    role = relationship("Role", back_populates="users")
    businesses = relationship("Business", secondary=user_business, back_populates="users")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"