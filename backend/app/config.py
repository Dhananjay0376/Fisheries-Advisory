import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Fisheries Advisory API"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    DATABASE_URL: str = "sqlite:///./fisheries_advisory.db"
    
    # Twilio / SMS service variables
    TWILIO_ACCOUNT_SID: str = "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    TWILIO_AUTH_TOKEN: str = "your_auth_token_here"
    TWILIO_PHONE_NUMBER: str = "+1234567890"
    
    SECRET_KEY: str = "replace-with-a-real-secure-key"
    ADMIN_API_KEY: str = "dev-admin-secret-key"

    # Allow reading from environment or .env file
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
