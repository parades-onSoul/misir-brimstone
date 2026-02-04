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
from interfaces.api import capture_router
from interfaces.api.spaces import router as spaces_router
from interfaces.api.search import router as search_router

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
