# router/auth_routes.py
import os
import uuid
import random
import json # Added for clean serialization
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth

from database.postgresConn import get_db
from models.all_model import User as UserModel
from schemas.all_schema import TokenWithUser, UserCreate, ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest
from auth import hashing, token
from utilis.email_otp import send_otp_email

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

# --- Configuration for Google OAuth ---
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.post("/login", response_model=TokenWithUser)
def login(
    request: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(UserModel).filter(UserModel.email == request.username).first()

    if not user or not hashing.Hash.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = token.create_access_token(data={"sub": user.email})
  
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user 
    }

@router.get("/login/google")
async def login_via_google(request: Request):
    """Redirects the user to Google without a role requirement."""
    redirect_uri = request.url_for('auth_google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        # 1. Exchange the code for a token
        google_token = await oauth.google.authorize_access_token(request)
        user_info = google_token.get('userinfo')
    except Exception as e:
        # If this fails, it's usually because the Redirect URI in the console 
        # doesn't match the one the code was generated with
        raise HTTPException(status_code=401, detail=f"Google Auth Failed: {e}")

    user_email = user_info['email']
    user = db.query(UserModel).filter(UserModel.email == user_email).first()

    # 2. Create user if they don't exist in the fresh Supabase DB
    if not user:
        user = UserModel(
            email=user_email,
            full_name=user_info.get('name'),
            hashed_password=hashing.Hash.bcrypt(str(uuid.uuid4()))
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 3. Create your App JWT
    app_jwt = token.create_access_token(
        data={"sub": user.email, "user_id": user.id}
    )

    # 4. Prepare clean JSON payload for the frontend
    user_payload = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name
    }

    # 5. Send data back to the frontend window and close the popup
    return HTMLResponse(content=f"""
        <html>
            <body>
                <script>
                    (function() {{
                        const payload = {{
                            "token": "{app_jwt}",
                            "user": {json.dumps(user_payload)}
                        }};
                        // Explicitly target the frontend port
                        if (window.opener) {{
                            window.opener.postMessage(payload, "http://localhost:5173");
                            window.close();
                        }} else {{
                            console.error("No opener window found.");
                        }}
                    }})();
                </script>
            </body>
        </html>
    """)

# -------------------------------------------------------
# 1. FORGOT PASSWORD (Generate OTP & Send Email)
# -------------------------------------------------------
@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == request.email).first()
    
    if not user:
        return {"message": "If your email is registered, you will receive an OTP."}

    otp = str(random.randint(100000, 999999))
    
    user.reset_token = otp
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    email_status = send_otp_email(user.email, otp)
    
    if not email_status:
        raise HTTPException(status_code=500, detail="Failed to send email. Check server logs.")

    return {"message": "OTP sent successfully to your email."}


# -------------------------------------------------------
# 2. VERIFY OTP
# -------------------------------------------------------
@router.post("/verify-otp")
def verify_otp(request: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.reset_token != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    if not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    return {"message": "OTP Verified. Proceed to reset password."}


# -------------------------------------------------------
# 3. RESET PASSWORD
# -------------------------------------------------------
@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.reset_token != request.otp:
        raise HTTPException(status_code=400, detail="Invalid request. OTP mismatch.")
        
    if user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    user.hashed_password = hashing.Hash.bcrypt(request.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    
    db.commit()
    
    return {"message": "Password reset successfully. Please login with new password."}