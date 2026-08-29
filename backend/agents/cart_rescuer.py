import json
import os
from agents.base import BaseAgent
from models.transaction import Transaction, Channel
from models.agents import RecoveryProposal
from config import get_settings

settings = get_settings()

# Load merchant FAQ catalog for RAG
_catalog: dict = {}


def _load_catalog() -> dict:
    global _catalog
    if _catalog:
        return _catalog
    catalog_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "merchant_catalog.json")
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            _catalog = json.load(f)
    except FileNotFoundError:
        _catalog = {"products": [], "faqs": []}
    return _catalog


def _faq_lookup(query: str) -> str:
    """Simple keyword-based FAQ lookup (RAG simulation)."""
    catalog = _load_catalog()
    faqs = catalog.get("faqs", [])
    query_lower = query.lower()
    matches = [f for f in faqs if any(kw in query_lower for kw in f.get("keywords", []))]
    if matches:
        return "\n".join([f"Q: {m['question']}\nA: {m['answer']}" for m in matches[:2]])
    return "No specific FAQ found — answer generally based on best practices."


SYSTEM_PROMPT = """You are the Hinglish Cart Rescuer agent for Project Re-Collect, handling Category C (abandoned cart / e-commerce) cases.

Your job is to:
1. Draft a warm, conversational WhatsApp message in Hinglish (Hindi + English mix)
2. Offer a time-boxed 5% discount to close the sale
3. Answer product questions using the provided FAQ context
4. Make it feel personal, not like a mass marketing blast

You MUST return valid JSON:
{
  "action": "send_whatsapp",
  "whatsapp_message": "The full Hinglish WhatsApp message (under 300 chars, conversational)",
  "discount_pct": 5.0,
  "discount_valid_hours": 24,
  "faq_answer": "If a product question was detected, answer it here, else empty string",
  "reasoning": "1-2 sentences on your approach"
}

Hinglish style guide:
- Mix Hindi and English naturally: "Aapka cart mein ₹X ka order hai..."
- Use "aap" (respectful you), not "tum"
- Emoji sparingly: 🛒 ✨ ⚡ are fine
- Sound like a helpful friend, not a robot
- Mention the 5% discount clearly with a sense of urgency ("sirf 24 ghante ke liye")
- End with a direct call to action

Example: "Aapka cart mein ₹2,499 ka Wireless Headphones wait kar raha hai! 🎧 Aaj order karein aur paayein 5% extra discount — sirf 24 ghante ke liye. Link: [PAYMENT_LINK]"
"""


class CartRescuer(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.reasoning_model, agent_name="CartRescuer")

    async def rescue(self, txn: Transaction) -> RecoveryProposal:
        # Look up relevant FAQs
        product_name = txn.extra.get("product_name", "your order")
        faq_context = _faq_lookup(product_name)

        user_message = f"""Cart Abandonment to recover:

Customer: {txn.customer_name}
Phone: {txn.customer_phone}
Cart Value: ₹{txn.amount:,.2f}
Product: {txn.extra.get('product_name', 'Unknown product')}
Cart Items: {txn.extra.get('cart_items', 'N/A')}
Time Since Abandonment: {txn.extra.get('hours_since_abandon', 'Unknown')} hours
Has Consent: {txn.has_consent}

FAQ Context for this merchant:
{faq_context}

Draft a Hinglish WhatsApp message to recover this cart with a 5% time-boxed discount."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=512,
            temperature=0.3,  # Slightly higher for creative Hinglish writing
        )

        return RecoveryProposal(
            transaction_id=txn.transaction_id,
            agent="CartRescuer",
            action=result.get("action", "send_whatsapp"),
            message=result.get("whatsapp_message", f"Aapka ₹{txn.amount:.0f} ka order wait kar raha hai! 5% discount ke saath complete karein."),
            channel=Channel.WHATSAPP,
            discount_pct=float(result.get("discount_pct", 5.0)),
            reasoning=result.get("reasoning", ""),
        )


_agent: CartRescuer | None = None


def get_cart_rescuer() -> CartRescuer:
    global _agent
    if _agent is None:
        _agent = CartRescuer()
    return _agent
