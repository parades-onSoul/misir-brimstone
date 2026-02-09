"""
Enhanced Webhook Service with Retry Logic and Event Delivery Tracking.

Handles:
- Subscription management  
- Event dispatching
- Signature generation (HMAC/SHA256)
- Delivery logging with retry logic
- Exponential backoff for failed deliveries
"""
import asyncio
import hmac
import hashlib
import json
import logging
import time
import httpx
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from functools import partial

from core.config import get_settings
from infrastructure.repositories.base import get_supabase_client

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing and dispatching webhooks with retry logic."""
    
    MAX_RETRIES = 5
    INITIAL_RETRY_DELAY = 1  # seconds
    MAX_RETRY_DELAY = 300    # 5 minutes
    
    def __init__(self):
        self._client = get_supabase_client()
        self._settings = get_settings()
    
    async def dispatch_event(self, user_id: str, event_type: str, payload: Dict[str, Any]) -> bool:
        """
        Dispatch an event to all active subscriptions for a user.
        
        Args:
            user_id: User ID owner of the event
            event_type: Type of event (e.g. 'artifact.created')
            payload: Event data
            
        Returns:
            True if at least one webhook was dispatched
        """
        # 1. Fetch active subscriptions for this user and event type
        try:
            loop = asyncio.get_running_loop()
            
            def query_subscriptions():
                response = (
                    self._client.schema("misir")
                    .from_("webhook_subscription")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .execute()
                )
                return response.data or []
            
            subscriptions = await loop.run_in_executor(None, query_subscriptions)
            
        except Exception as e:
            logger.error(f"Failed to fetch subscriptions: {e}")
            return False

        if not subscriptions:
            logger.debug(f"No subscriptions found for user {user_id}")
            return False

        # 2. Dispatch to each subscriber (filter by event type)
        dispatched_count = 0
        for sub in subscriptions:
            if event_type in sub['events']:
                event_id = await self._create_webhook_event(sub['id'], event_type, payload)
                if event_id:
                    # Schedule delivery without blocking
                    asyncio.create_task(self._deliver_with_retry(event_id, sub))
                    dispatched_count += 1

        logger.info(f"Dispatched {dispatched_count} webhooks for {event_type}")
        return dispatched_count > 0

    async def _create_webhook_event(self, subscription_id: int, event_type: str, payload: Dict[str, Any]) -> Optional[int]:
        """Create a webhook event record for tracking."""
        try:
            loop = asyncio.get_running_loop()
            
            def insert_event():
                response = (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .insert({
                        "subscription_id": subscription_id,
                        "event_type": event_type,
                        "payload": payload,
                        "status": "pending",
                        "attempts": 0
                    })
                    .execute()
                )
                return response.data[0]['id'] if response.data else None
                
            return await loop.run_in_executor(None, insert_event)
            
        except Exception as e:
            logger.error(f"Failed to create webhook event: {e}")
            return None

    async def _deliver_with_retry(self, event_id: int, subscription: Dict[str, Any]) -> bool:
        """
        Deliver webhook with exponential backoff retry logic.
        
        Retry schedule: 1s, 2s, 4s, 8s, 16s, then 5min max
        """
        url = subscription['url']
        secret = subscription['secret']
        
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                # Update attempt count
                await self._update_event_attempt(event_id, attempt + 1)
                
                # Get current event payload
                event_data = await self._get_event_payload(event_id)
                if not event_data:
                    return False
                
                # Prepare full payload with metadata
                full_payload = {
                    "id": f"evt_{event_id}_{int(time.time()*1000)}",
                    "type": event_data['event_type'],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "data": event_data['payload']
                }
                json_payload = json.dumps(full_payload)
                
                # Generate signature
                signature = self._generate_signature(secret, json_payload)
                
                # Send request
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        url,
                        content=json_payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Misir-Signature": signature,
                            "X-Misir-Event": event_data['event_type'],
                            "User-Agent": f"Misir-Webhook/{self._settings.VERSION}",
                            "X-Misir-Delivery-Attempt": str(attempt + 1)
                        }
                    )
                    
                # Check if successful
                if 200 <= response.status_code < 300:
                    await self._mark_event_success(event_id)
                    logger.info(f"Webhook delivered successfully: {event_id} to {url}")
                    return True
                else:
                    logger.warning(f"Webhook returned {response.status_code}: {event_id}")
                    
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.warning(f"Webhook delivery attempt {attempt + 1} failed: {e}")
            except Exception as e:
                logger.error(f"Unexpected webhook delivery error: {e}")
            
            # If not last attempt, wait before retry with exponential backoff
            if attempt < self.MAX_RETRIES:
                delay = min(
                    self.INITIAL_RETRY_DELAY * (2 ** attempt),
                    self.MAX_RETRY_DELAY
                )
                logger.info(f"Retrying webhook {event_id} in {delay}s (attempt {attempt + 2})")
                await asyncio.sleep(delay)
        
        # All attempts failed
        await self._mark_event_failed(event_id)
        logger.error(f"Webhook delivery failed after {self.MAX_RETRIES + 1} attempts: {event_id}")
        return False
    
    async def _get_event_payload(self, event_id: int) -> Optional[Dict[str, Any]]:
        """Get event payload by ID."""
        try:
            loop = asyncio.get_running_loop()
            
            def query_event():
                response = (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .select("event_type, payload")
                    .eq("id", event_id)
                    .execute()
                )
                return response.data[0] if response.data else None
                
            return await loop.run_in_executor(None, query_event)
            
        except Exception as e:
            logger.error(f"Failed to get event payload: {e}")
            return None
    
    async def _update_event_attempt(self, event_id: int, attempt_count: int):
        """Update event attempt count and timestamp."""
        try:
            loop = asyncio.get_running_loop()
            
            def update_event():
                return (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .update({
                        "attempts": attempt_count,
                        "last_attempt_at": datetime.now(timezone.utc).isoformat(),
                        "status": "retrying" if attempt_count > 1 else "pending"
                    })
                    .eq("id", event_id)
                    .execute()
                )
                
            await loop.run_in_executor(None, update_event)
            
        except Exception as e:
            logger.error(f"Failed to update event attempt: {e}")
    
    async def _mark_event_success(self, event_id: int):
        """Mark event as successfully delivered."""
        try:
            loop = asyncio.get_running_loop()
            
            def update_status():
                return (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .update({"status": "success"})
                    .eq("id", event_id)
                    .execute()
                )
                
            await loop.run_in_executor(None, update_status)
            
        except Exception as e:
            logger.error(f"Failed to mark event success: {e}")
    
    async def _mark_event_failed(self, event_id: int):
        """Mark event as permanently failed."""
        try:
            loop = asyncio.get_running_loop()
            
            def update_status():
                return (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .update({"status": "failed"})
                    .eq("id", event_id)
                    .execute()
                )
                
            await loop.run_in_executor(None, update_status)

            
        except Exception as e:
            logger.error(f"Failed to mark event failed: {e}")
    
    async def retry_failed_events(self, max_events: int = 100) -> int:
        """
        Retry failed events (intended for background task).
        
        Args:
            max_events: Maximum number of events to retry
            
        Returns:
            Number of events queued for retry
        """
        try:
            loop = asyncio.get_running_loop()
            
            # Get failed events older than 1 hour
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)
            
            def query_failed():
                response = (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .select("id, subscription_id, webhook_subscription!inner(url, secret)")
                    .eq("status", "failed")
                    .lt("last_attempt_at", cutoff_time.isoformat())
                    .limit(max_events)
                    .execute()
                )
                return response.data or []
                
            failed_events = await loop.run_in_executor(None, query_failed)
            
            # Reset and retry each event
            retry_count = 0
            for event in failed_events:
                # Reset status for retry
                await self._reset_event_for_retry(event['id'])
                
                # Schedule retry
                subscription = event['webhook_subscription']
                asyncio.create_task(self._deliver_with_retry(event['id'], subscription))
                retry_count += 1
            
            logger.info(f"Initiated retry for {retry_count} failed webhook events")
            return retry_count
            
        except Exception as e:
            logger.error(f"Failed to retry events: {e}")
            return 0
    
    async def _reset_event_for_retry(self, event_id: int):
        """Reset event status for retry."""
        try:
            loop = asyncio.get_running_loop()
            
            def reset_status():
                return (
                    self._client.schema("misir")
                    .from_("webhook_event")
                    .update({
                        "status": "pending",
                        "attempts": 0
                    })
                    .eq("id", event_id)
                    .execute()
                )
                
            await loop.run_in_executor(None, reset_status)
            
        except Exception as e:
            logger.error(f"Failed to reset event for retry: {e}")

    def _generate_signature(self, secret: str, payload: str) -> str:
        """Generate HMAC-SHA256 signature."""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
