# backend/utils/email_otp.py
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv()

def send_otp_email(to_email: str, otp_code: str):
    """
    Sends a 6-digit OTP using Twilio SendGrid.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    sender = os.getenv("SENDER_EMAIL")

    if not api_key or not sender:
        print("❌ Error: Missing SendGrid Credentials in .env")
        return False

    message = Mail(
        from_email=sender,
        to_emails=to_email,
        subject='StockMaster: Password Reset OTP',
        html_content=f'''
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                <h2>Password Reset Request</h2>
                <p>Use the code below to reset your password. This code expires in 10 minutes.</p>
                <h1 style="color: #007bff; letter-spacing: 5px;">{otp_code}</h1>
                <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
        '''
    )
    
    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        print(f"✅ Email sent to {to_email} | Status: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False