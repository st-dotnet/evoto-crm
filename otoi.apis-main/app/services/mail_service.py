import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app
import logging

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email, reset_link, user_name=""):
    """Send a password reset email with a reset link."""
    mail_username = current_app.config.get("MAIL_USERNAME")
    mail_password = current_app.config.get("MAIL_PASSWORD")
    mail_server = current_app.config.get("MAIL_SERVER", "smtp.gmail.com")
    mail_port = current_app.config.get("MAIL_PORT", 587)

    if not mail_username or not mail_password:
        logger.error("Mail credentials not configured")
        raise Exception("Mail service not configured")

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
                <p>&copy; OTOI CRM. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["From"] = mail_username
    msg["To"] = to_email
    msg["Subject"] = subject

    # Plain text fallback
    text_body = f"""
Hi{(' ' + user_name) if user_name else ''},

We received a request to reset the password for your account.

Click this link to reset your password: {reset_link}

This link will expire in 10 minutes and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

- OTOI CRM
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(mail_server, mail_port) as server:
            server.starttls()
            server.login(mail_username, mail_password)
            server.send_message(msg)
        logger.info(f"Password reset email sent to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP authentication failed")
        raise Exception("Email service authentication failed")
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {str(e)}")
        raise Exception(f"Failed to send email: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error sending email: {str(e)}")
        raise Exception(f"Failed to send email: {str(e)}")
