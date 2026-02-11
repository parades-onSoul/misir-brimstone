"""Interfaces API exports."""
from interfaces.api.capture import router as capture_router
from interfaces.api.analytics import router as space_analytics_router

__all__ = ['capture_router', 'space_analytics_router']
