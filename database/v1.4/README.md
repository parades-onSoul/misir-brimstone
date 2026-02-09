# Database v1.4 - Analytics Support

**Date:** February 4, 2026
**Status:** Applied

## Summary

Adds comprehensive analytics tracking for subspace velocity and drift detection.

## Tables Added

1. **`misir.subspace_velocity`**
   - Tracks scalar velocity and displacement vectors
   - Enables trend analysis of centroid movement speed

2. **`misir.subspace_drift`**
   - Logs significant drift events when centroid moves > threshold
   - Stores before/after centroids and triggering signal

## Analytics Features

- **Velocity Tracking**: Monitor how fast subspace centroids are moving
- **Drift Detection**: Alert when centroids shift beyond normal bounds  
- **Historical Analysis**: Track evolution patterns over time

## How to Apply

```bash
psql misir -f database/v1.4/migration.sql
```

## RLS Policies

- Users can only view analytics for their own subspaces
- Read-only access (analytics are system-generated)