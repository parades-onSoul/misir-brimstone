"""
Misir Backend v1.0 — shiro.exe

Domain-Driven Design with:
- OSCL (Online Semantic Centroid Learning)
- WESA (Weighted Engagement Signal Accumulation)
- SDD (Semantic Drift Detection)
- ISS (Implicit Semantic Search)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.logging_config import configure_logging, get_logger
from interfaces.api import capture_router
from interfaces.api.spaces import router as spaces_router
from interfaces.api.search import router as search_router

# Initialize structured logging
configure_logging(log_level=settings.LOG_LEVEL)
logger = get_logger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^(chrome|moz)-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metrics
from core.middleware.metrics import MetricsMiddleware, metrics_endpoint
app.add_middleware(MetricsMiddleware)
app.add_route("/metrics", metrics_endpoint)

# Rate Limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Global exception handler for debugging
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and log them."""
    import logging
    logger = logging.getLogger(__name__)
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )


@app.get("/")
def root():
    """Health check / info endpoint."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "codename": settings.CODENAME,
        "status": "online",
        "architecture": "Domain-Driven Design",
        "algorithms": ["OSCL", "WESA", "SDD", "ISS"]
    }


@app.get("/health")
def health():
    """Simple health check."""
    return {"status": "healthy"}


# Mount API routers
app.include_router(
    capture_router,
    prefix=f"{settings.API_V1_STR}/artifacts",
    tags=["Artifacts"]
)

from interfaces.api.batch import router as batch_router
app.include_router(
    batch_router,
    prefix=f"{settings.API_V1_STR}/artifacts",
    tags=["Batch"]
)

from interfaces.api.artifacts import router as artifacts_router
app.include_router(
    artifacts_router,
    prefix=f"{settings.API_V1_STR}/artifacts",
    tags=["Artifacts"]
)

app.include_router(
    spaces_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Spaces"]
)

app.include_router(
    search_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Search"]
)

# Internal Dashboard (no prefix - served at /dashboard)
from interfaces.api.dashboard import router as dashboard_router
app.include_router(
    dashboard_router,
    tags=["Internal"]
)
