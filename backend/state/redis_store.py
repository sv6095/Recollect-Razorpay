import redis.asyncio as aioredis
import json
import time
from typing import Optional, AsyncIterator
from config import get_settings

settings = get_settings()

# ─── Connection ──────────────────────────────────────────────────────────────

_pool: Optional[aioredis.ConnectionPool] = None
_client: Optional[aioredis.Redis] = None


async def init_redis() -> aioredis.Redis:
    global _pool, _client
    try:
        _pool = aioredis.ConnectionPool.from_url(
            settings.redis_url, max_connections=50, decode_responses=True
        )
        _client = aioredis.Redis(connection_pool=_pool)
        await _client.ping()
    except Exception:
        # Fallback to fakeredis for dev without Docker
        import fakeredis.aioredis as fakeredis
        _client = fakeredis.FakeRedis(decode_responses=True)
    return _client


async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = await init_redis()
    return _client


async def close_redis():
    global _client, _pool
    if _client:
        await _client.aclose()
        _client = None


# ─── Transaction State (hot path) ────────────────────────────────────────────

async def get_transaction_state(txn_id: str) -> Optional[dict]:
    r = await get_redis()
    key = f"state:{txn_id}"
    data = await r.get(key)
    return json.loads(data) if data else None


async def set_transaction_state_cas(txn_id: str, expected_version: int,
                                     new_state: str, new_version: int) -> bool:
    """Compare-and-swap: only update if current version == expected_version."""
    r = await get_redis()
    key = f"state:{txn_id}"

    async with r.pipeline(transaction=True) as pipe:
        try:
            await pipe.watch(key)
            current = await pipe.get(key)
            current_data = json.loads(current) if current else {"version": -1}
            if current_data.get("version", -1) != expected_version:
                await pipe.reset()
                return False
            pipe.multi()
            pipe.set(key, json.dumps({"state": new_state, "version": new_version}))
            await pipe.execute()
            return True
        except aioredis.WatchError:
            return False


async def force_set_state(txn_id: str, state: str, version: int) -> None:
    """Non-CAS set, for initialisation."""
    r = await get_redis()
    await r.set(f"state:{txn_id}", json.dumps({"state": state, "version": version}))


# ─── DND Set ─────────────────────────────────────────────────────────────────

async def is_dnd(customer_id: str) -> bool:
    r = await get_redis()
    return bool(await r.sismember("dnd:global", customer_id))


async def add_dnd(customer_id: str) -> None:
    r = await get_redis()
    await r.sadd("dnd:global", customer_id)


# ─── Velocity / Rate Limiting (sliding window ZSET) ─────────────────────────

async def check_and_increment_velocity(customer_id: str, max_per_24h: int = 2) -> bool:
    """Returns True if contact is allowed (under limit), False if blocked."""
    r = await get_redis()
    key = f"velocity:{customer_id}"
    now = time.time()
    window_start = now - 86400  # 24h

    async with r.pipeline(transaction=True) as pipe:
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        results = await pipe.execute()

    count = results[1]
    if count >= max_per_24h:
        return False

    # Record this contact attempt
    await r.zadd(key, {str(now): now})
    await r.expire(key, 86400)
    return True


async def get_contact_count(customer_id: str) -> int:
    r = await get_redis()
    key = f"velocity:{customer_id}"
    now = time.time()
    window_start = now - 86400
    await r.zremrangebyscore(key, 0, window_start)
    return await r.zcard(key)


# ─── Recovery Probability Cache ──────────────────────────────────────────────

async def get_cached_recovery_prob(fingerprint: str) -> Optional[float]:
    r = await get_redis()
    val = await r.get(f"recprob:{fingerprint}")
    return float(val) if val else None


async def cache_recovery_prob(fingerprint: str, prob: float, ttl: int = 3600) -> None:
    r = await get_redis()
    await r.set(f"recprob:{fingerprint}", str(prob), ex=ttl)


# ─── Idempotency Keys ────────────────────────────────────────────────────────

async def check_idempotency(key: str, ttl: int = 604800) -> bool:
    """Returns True if action should proceed (key not seen before), False if duplicate."""
    r = await get_redis()
    acquired = await r.set(f"idem:{key}", "1", nx=True, ex=ttl)
    return bool(acquired)


# ─── Distributed Lock ────────────────────────────────────────────────────────

async def acquire_lock(customer_id: str, ttl: int = 15) -> bool:
    r = await get_redis()
    acquired = await r.set(f"lock:customer:{customer_id}", "1", nx=True, ex=ttl)
    return bool(acquired)


async def release_lock(customer_id: str) -> None:
    r = await get_redis()
    await r.delete(f"lock:customer:{customer_id}")


# ─── Pub/Sub (WebSocket fan-out) ─────────────────────────────────────────────

EVENTS_CHANNEL = "recovery_events"


async def publish_event(event: dict) -> None:
    r = await get_redis()
    await r.publish(EVENTS_CHANNEL, json.dumps(event))


async def subscribe_events() -> AsyncIterator[dict]:
    """Async generator that yields events from the Redis Pub/Sub channel."""
    r = await get_redis()
    # For fakeredis compatibility, create a new connection
    try:
        pubsub = r.pubsub()
        await pubsub.subscribe(EVENTS_CHANNEL)
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    yield json.loads(message["data"])
                except json.JSONDecodeError:
                    pass
    except Exception:
        # fakeredis fallback: yield nothing, WebSocket will use in-memory queue
        return
