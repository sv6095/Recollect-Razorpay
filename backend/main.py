import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.database import init_db, close_db
from state.redis_store import init_redis, close_redis
from agents.base import init_groq_client
from event_queue.event_bus import start_workers, stop_workers
from orchestrator.workflow import process_transaction
from seed import seed_if_empty
from api.ingest import router as ingest_router
from api.recovery import router as recovery_router
from api.websocket import router as ws_router
from api.webhook import router as webhook_router

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("recollect")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan: initialize all shared resources once at startup,
    never per-request. Clean shutdown on exit.
    """
    logger.info("🚀 Re-Collect starting up...")

    # 1. Database
    await init_db()
    logger.info("✅ Database initialized")

    # 2. Redis (with fakeredis fallback)
    await init_redis()
    logger.info("✅ Redis connected")

    # 3. Groq AI client
    init_groq_client()
    logger.info("✅ Groq client initialized")

    # 4. Worker pool (2 workers per category queue)
    await start_workers(process_transaction, workers_per_queue=2)
    logger.info("✅ Worker pool started (4 categories × 2 workers = 8 workers)")

    # 5. Seed demo data in background task so server becomes healthy immediately
    asyncio.create_task(seed_if_empty(stagger_seconds=0.3))

    yield

    # Graceful shutdown
    logger.info("🛑 Re-Collect shutting down...")
    await stop_workers()
    await close_db()
    await close_redis()
    logger.info("✅ Shutdown complete")


app = FastAPI(
    title="Project Re-Collect",
    description="AI Revenue Recovery Orchestrator — Razorpay Hackathon",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(ingest_router)
app.include_router(recovery_router, prefix="/api")
app.include_router(recovery_router, prefix="/api/demo")  # Compatibility alias
app.include_router(ws_router)
app.include_router(webhook_router)   # POST /api/webhooks/razorpay


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Project Re-Collect", "version": "1.0.0"}
