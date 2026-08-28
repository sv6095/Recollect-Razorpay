import json
import logging
from typing import Any, Optional
from groq import AsyncGroq
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Module-level Groq client (initialised in lifespan)
_groq_client: Optional[AsyncGroq] = None


def init_groq_client() -> AsyncGroq:
    global _groq_client
    _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


def get_groq_client() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = init_groq_client()
    return _groq_client


class BaseAgent:
    """
    Base class for all Re-Collect agents.
    Wraps Groq chat completions with JSON extraction and retry logic.
    """

    def __init__(self, model: str, agent_name: str):
        self.model = model
        self.agent_name = agent_name

    async def chat(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.2,
        json_mode: bool = True,
    ) -> str:
        """Call Groq and return the raw text content."""
        client = get_groq_client()
        full_messages = [{"role": "system", "content": system}] + messages

        response_format = {"type": "json_object"} if json_mode else {"type": "text"}

        try:
            completion = await client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format=response_format,
            )
            return completion.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"[{self.agent_name}] Groq call failed: {e}", exc_info=True)
            raise

    async def chat_json(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> dict:
        """Call Groq and parse the response as JSON."""
        raw = await self.chat(system, messages, max_tokens, temperature, json_mode=True)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"[{self.agent_name}] Failed to parse JSON: {raw[:200]}")
            return {}

    async def multi_turn(
        self,
        system: str,
        turns: list[dict],   # list of {"role": "user"|"assistant", "content": str}
        max_tokens: int = 512,
        temperature: float = 0.2,
    ) -> str:
        """Multi-turn conversation (for Arbiter pattern)."""
        return await self.chat(system, turns, max_tokens, temperature, json_mode=True)
