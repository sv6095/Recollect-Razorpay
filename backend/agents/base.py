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
        max_tokens: int = 2048,
        temperature: float = 0.2,
        json_mode: bool = True,
    ) -> str:
        """Call Groq and return the raw text content."""
        client = get_groq_client()
        full_messages = [{"role": "system", "content": system}] + [dict(m) for m in messages]

        if json_mode:
            # Groq JSON mode strictly requires prompt to contain the word 'JSON'
            has_json = any("json" in str(m.get("content", "")).lower() for m in full_messages)
            if not has_json and full_messages:
                full_messages[-1]["content"] = str(full_messages[-1].get("content", "")) + "\nReturn a valid JSON object."

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
            err_str = str(e).lower()
            if "rate_limit" in err_str or "429" in err_str:
                logger.warning(f"[{self.agent_name}] Groq TPM rate limit hit — activating instant heuristic fallback")
                return ""
            if json_mode:
                logger.warning(f"[{self.agent_name}] Groq JSON mode retry in text mode: {e}")
                try:
                    completion = await client.chat.completions.create(
                        model=self.model,
                        messages=full_messages,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        response_format={"type": "text"},
                    )
                    return completion.choices[0].message.content or ""
                except Exception as e2:
                    logger.error(f"[{self.agent_name}] Groq fallback call failed: {e2}")
                    return ""
            logger.error(f"[{self.agent_name}] Groq call failed: {e}")
            return ""

    async def chat_json(
        self,
        system: str,
        messages: list[dict],
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> dict:
        """Call Groq and parse the response as JSON."""
        import re
        # Ensure user message requests JSON
        prepared_messages = [dict(m) for m in messages]
        if prepared_messages and not any("json" in str(m.get("content", "")).lower() for m in prepared_messages):
            prepared_messages[-1]["content"] = str(prepared_messages[-1].get("content", "")) + "\nReturn your response as a valid JSON object."

        raw = await self.chat(system, prepared_messages, max_tokens, temperature, json_mode=True)
        if not raw:
            return {}

        # Strip reasoning models' <think>...</think> tags if present
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.DOTALL).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            m = re.search(r"\{[\s\S]*\}", cleaned)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
            logger.warning(f"[{self.agent_name}] JSON parse failed on output: {raw[:200]}")
            return {}

    async def multi_turn(
        self,
        system: str,
        turns: list[dict],   # list of {"role": "user"|"assistant", "content": str}
        max_tokens: int = 2048,
        temperature: float = 0.2,
    ) -> str:
        """Multi-turn conversation (for Arbiter pattern)."""
        return await self.chat(system, turns, max_tokens, temperature, json_mode=True)
