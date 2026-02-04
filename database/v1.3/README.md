# Database v1.3 - Webhook Support

**Date:** February 4, 2026
**Status:** Pending Application

## Summary

Adds support for event-driven webhooks.

## Tables Added

1.  **`misir.webhook_subscription`**
    *   Stores user subscriptions (URL, events, signing secret).
2.  **`misir.webhook_event`**
    *   Logs delivery attempts and status.

## Events

*   `artifact.created`
*   `artifact.updated`
*   `space.created`

## How to Apply

```bash
psql misir -f database/v1.3/migration.sql
```
