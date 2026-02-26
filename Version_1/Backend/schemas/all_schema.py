# schemas/all_schema.py

from pydantic import BaseModel, ConfigDict, EmailStr, model_validator, Field
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    # This allows Pydantic to read SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    username: Optional[str] = None

class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# --- NEW: Password Reset Schemas ---
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

# UserResponse.model_rebuild()
