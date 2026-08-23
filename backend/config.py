from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Groq
    groq_api_key: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""  # Razorpay Dashboard → Settings → Webhooks

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Database
    database_url: str = "recollect.db"

    # App
    app_env: str = "development"
    demo_mode: bool = True

    # Twilio (optional)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"

    # Agent models
    triage_model: str = "llama-3.3-70b-versatile"
    reasoning_model: str = "llama-3.3-70b-versatile"

    # Policy Gate thresholds
    max_contacts_per_24h: int = 2
    calling_hour_start: int = 8   # 8 AM IST
    calling_hour_end: int = 19    # 7 PM IST
    outreach_cost_inr: float = 5.0  # ₹5 per outreach attempt

    # Recovery scoring
    recovery_prob_cache_ttl: int = 3600  # 1 hour

    # Idempotency TTL
    idempotency_ttl_seconds: int = 604800  # 7 days


@lru_cache
def get_settings() -> Settings:
    return Settings()
