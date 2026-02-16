import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_reset_password_email(to_email, reset_link, user_name=None):
    mail_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    mail_port = int(os.getenv("MAIL_PORT", 587))
    sender_email = os.getenv("MAIL_SENDER")
    sender_password = os.getenv("MAIL_PASSWORD")

    if not sender_email or not sender_password:
        print("Error: MAIL_SENDER or MAIL_PASSWORD not set in environment")
        return False

    # msg = MIMEMultipart()   
    # msg["From"] = sender_email
    # msg["To"] = to_email
    # msg["Subject"] = "Password Reset Request"

    # body = f"Please click the following link to reset your password: {reset_link}\n\nThis link will expire in 10 minutes."
    # msg.attach(MIMEText(body, "plain"))
    subject = "Reset Your Password - Evoto technologies"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0; }}
            .container {{ max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #1B84FF 0%, #0D6EFD 100%); padding: 32px 24px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }}
            .body {{ padding: 32px 24px; }}
            .body p {{ color: #4B5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
            .btn {{ display: inline-block; background: #1B84FF; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }}
            .warning {{ background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }}
            .warning p {{ color: #92400E; font-size: 13px; margin: 0; }}
            .footer {{ text-align: center; padding: 20px 24px; border-top: 1px solid #E5E7EB; }}
            .footer p {{ color: #9CA3AF; font-size: 12px; margin: 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Request</h1>
                <p style="color: #ffffff; font-size: 14px; opacity: 0.8;">Evoto technologies</p>
            </div>
            <div class="body">
                <p>Hi{(' ' + user_name) if user_name else ''},</p>
                <p>We received a request to reset the password for your account. Click the button below to set a new password:</p>
                <div style="text-align: center;">
                    <a href="{reset_link}" class="btn">Reset Password</a>
                </div>
                <div class="warning">
                    <p><strong>⏰ This link will expire in 10 minutes</strong> and can only be used once.</p>
                </div>
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            </div>
            <div class="footer">
                <p>&copy; EVOTO Technologies. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_body = f"""
Hi{(' ' + user_name) if user_name else ''},

We received a request to reset the password for your account.

Click this link to reset your password: {reset_link}

This link will expire in 10 minutes and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

- EVOTO Technologies
    """

    msg = MIMEMultipart("alternative")
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False
