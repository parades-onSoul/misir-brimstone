from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Import auth (for re-export)
from app.core.auth import get_current_user

# Import routers (placeholder for now)
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
# Include extension origins for development
cors_origins = [str(origin) for origin in settings.CORS_ORIGINS]
cors_origins.extend([
    "chrome-extension://*",  # Chrome extensions
    "moz-extension://*",     # Firefox extensions
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^(chrome|moz)-extension://.*$",  # Allow all extension IDs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "message": "Misir Orientation Engine Online",
        "version": settings.VERSION,
        "codename": settings.CODENAME,
        "status": "active"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(api_router, prefix=settings.API_V1_STR)

# Export auth dependency for use in routers
__all__ = ["app", "get_current_user"]
