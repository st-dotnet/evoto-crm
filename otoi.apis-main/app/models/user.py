from app.models.common import BaseMixin
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import relationship
from app.extensions import db
from app.models.business import user_business
from datetime import datetime, timedelta
import uuid
import secrets
import bcrypt

class Role(db.Model):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)

    # Relationships
    users = relationship("User", back_populates="role")


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    id = Column(postgresql.UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(postgresql.UUID(), ForeignKey("users.uuid", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expiry = Column(DateTime, nullable=False, default=lambda: datetime.utcnow() + timedelta(days=7))
    used = Column(db.Boolean, default=False, nullable=False)

    # Relationship
    user = relationship("User", back_populates="reset_tokens")


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
    # Relationships
    role = relationship("Role", back_populates="users")
    businesses = relationship("Business", secondary=user_business, back_populates="users")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def __repr__(self):
        return f"<User(username={self.username}, email={self.email})>"