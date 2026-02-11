-- Query 1: Check if Insights are being generated
-- If count > 0: Backend is auto-generating insights (Job 43 is 1h)
-- If count = 0: Need to build alert generation (Job 43 is 4h)
SELECT COUNT(*) as insight_count, severity, headline
FROM misir.insight
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY severity, headline;

-- Query 2: Check if Centroid History is being logged
-- If count > 0: Centroids are logged (Job 20 backend done)
-- If count = 0: Need to add logging trigger
SELECT COUNT(*) as centroid_history_count 
FROM misir.subspace_centroid_history;

-- Query 3: Check distinct Engagement Levels
-- Verify these match definitions in your frontend: latent, discovered, engaged, saturated
SELECT DISTINCT engagement_level, COUNT(*) 
FROM misir.artifact
GROUP BY engagement_level;

-- Query 4: Check implementation of Drift Events
-- If count > 0: Drift is working (Job 45a is 1h)
SELECT COUNT(*) as recent_drift_events 
FROM misir.subspace_drift
WHERE occurred_at > NOW() - INTERVAL '30 days';

-- Query 5: Check implementation of Velocity Tracking
-- If count > 0: Velocity is working (Job 45b is 1h)
SELECT COUNT(*) as velocity_measurements 
FROM misir.subspace_velocity
WHERE measured_at > NOW() - INTERVAL '30 days';
