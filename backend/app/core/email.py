import logging
import os
import smtplib
from email.message import EmailMessage

from pathlib import Path
from dotenv import load_dotenv

from app.core.settings import settings

logger = logging.getLogger(__name__)

_backend_dir = Path(__file__).resolve().parents[2]
_root_dir = Path(__file__).resolve().parents[3]
load_dotenv(_root_dir / ".env", override=True)
load_dotenv(_backend_dir / ".env", override=True)

async def send_email(to_email: str, subject: str, body: str, html_body: str = None):
    load_dotenv(_root_dir / ".env", override=True)
    load_dotenv(_backend_dir / ".env", override=True)
    smtp_server = os.getenv("SMTP_SERVER") or settings.SMTP_SERVER
    smtp_port = os.getenv("SMTP_PORT") or settings.SMTP_PORT
    smtp_user = os.getenv("SMTP_USER") or settings.SMTP_USER
    smtp_password = os.getenv("SMTP_PASSWORD") or settings.SMTP_PASSWORD
    if smtp_password:
        smtp_password = str(smtp_password).replace(" ", "")
    
    # For development, if no SMTP server is configured, just log the email
    if not smtp_server:
        logger.warning(f"Simulating email to {to_email} with subject '{subject}'. Body:\\n{body}")
        print(f"\\n--- EMAIL TO: {to_email} ---\\nSUBJECT: {subject}\\n{body}\\n---------------------------\\n", flush=True)
        try:
            with open("emails.log", "a") as f:
                f.write(f"\\n--- EMAIL TO: {to_email} ---\\nSUBJECT: {subject}\\n{body}\\n---------------------------\\n")
        except Exception:
            pass
        return

    try:
        msg = EmailMessage()
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype='html')
        msg['Subject'] = subject
        msg['From'] = smtp_user or "noreply@example.com"
        msg['To'] = to_email

        with smtplib.SMTP(smtp_server, int(smtp_port or 587)) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info(f"Successfully sent email to {to_email}")
        print(f"[EMAIL] Successfully sent email to {to_email}", flush=True)
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        print(f"[EMAIL ERROR] Failed to send email to {to_email}: {e}", flush=True)
