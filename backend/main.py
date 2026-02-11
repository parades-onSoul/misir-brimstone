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
from interfaces.api.subspaces import router as subspaces_router
from interfaces.api.search import router as search_router
from interfaces.api.analytics import router as analytics_router, global_router as global_analytics_router
from interfaces.api.insights import router as insights_router
from interfaces.api.profile import router as profile_router

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


# Error Handling - RFC 9457 (Problem Details for HTTP APIs)
from pydantic import ValidationError
from fastapi_problem.error import Problem
from fastapi_problem.handler import new_exception_handler
from core.error_handlers import (
    pydantic_validation_error_handler,
    value_error_handler,
    generic_exception_handler
)

# Register RFC 9457 Problem exception handler
app.add_exception_handler(Problem, new_exception_handler())

# Register error handlers in order of specificity
app.add_exception_handler(ValidationError, pydantic_validation_error_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)


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
    subspaces_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Subspaces"]
)

app.include_router(
    search_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Search"]
)

app.include_router(
    global_analytics_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Analytics"]
)

app.include_router(
    analytics_router,
    prefix=f"{settings.API_V1_STR}/spaces",
    tags=["Analytics"]
)
app.include_router(
    insights_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Insights"]
)

app.include_router(
    profile_router,
    prefix=f"{settings.API_V1_STR}",
    tags=["Profile"]
)


# Internal Dashboard (no prefix - served at /dashboard)
from interfaces.api.dashboard import router as dashboard_router
app.include_router(
    dashboard_router,
    tags=["Internal"]
)
