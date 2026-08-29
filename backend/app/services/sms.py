import logging
from twilio.rest import Client
from app.config import settings

logger = logging.getLogger("sms_service")
logging.basicConfig(level=logging.INFO)

class SMSService:
    def __init__(self):
        # In production, check if actual credentials are valid before using
        self.use_mock = (
            settings.TWILIO_ACCOUNT_SID == "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            or not settings.TWILIO_ACCOUNT_SID
            or not settings.TWILIO_AUTH_TOKEN
        )
        
        if not self.use_mock:
            try:
                self.client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}. Falling back to mock service.")
                self.use_mock = True

    def send_sms(self, to_number: str, message: str) -> dict:
        """
        Sends an SMS message.
        If credentials are mock templates, it logs the output and stores mock records.
        """
        if self.use_mock:
            logger.info(f"[MOCK SMS] Sending to {to_number}: {message}")
            return {
                "status": "success",
                "mode": "mock",
                "to": to_number,
                "message": message,
                "sid": f"SMmock_{hash(to_number + message)}"
            }
        else:
            try:
                message_resp = self.client.messages.create(
                    body=message,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=to_number
                )
                logger.info(f"[REAL SMS] Sent to {to_number}, SID: {message_resp.sid}")
                return {
                    "status": "success",
                    "mode": "production",
                    "to": to_number,
                    "sid": message_resp.sid
                }
            except Exception as e:
                logger.error(f"Error sending real SMS to {to_number}: {e}")
                return {
                    "status": "failed",
                    "error": str(e),
                    "to": to_number
                }

sms_service = SMSService()
