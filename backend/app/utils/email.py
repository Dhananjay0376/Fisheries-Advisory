import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

def send_email_advisory(to_email: str, subject: str, html_content: str) -> bool:
    """
    Dispatches a localized HTML email alert to a subscriber using the Resend REST API.
    """
    # Fallback/Mock behavior during testing if key is empty/default
    if not settings.RESEND_API_KEY or settings.RESEND_API_KEY == "your_resend_api_key_here":
        logger.warning("Resend API key is not configured. Mocking successful email dispatch.")
        # Return True for unit tests/local mock runs
        return True

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": "Fisheries Alerts <onboarding@resend.dev>",
        "to": to_email,
        "subject": subject,
        "html": html_content
    }

    try:
        response = httpx.post(url, json=payload, headers=headers, timeout=10.0)
        if response.status_code in (200, 201):
            logger.info(f"Email alert successfully dispatched to {to_email}")
            return True
        else:
            logger.error(f"Resend API error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"Exception during email dispatch to {to_email}: {str(e)}")
        return False
