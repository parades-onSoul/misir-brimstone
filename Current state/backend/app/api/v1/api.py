from fastapi import APIRouter
from app.api.v1.endpoints import ingestion, extension

api_router = APIRouter()
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])
api_router.include_router(extension.router, prefix="/extension", tags=["extension"])
