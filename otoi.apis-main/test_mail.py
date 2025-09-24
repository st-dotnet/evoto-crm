import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

EMAIL_USER = "st.parassharma@gmail.com"
EMAIL_PASSWORD = "tsgjkbadtwqbxbxh"  

def send_test_email(to_email, subject, body):
    msg = MIMEMultipart()
    msg["From"] = EMAIL_USER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)
        print(f" Email sent to {to_email}!")
    except smtplib.SMTPAuthenticationError:
        print(" Authentication failed. Check your email/password or enable 'Less secure apps' in Gmail.")
    except smtplib.SMTPException as e:
        print(f" SMTP error: {str(e)}")
    except Exception as e:
        print(f" Unexpected error: {str(e)}")

if __name__ == "__main__":
    # Test 1: Send to yourself
    # send_test_email(
    #     to_email=EMAIL_USER,
    #     subject="Test Email (Standalone)",
    #     body="Hello from Python! If you see this, your SMTP setup works."
    # )

    # Test 2: Send to another address (optional)
    send_test_email(
        to_email="abhiofficial9284@gmail.com",
        subject="Test Email (Utility)",
        body="Hello! If you see this, your SMTP setup works."
    )
