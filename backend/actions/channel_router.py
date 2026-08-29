import logging
from models.transaction import Transaction, Channel
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def send_message(txn: Transaction, channel: Channel, message: str) -> dict:
    """
    Route outbound message to the appropriate channel.
    When live credentials are not set, channels are simulated via audit logs.
    """
    if channel == Channel.WHATSAPP:
        return await _send_whatsapp(txn, message)
    elif channel == Channel.EMAIL:
        return await _send_email(txn, message)
    elif channel == Channel.VOICE:
        return await _log_voice_transcript(txn, message)
    elif channel == Channel.RETRY:
        return await _schedule_retry(txn, message)
    else:
        logger.info(f"[Channel] No channel configured for {txn.transaction_id}")
        return {"status": "no_channel", "txn_id": txn.transaction_id}


async def _send_whatsapp(txn: Transaction, message: str) -> dict:
    """Send WhatsApp message via Twilio sandbox or simulate."""
    twilio_sid = settings.twilio_account_sid
    twilio_auth = settings.twilio_auth_token

    if twilio_sid and twilio_auth:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_auth)
            msg = client.messages.create(
                from_=settings.twilio_whatsapp_from,
                to=f"whatsapp:{txn.customer_phone}",
                body=message,
            )
            logger.info(f"[WhatsApp] Sent to {txn.customer_phone}: SID={msg.sid}")
            return {"status": "sent", "sid": msg.sid, "channel": "whatsapp"}
        except Exception as e:
            logger.error(f"[WhatsApp] Twilio error: {e}")
            return _simulate_send("whatsapp", txn, message)
    else:
        return _simulate_send("whatsapp", txn, message)


async def _send_email(txn: Transaction, message: str) -> dict:
    """Send email (simulated fallback)."""
    logger.info(f"[Email] → {txn.customer_email}: {message[:100]}...")
    return _simulate_send("email", txn, message)


async def _log_voice_transcript(txn: Transaction, script: str) -> dict:
    """Simulate AI voice call — log transcript to audit."""
    logger.info(f"[Voice] Simulated call to {txn.customer_phone}")
    return {
        "status": "simulated",
        "channel": "voice",
        "transcript": script[:500],
        "txn_id": txn.transaction_id,
        "waveform": "sim://voice/waveform",
    }


async def _schedule_retry(txn: Transaction, message: str) -> dict:
    """Log a scheduled retry (Redis delayed task simulation)."""
    logger.info(f"[Retry] Scheduled for {txn.transaction_id}: {message[:100]}")
    return {"status": "scheduled", "channel": "retry", "txn_id": txn.transaction_id}


def _simulate_send(channel: str, txn: Transaction, message: str) -> dict:
    logger.info(f"[{channel.upper()}][DISPATCH] → {txn.customer_name} ({txn.customer_phone}): {message[:100]}")
    return {"status": "simulated", "channel": channel, "txn_id": txn.transaction_id}
