# Misir Algorithm Specification

> **Version:** 1.4  
> **Date:** February 4, 2026  
> **Status:** Production Ready

Misir is built on four core algorithms that work together to create a semantic attention tracking system.

## Algorithm Overview

| Algorithm | Full Name | Purpose |
|-----------|-----------|---------|
| **OSCL** | Online Semantic Centroid Learning | Incremental clustering and centroid updates |
| **WESA** | Weighted Engagement Signal Accumulation | Implicit feedback weighting system |
| **SDD** | Semantic Drift Detection | Track knowledge evolution over time |
| **ISS** | Implicit Semantic Search | Vector similarity search |

---

## 1️⃣ OSCL (Online Semantic Centroid Learning)

**Purpose:** Update subspace centroids incrementally as new content is consumed.

### Mathematical Foundation

**Core Formula:**
```
C_t = (1-α)C_{t-1} + αx_t
```

Where:
- `C_t` = centroid at time t
- `C_{t-1}` = previous centroid
- `α` = learning rate (default: 0.1)
- `x_t` = new signal vector

**Properties:**
- **Exponential Moving Average (EMA)**: Recent signals have more influence
- **Bounded Memory**: Doesn't require storing all historical vectors
- **Stable Convergence**: Learning rate controls adaptation speed

### Implementation

```python
def update_centroid(
    old_centroid: list[float],
    new_signal: list[float], 
    learning_rate: float = 0.1
) -> list[float]:
    """OSCL centroid update using EMA."""
    return [
        (1 - learning_rate) * old_val + learning_rate * new_val
        for old_val, new_val in zip(old_centroid, new_signal)
    ]
```

### Database Implementation
Implemented as PostgreSQL trigger function:

```sql
CREATE OR REPLACE FUNCTION misir.update_subspace_centroid()
RETURNS TRIGGER AS $$
DECLARE
    v_new_centroid vector(768);
    v_old_centroid vector(768);
    v_learning_rate FLOAT := 0.1;
BEGIN
    -- Get current centroid and learning rate
    SELECT centroid_embedding, learning_rate 
    INTO v_old_centroid, v_learning_rate
    FROM misir.subspace WHERE id = NEW.subspace_id;
    
    -- Apply OSCL formula: C_t = (1-α)C_{t-1} + αx_t
    v_new_centroid := (
        SELECT array_agg(
            (1 - v_learning_rate) * v_old_centroid[i] + 
            v_learning_rate * NEW.vector[i]
        )::vector(768)
        FROM generate_series(1, 768) as i
    );
    
    -- Update centroid
    UPDATE misir.subspace
    SET centroid_embedding = v_new_centroid,
        centroid_updated_at = NOW()
    WHERE id = NEW.subspace_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Configuration:**
- Learning rate stored per subspace (default: 0.1)
- History logging based on semantic distance threshold (default: 0.05)
- Minimum signals between logs (default: 5)

---

## 2️⃣ WESA (Weighted Engagement Signal Accumulation)

**Purpose:** Weight signals based on engagement intensity and temporal decay.

### Mathematical Foundation

**Core Formula:**
```
weight = base_weight × relevance × decay_factor
```

**Base Weight by Engagement Level:**
```
base_weight = {
    'latent':     0.2,  # Passive exposure
    'discovered': 0.5,  # Active awareness  
    'engaged':    1.0,  # Intentional interaction
    'saturated':  2.0   # Deep immersion
}
```

**Decay Factors:**
```
decay_factor = {
    'high':   0.5,   # Quick decay (news, social media)
    'medium': 0.75,  # Moderate decay (articles)
    'low':    0.9    # Slow decay (research, documentation)
}
```

**Relevance Calculation:**
```
relevance = marker_matches / total_markers
```

### Implementation

Database computed column:
```sql
ALTER TABLE misir.artifact
ADD COLUMN effective_weight FLOAT
    GENERATED ALWAYS AS (
        base_weight * relevance * 
        CASE decay_rate
            WHEN 'high' THEN 0.5
            WHEN 'medium' THEN 0.75
            WHEN 'low' THEN 0.9
        END
    ) STORED;
```

**Signal Magnitude:**
Signal strength is further modulated by:
- Reading depth (0.0 - 1.5)
- Dwell time relative to content length
- Scroll completion percentage

---

## 3️⃣ SDD (Semantic Drift Detection)

**Purpose:** Detect when knowledge domains are evolving significantly.

### Mathematical Foundation

**Drift Magnitude:**
```
drift = 1 - cosine_similarity(C_t, C_{t-1})
```

**Velocity Calculation:**
```
velocity = ||C_t - C_{t-1}|| / Δt
```

Where:
- `||·||` = Euclidean norm
- `Δt` = time between updates

### Drift Thresholds

| Threshold | Drift Magnitude | Interpretation |
|-----------|-----------------|----------------|
| **Low** | < 0.05 | Stable domain |
| **Medium** | 0.05 - 0.15 | Gradual evolution |
| **High** | 0.15 - 0.30 | Significant shift |
| **Critical** | > 0.30 | Domain transformation |

### Database Schema (v1.4)

**Velocity Tracking:**
```sql
CREATE TABLE misir.subspace_velocity (
    id BIGINT PRIMARY KEY,
    subspace_id BIGINT REFERENCES misir.subspace(id),
    velocity FLOAT NOT NULL,
    displacement FLOAT[] NOT NULL,  -- Vector displacement
    measured_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Drift Events:**
```sql
CREATE TABLE misir.subspace_drift (
    id BIGINT PRIMARY KEY,
    subspace_id BIGINT REFERENCES misir.subspace(id),
    drift_magnitude FLOAT NOT NULL,
    previous_centroid FLOAT[] NOT NULL,
    new_centroid FLOAT[] NOT NULL,
    trigger_signal_id BIGINT REFERENCES misir.signal(id),
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Drift Detection Algorithm

```python
async def detect_drift(
    subspace_id: int,
    new_centroid: list[float],
    threshold: float = 0.05
) -> Optional[DriftEvent]:
    """Detect semantic drift in subspace."""
    
    # Get previous centroid
    old_centroid = await get_previous_centroid(subspace_id)
    if not old_centroid:
        return None
    
    # Calculate drift magnitude
    drift = 1 - cosine_similarity(new_centroid, old_centroid)
    
    if drift >= threshold:
        return DriftEvent(
            subspace_id=subspace_id,
            drift_magnitude=drift,
            previous_centroid=old_centroid,
            new_centroid=new_centroid,
            occurred_at=datetime.utcnow()
        )
    
    return None
```

---

## 4️⃣ ISS (Implicit Semantic Search)

**Purpose:** Fast approximate nearest neighbor search over high-dimensional vectors.

### Mathematical Foundation

**Similarity Metric:**
```
similarity = 1 - cosine_distance(query_vector, document_vector)
```

**Cosine Similarity:**
```
cosine_sim(A, B) = (A · B) / (||A|| × ||B||)
```

### HNSW Index Implementation

**PostgreSQL pgvector with HNSW:**
```sql
-- Create HNSW index for fast vector search
CREATE INDEX idx_artifact_content_embedding_hnsw 
ON misir.artifact 
USING hnsw (content_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);
```

**Index Parameters:**
- `m = 16`: Number of bi-directional links for each node
- `ef_construction = 128`: Size of candidate list during construction
- Higher values = better recall, slower construction

### Search Algorithm

```python
async def semantic_search(
    query_vector: list[float],
    user_id: str,
    limit: int = 20,
    threshold: float = 0.7
) -> list[SearchResult]:
    """ISS semantic search implementation."""
    
    # Use HNSW index for approximate NN search
    query = f"""
        SELECT 
            a.id, a.title, a.url,
            1 - (a.content_embedding <=> %s::vector) as similarity
        FROM misir.artifact a
        WHERE a.user_id = %s
          AND a.deleted_at IS NULL
          AND 1 - (a.content_embedding <=> %s::vector) >= %s
        ORDER BY a.content_embedding <=> %s::vector
        LIMIT %s
    """
    
    return await execute_query(
        query, 
        [query_vector, user_id, query_vector, threshold, query_vector, limit]
    )
```

**Performance Characteristics:**
- **Time Complexity**: O(log N) average case
- **Space Complexity**: O(N × m) where m is connectivity
- **Recall**: ~95% with proper parameters
- **Latency**: <10ms for 1M+ vectors

---

## Assignment Margin (v1.1)

**Purpose:** Prevent centroid pollution from ambiguous signal assignments.

### Mathematical Foundation

**Margin Calculation:**
```
margin = d2 - d1
```

Where:
- `d1` = distance to closest centroid
- `d2` = distance to second-closest centroid

**Decision Rule:**
```
updates_centroid = margin >= threshold
```

Default threshold: 0.1

### Implementation

```python
async def calculate_assignment_margin(
    signal_vector: list[float],
    user_id: str,
    space_id: int
) -> Optional[float]:
    """Calculate assignment margin for signal."""
    
    # Get 2 closest centroids
    centroids = await get_closest_centroids(signal_vector, user_id, space_id, limit=2)
    
    if len(centroids) < 2:
        return None  # Need at least 2 centroids for margin
    
    d1 = 1 - cosine_similarity(signal_vector, centroids[0].embedding)
    d2 = 1 - cosine_similarity(signal_vector, centroids[1].embedding)
    
    return d2 - d1
```

**Benefits:**
- Prevents noise from ambiguous signals
- Maintains centroid stability
- Improves clustering quality

---

## Algorithm Interaction

### Signal Processing Pipeline

```
1. Artifact Capture
   ↓
2. Embedding Generation (768-dim vector)
   ↓  
3. Assignment Margin Calculation
   ↓
4. WESA Weight Calculation  
   ↓
5. OSCL Centroid Update (if margin > threshold)
   ↓
6. SDD Drift Detection
   ↓
7. ISS Index Update
```

### Configuration Parameters

| Algorithm | Parameter | Default | Range | Description |
|-----------|-----------|---------|--------|-------------|
| **OSCL** | learning_rate | 0.1 | 0.01-1.0 | EMA adaptation speed |
| **OSCL** | distance_threshold | 0.05 | 0.01-0.2 | History logging threshold |
| **WESA** | base_weights | [0.2,0.5,1.0,2.0] | 0.1-5.0 | Engagement multipliers |
| **SDD** | drift_threshold | 0.05 | 0.01-0.5 | Drift detection sensitivity |
| **ISS** | search_threshold | 0.7 | 0.0-1.0 | Minimum similarity |
| **Margin** | margin_threshold | 0.1 | 0.05-0.3 | Assignment confidence |

### Performance Benchmarks

| Operation | Latency (p95) | Throughput | Notes |
|-----------|---------------|------------|-------|
| **OSCL Update** | <5ms | 1000/sec | DB trigger |
| **WESA Calculation** | <1ms | - | Computed column |
| **SDD Detection** | <10ms | 100/sec | Background task |
| **ISS Search** | <50ms | 50/sec | HNSW index |
| **Margin Calculation** | <20ms | 200/sec | 2-NN search |

This algorithm specification provides the mathematical foundation for Misir's semantic attention tracking capabilities, ensuring consistent and predictable behavior across all system components.