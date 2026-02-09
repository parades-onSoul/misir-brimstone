"""
Metrics middleware for performance monitoring.

Tracks request latency, throughput, and error rates using Prometheus.
"""
import time
from typing import Callable
from fastapi import Request, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match


# Define metrics
REQUEST_COUNT = Counter(
    'misir_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'misir_http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

REQUEST_IN_PROGRESS = Gauge(
    'misir_http_requests_in_progress',
    'HTTP requests currently being processed',
    ['method', 'endpoint']
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP request metrics."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics endpoint itself
        if request.url.path == "/metrics":
            return await call_next(request)
        
        # Extract endpoint pattern (e.g., /api/v1/artifacts/{id})
        endpoint = request.url.path
        for route in request.app.routes:
            match, _ = route.matches(request.scope)
            if match == Match.FULL:
                endpoint = route.path
                break
        
        method = request.method
        
        # Track request
        REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
        
        # Measure latency
        start_time = time.time()
        try:
            response = await call_next(request)
            status = response.status_code
        except Exception as e:
            status = 500
            # Log the actual exception for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.exception(f"Error in {method} {endpoint}")
            raise e
        finally:
            duration = time.time() - start_time
            
            # Record metrics
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status).inc()
            REQUEST_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
        
        return response


async def metrics_endpoint(request: Request) -> Response:
    """Expose Prometheus metrics."""
    from fastapi import Response
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
