# Backend Redesign Guide for Schema v1.0

> **Purpose:** Align backend with production database schema v1.0  
> **Key Changes:** Config-driven architecture, semantic distance logging, junction tables  
> **Impact:** Critical changes required for production deployment

---

## 🎯 Executive Summary

### What Changed in Schema v1.0?

| Change | Impact | Action Required |
|--------|--------|-----------------|
| **Config-driven constants** | All constants in `system_config` | ✅ CRITICAL: Fetch from DB, not hardcoded |
| **Dimension validation** | Loads from config, not hardcoded 768 | ✅ Update embedding validation |
| **Semantic distance logging** | Centroid history based on movement | ℹ️ Informational (DB-side only) |
| **Junction table for markers** | No more JSONB `markers` column | ✅ Update queries to use `subspace_marker` |
| **Reading depth formula** | Config-driven, must match exactly | ✅ CRITICAL: Use DB config values |
| **Transaction helper** | New RPC function for inserts | ✅ Recommended: Use instead of manual INSERT |

---

## 📋 Critical Changes Checklist

**Must Do (Backend Won't Work Without These):**
- [ ] Fetch `reading_depth_constants` from `system_config` before calculating
- [ ] Fetch `embedding_model.dimension` from `system_config` for validation
- [ ] Update marker queries to use `subspace_marker` junction table
- [ ] Use `insert_artifact_with_signal()` RPC function (recommended)

**Should Do (Best Practices):**
- [ ] Cache system_config values with invalidation strategy
- [ ] Implement config refresh on update
- [ ] Use semantic ENUM ordering for `engagement_level`
- [ ] Test dimension validation with different models

**Can Skip (DB Handles These):**
- URL normalization (DB trigger handles)
- Domain extraction (DB trigger handles)
- Centroid updates (DB trigger handles)
- Centroid history logging (DB trigger handles)

---

## 1. Config-Driven Architecture 🔧

### The Problem

❌ **Old Backend (Broken with v1.0):**
```typescript
// HARDCODED - Will drift from database
const AVG_WPM = 200;
const TIME_WEIGHT = 0.6;
const SCROLL_WEIGHT = 0.4;
const EMBEDDING_DIM = 768;

function calculateReadingDepth(wordCount, dwellTimeMs, scrollDepth) {
  const expectedTimeMs = (wordCount * 60000) / AVG_WPM;
  const timeRatio = Math.min(1.5, dwellTimeMs / expectedTimeMs);
  return (timeRatio * TIME_WEIGHT) + (scrollDepth * SCROLL_WEIGHT);
}

function validateEmbedding(embedding) {
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Expected ${EMBEDDING_DIM} dimensions`);
  }
}
```

**Why This Fails:**
- Database uses values from `system_config`
- Constants can be tuned in production without code changes
- Dimension check in DB now loads from config (not hardcoded 768)
- Reading depth validation will warn on mismatch

---

### The Solution

✅ **New Backend (v1.0 Compatible):**

#### Option 1: Fetch Each Time (Simple)
```typescript
async function getSystemConfig(key: string) {
  const { data, error } = await supabase
    .from('misir.system_config')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) throw error;
  return data.value;
}

async function calculateReadingDepth(
  wordCount: number,
  dwellTimeMs: number,
  scrollDepth: number
): Promise<number> {
  // Fetch constants from database
  const config = await getSystemConfig('reading_depth_constants');
  const { avg_wpm, time_weight, scroll_weight, max_ratio } = config;
  
  const expectedTimeMs = (wordCount * 60000) / avg_wpm;
  const timeRatio = Math.min(max_ratio, dwellTimeMs / expectedTimeMs);
  return (timeRatio * time_weight) + (scrollDepth * scroll_weight);
}

async function validateEmbedding(embedding: number[]): Promise<void> {
  // Fetch expected dimension from database
  const config = await getSystemConfig('embedding_model');
  const expectedDim = config.dimension;
  
  if (embedding.length !== expectedDim) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDim} (from system_config), got ${embedding.length}`
    );
  }
}
```

---

#### Option 2: Smart Cache (Recommended for Production)

```typescript
class SystemConfigCache {
  private static cache = new Map<string, any>();
  private static lastFetch = new Map<string, number>();
  private static TTL = 60000; // 1 minute

  static async get(key: string): Promise<any> {
    const now = Date.now();
    const lastFetch = this.lastFetch.get(key) || 0;
    
    // Return cached if still valid
    if (this.cache.has(key) && (now - lastFetch) < this.TTL) {
      return this.cache.get(key);
    }
    
    // Fetch fresh
    const { data, error } = await supabase
      .from('misir.system_config')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) {
      // Return stale cache on error if available
      if (this.cache.has(key)) {
        console.warn(`Failed to refresh config ${key}, using stale cache`);
        return this.cache.get(key);
      }
      throw error;
    }
    
    // Update cache
    this.cache.set(key, data.value);
    this.lastFetch.set(key, now);
    return data.value;
  }
  
  static invalidate(key: string) {
    this.cache.delete(key);
    this.lastFetch.delete(key);
  }
  
  static invalidateAll() {
    this.cache.clear();
    this.lastFetch.clear();
  }
}

// Usage
async function calculateReadingDepth(
  wordCount: number,
  dwellTimeMs: number,
  scrollDepth: number
): Promise<number> {
  const config = await SystemConfigCache.get('reading_depth_constants');
  const { avg_wpm, time_weight, scroll_weight, max_ratio } = config;
  
  const expectedTimeMs = (wordCount * 60000) / avg_wpm;
  const timeRatio = Math.min(max_ratio, dwellTimeMs / expectedTimeMs);
  return (timeRatio * time_weight) + (scrollDepth * scroll_weight);
}
```

---

#### Option 3: Realtime Updates (Advanced)

```typescript
class SystemConfigService {
  private config = new Map<string, any>();
  private subscription: RealtimeChannel | null = null;

  async initialize() {
    // Initial load
    const { data } = await supabase
      .from('misir.system_config')
      .select('key, value');
    
    data?.forEach(row => {
      this.config.set(row.key, row.value);
    });
    
    // Subscribe to changes
    this.subscription = supabase
      .channel('system_config_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'misir',
          table: 'system_config'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            this.config.set(payload.new.key, payload.new.value);
            console.log(`Config updated: ${payload.new.key}`);
          }
        }
      )
      .subscribe();
  }

  get(key: string): any {
    if (!this.config.has(key)) {
      throw new Error(`Config key not loaded: ${key}`);
    }
    return this.config.get(key);
  }

  async destroy() {
    if (this.subscription) {
      await this.subscription.unsubscribe();
    }
  }
}

// Global instance
export const configService = new SystemConfigService();

// Initialize on app startup
await configService.initialize();

// Usage (synchronous!)
function calculateReadingDepth(
  wordCount: number,
  dwellTimeMs: number,
  scrollDepth: number
): number {
  const config = configService.get('reading_depth_constants');
  const { avg_wpm, time_weight, scroll_weight, max_ratio } = config;
  
  const expectedTimeMs = (wordCount * 60000) / avg_wpm;
  const timeRatio = Math.min(max_ratio, dwellTimeMs / expectedTimeMs);
  return (timeRatio * time_weight) + (scrollDepth * scroll_weight);
}
```

---

## 2. Artifact Insertion (Use Transaction Helper) 💾

### The Problem

❌ **Old Backend (Error-Prone):**
```typescript
// Manual INSERT - lots of room for errors
const { data: artifact } = await supabase
  .from('misir.artifact')
  .insert({
    user_id: userId,
    space_id: spaceId,
    url: url,  // Need to normalize manually
    normalized_url: normalizeUrl(url),  // Custom function
    domain: extractDomain(url),  // Custom function
    title: title,
    content_embedding: embedding,
    // ... 15 more fields
  })
  .select()
  .single();

// Then insert signal separately
const { data: signal } = await supabase
  .from('misir.signal')
  .insert({
    artifact_id: artifact.id,
    vector: embedding,
    // ... more fields
  });

// Problems:
// - Not atomic (signal insert could fail)
// - URL normalization logic duplicated
// - Domain extraction duplicated
// - Centroid doesn't update (need to call trigger manually)
```

---

### The Solution

✅ **New Backend (Use RPC Function):**

```typescript
interface ArtifactInsertResult {
  artifact_id: number;
  signal_id: number;
  is_new: boolean;
  message: string;
}

async function captureArtifact(params: {
  userId: string;
  spaceId: number;
  subspaceId?: number;
  sessionId?: number;
  title?: string;
  url: string;
  content?: string;
  embedding: number[];
  engagementLevel?: 'ambient' | 'engaged' | 'committed';
  contentSource?: string;
  dwellTimeMs?: number;
  scrollDepth?: number;
  wordCount?: number;
}): Promise<ArtifactInsertResult> {
  // Calculate reading depth using config
  const readingDepth = await calculateReadingDepth(
    params.wordCount || 0,
    params.dwellTimeMs || 0,
    params.scrollDepth || 0
  );
  
  // Call database transaction helper
  const { data, error } = await supabase.rpc('insert_artifact_with_signal', {
    p_user_id: params.userId,
    p_space_id: params.spaceId,
    p_subspace_id: params.subspaceId || null,
    p_session_id: params.sessionId || null,
    p_title: params.title || null,
    p_url: params.url,
    p_content: params.content || null,
    p_embedding: params.embedding,  // Database validates dimension from config
    p_engagement_level: params.engagementLevel || 'ambient',
    p_content_source: params.contentSource || 'web',
    p_dwell_time_ms: params.dwellTimeMs || 0,
    p_scroll_depth: params.scrollDepth || 0.0,
    p_reading_depth: readingDepth,
    p_word_count: params.wordCount || 0,
    p_signal_magnitude: 1.0,
    p_signal_type: 'semantic',
    p_matched_marker_ids: [],
    p_captured_at: new Date().toISOString()
  });
  
  if (error) throw error;
  return data[0];  // Returns { artifact_id, signal_id, is_new, message }
}

// Usage
const result = await captureArtifact({
  userId: 'user-uuid',
  spaceId: 1,
  subspaceId: 10,
  url: 'https://example.com/article?utm_source=twitter',
  title: 'Example Article',
  content: 'Full text...',
  embedding: embeddingVector,  // 768-dim array
  engagementLevel: 'engaged',
  dwellTimeMs: 45000,
  scrollDepth: 0.8,
  wordCount: 750
});

console.log(result);
// {
//   artifact_id: 123,
//   signal_id: 456,
//   is_new: true,
//   message: "Created new artifact and signal"
// }
```

**Benefits:**
- ✅ Atomic transaction (artifact + signal)
- ✅ URL normalization automatic (DB trigger)
- ✅ Domain extraction automatic (DB trigger)
- ✅ Centroid auto-updates (DB trigger)
- ✅ Dimension validation from config (DB function)
- ✅ UPSERT logic (handles duplicates)
- ✅ Semantic ENUM ordering (never downgrades engagement)

---

## 3. Marker Management (Junction Table) 🏷️

### The Problem

❌ **Old Backend (JSONB Array):**
```typescript
// Assuming old schema had: subspace.markers JSONB column
const { data: subspace } = await supabase
  .from('misir.subspace')
  .select('markers')
  .eq('id', subspaceId)
  .single();

const markers = subspace.markers;  // Array from JSONB
// Problem: No FK enforcement, can have orphaned IDs
```

---

### The Solution

✅ **New Backend (Junction Table):**

```typescript
// Get markers for a subspace (with full marker details)
async function getSubspaceMarkers(subspaceId: number) {
  const { data, error } = await supabase
    .from('misir.subspace_marker')
    .select(`
      marker_id,
      weight,
      source,
      marker:misir.marker (
        id,
        label,
        embedding,
        weight
      )
    `)
    .eq('subspace_id', subspaceId)
    .order('weight', { ascending: false });
  
  if (error) throw error;
  return data;
}

// Add marker to subspace
async function addMarkerToSubspace(
  subspaceId: number,
  markerId: number,
  weight: number = 1.0,
  source: 'user_defined' | 'extracted' | 'suggested' = 'user_defined'
) {
  const { data, error } = await supabase
    .from('misir.subspace_marker')
    .insert({
      subspace_id: subspaceId,
      marker_id: markerId,
      weight: weight,
      source: source
    })
    .select();
  
  if (error) throw error;
  return data[0];
}

// Remove marker from subspace
async function removeMarkerFromSubspace(
  subspaceId: number,
  markerId: number
) {
  const { error } = await supabase
    .from('misir.subspace_marker')
    .delete()
    .eq('subspace_id', subspaceId)
    .eq('marker_id', markerId);
  
  if (error) throw error;
}

// Update marker weight
async function updateMarkerWeight(
  subspaceId: number,
  markerId: number,
  newWeight: number
) {
  const { error } = await supabase
    .from('misir.subspace_marker')
    .update({ weight: newWeight })
    .eq('subspace_id', subspaceId)
    .eq('marker_id', markerId);
  
  if (error) throw error;
}

// Find subspaces by marker
async function findSubspacesByMarker(markerId: number) {
  const { data, error } = await supabase
    .from('misir.subspace_marker')
    .select(`
      subspace_id,
      weight,
      subspace:misir.subspace (
        id,
        name,
        description,
        artifact_count
      )
    `)
    .eq('marker_id', markerId)
    .order('weight', { ascending: false });
  
  if (error) throw error;
  return data;
}
```

**Benefits:**
- ✅ Foreign key enforcement (can't have orphaned marker IDs)
- ✅ Atomic updates with transactions
- ✅ Proper cascading deletes
- ✅ Efficient queries with covering index
- ✅ Type-safe relationships

---

## 4. Engagement Level Ordering (Semantic, Not Lexicographic) 📊

### The Problem

❌ **Old Backend (Lexicographic):**
```typescript
function updateEngagementLevel(current: string, new: string): string {
  // Lexicographic ordering: 'ambient' < 'committed' < 'engaged'
  // This is WRONG - 'committed' should be highest!
  return new > current ? new : current;
}
```

---

### The Solution

✅ **New Backend (Semantic):**

```typescript
type EngagementLevel = 'ambient' | 'engaged' | 'committed';

const ENGAGEMENT_RANK: Record<EngagementLevel, number> = {
  'ambient': 1,
  'engaged': 2,
  'committed': 3
};

function updateEngagementLevel(
  current: EngagementLevel,
  newLevel: EngagementLevel
): EngagementLevel {
  // Semantic ordering: never downgrade
  return ENGAGEMENT_RANK[newLevel] > ENGAGEMENT_RANK[current] 
    ? newLevel 
    : current;
}

// Usage
const artifact = { engagement_level: 'engaged' };
const updated = updateEngagementLevel(artifact.engagement_level, 'ambient');
console.log(updated);  // 'engaged' (not downgraded to 'ambient')
```

**Note:** The database `insert_artifact_with_signal()` function already handles this correctly in the UPSERT logic, so you don't need to implement this manually if using the RPC function.

---

## 5. Vector Search Queries 🔍

### Similarity Search

```typescript
interface SimilarArtifact {
  id: number;
  title: string;
  url: string;
  domain: string;
  similarity: number;
}

async function findSimilarArtifacts(
  queryEmbedding: number[],
  userId: string,
  limit: number = 20,
  excludeId?: number
): Promise<SimilarArtifact[]> {
  let query = supabase.rpc('find_similar_artifacts', {
    query_embedding: queryEmbedding,
    user_id: userId,
    result_limit: limit,
    exclude_artifact_id: excludeId || null
  });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// If you don't have a stored procedure, raw SQL:
async function findSimilarArtifactsRaw(
  queryEmbedding: number[],
  userId: string,
  limit: number = 20
): Promise<SimilarArtifact[]> {
  const { data, error } = await supabase
    .from('misir.artifact')
    .select('id, title, url, domain, content_embedding')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(limit);
  
  if (error) throw error;
  
  // Calculate similarity client-side (not ideal, but works)
  const results = data
    .map(artifact => ({
      id: artifact.id,
      title: artifact.title,
      url: artifact.url,
      domain: artifact.domain,
      similarity: cosineSimilarity(queryEmbedding, artifact.content_embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity);
  
  return results;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}
```

---

## 6. Reading Behavior Analytics 📈

```typescript
interface DomainStats {
  domain: string;
  visits: number;
  avg_dwell_seconds: number;
  avg_scroll: number;
  avg_reading: number;
  deep_reads: number;
}

async function getDomainStats(
  userId: string,
  days: number = 30
): Promise<DomainStats[]> {
  const { data, error } = await supabase
    .from('misir.artifact')
    .select('domain, dwell_time_ms, scroll_depth, reading_depth, engagement_level')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('captured_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  
  if (error) throw error;
  
  // Group by domain
  const grouped = data.reduce((acc, artifact) => {
    if (!acc[artifact.domain]) {
      acc[artifact.domain] = {
        domain: artifact.domain,
        visits: 0,
        total_dwell: 0,
        total_scroll: 0,
        total_reading: 0,
        deep_reads: 0
      };
    }
    
    const stats = acc[artifact.domain];
    stats.visits++;
    stats.total_dwell += artifact.dwell_time_ms;
    stats.total_scroll += artifact.scroll_depth;
    stats.total_reading += artifact.reading_depth;
    if (artifact.engagement_level === 'committed') {
      stats.deep_reads++;
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  // Calculate averages
  return Object.values(grouped)
    .map(stats => ({
      domain: stats.domain,
      visits: stats.visits,
      avg_dwell_seconds: Math.round(stats.total_dwell / stats.visits / 1000),
      avg_scroll: parseFloat((stats.total_scroll / stats.visits).toFixed(2)),
      avg_reading: parseFloat((stats.total_reading / stats.visits).toFixed(2)),
      deep_reads: stats.deep_reads
    }))
    .sort((a, b) => b.visits - a.visits);
}
```

---

## 7. Migration Strategy 🔄

### Phase 1: Update Dependencies (Day 1)

1. **Install/Update Supabase Client**
   ```bash
   npm install @supabase/supabase-js@latest
   ```

2. **Deploy New Schema**
   ```bash
   psql -h <host> -U postgres -d postgres -f misir-schema-v1.0.sql
   ```

---

### Phase 2: Add Config Service (Day 1-2)

1. **Create `services/system-config.service.ts`**
   ```typescript
   // Use Option 2 (Smart Cache) from section 1
   export class SystemConfigCache { ... }
   ```

2. **Initialize on App Startup**
   ```typescript
   // app.ts or main.ts
   import { SystemConfigCache } from './services/system-config.service';
   
   // Warm cache on startup
   await SystemConfigCache.get('embedding_model');
   await SystemConfigCache.get('reading_depth_constants');
   ```

---

### Phase 3: Update Reading Depth Calculation (Day 2)

1. **Update `utils/reading-depth.ts`**
   ```typescript
   import { SystemConfigCache } from '../services/system-config.service';
   
   export async function calculateReadingDepth(
     wordCount: number,
     dwellTimeMs: number,
     scrollDepth: number
   ): Promise<number> {
     const config = await SystemConfigCache.get('reading_depth_constants');
     const { avg_wpm, time_weight, scroll_weight, max_ratio } = config;
     
     const expectedTimeMs = (wordCount * 60000) / avg_wpm;
     const timeRatio = Math.min(max_ratio, dwellTimeMs / expectedTimeMs);
     return (timeRatio * time_weight) + (scrollDepth * scroll_weight);
   }
   ```

2. **Test Against Database**
   ```typescript
   // test/reading-depth.test.ts
   test('reading depth matches database calculation', async () => {
     const depth = await calculateReadingDepth(500, 150000, 0.75);
     
     // Verify against database validation
     const { data } = await supabase.rpc('insert_artifact_with_signal', {
       // ... with calculated depth
       p_reading_depth: depth
     });
     
     expect(data[0].artifact_id).toBeDefined();  // No validation error
   });
   ```

---

### Phase 4: Update Artifact Capture (Day 3)

1. **Replace Manual INSERTs with RPC**
   ```typescript
   // OLD
   await supabase.from('misir.artifact').insert({ ... });
   await supabase.from('misir.signal').insert({ ... });
   
   // NEW
   await supabase.rpc('insert_artifact_with_signal', { ... });
   ```

2. **Update Browser Extension**
   ```typescript
   // extension/content-script.ts
   import { captureArtifact } from '../services/artifact.service';
   
   async function onPageCapture() {
     const result = await captureArtifact({
       userId: currentUser.id,
       spaceId: activeSpace.id,
       url: window.location.href,
       title: document.title,
       content: extractedText,
       embedding: await generateEmbedding(extractedText),
       engagementLevel: determineEngagement(),
       dwellTimeMs: Date.now() - pageLoadTime,
       scrollDepth: getScrollDepth(),
       wordCount: countWords(extractedText)
     });
     
     console.log(`Captured artifact ${result.artifact_id}`);
   }
   ```

---

### Phase 5: Update Marker Queries (Day 3-4)

1. **Find All JSONB Marker References**
   ```bash
   grep -r "\.markers" src/
   grep -r "subspace.markers" src/
   ```

2. **Replace with Junction Table Queries**
   ```typescript
   // OLD
   const markers = subspace.markers;
   
   // NEW
   const markers = await getSubspaceMarkers(subspace.id);
   ```

---

### Phase 6: Test & Validate (Day 5)

1. **Integration Tests**
   - Artifact capture end-to-end
   - Reading depth calculation accuracy
   - Marker CRUD operations
   - Vector similarity search

2. **Performance Tests**
   - Config cache hit rate
   - Vector search response time (<50ms)
   - Artifact insert time (<10ms)

3. **Data Validation**
   - No dimension mismatches
   - Reading depth warnings == 0
   - Centroid updates triggering correctly

---

## 8. Testing Checklist ✅

### Unit Tests

```typescript
describe('System Config Integration', () => {
  test('reading depth uses database constants', async () => {
    const depth = await calculateReadingDepth(500, 150000, 0.75);
    expect(depth).toBeGreaterThan(0);
    expect(depth).toBeLessThanOrEqual(1.5);
  });
  
  test('embedding validation uses config dimension', async () => {
    const config = await SystemConfigCache.get('embedding_model');
    const embedding = new Array(config.dimension).fill(0.1);
    
    await expect(
      captureArtifact({ embedding, ... })
    ).resolves.toBeDefined();
  });
});

describe('Artifact Capture', () => {
  test('creates artifact and signal atomically', async () => {
    const result = await captureArtifact({ ... });
    
    expect(result.artifact_id).toBeDefined();
    expect(result.signal_id).toBeDefined();
    expect(result.is_new).toBe(true);
  });
  
  test('handles duplicate URLs with UPSERT', async () => {
    const url = 'https://example.com/test';
    
    const first = await captureArtifact({ url, ... });
    const second = await captureArtifact({ url, ... });
    
    expect(first.artifact_id).toBe(second.artifact_id);
    expect(second.is_new).toBe(false);
  });
});

describe('Marker Management', () => {
  test('adds marker to subspace', async () => {
    const result = await addMarkerToSubspace(1, 10, 0.9);
    expect(result.weight).toBe(0.9);
  });
  
  test('prevents duplicate marker assignments', async () => {
    await addMarkerToSubspace(1, 10);
    await expect(
      addMarkerToSubspace(1, 10)
    ).rejects.toThrow();  // Unique constraint violation
  });
});
```

---

## 9. Common Pitfalls & Solutions 🚨

### Pitfall 1: Hardcoded Constants

**Problem:**
```typescript
const AVG_WPM = 200;  // Hardcoded in code
```

**Solution:**
```typescript
const config = await SystemConfigCache.get('reading_depth_constants');
const AVG_WPM = config.avg_wpm;  // From database
```

---

### Pitfall 2: Dimension Validation

**Problem:**
```typescript
if (embedding.length !== 768) throw new Error('Invalid');  // Hardcoded 768
```

**Solution:**
```typescript
const config = await SystemConfigCache.get('embedding_model');
if (embedding.length !== config.dimension) throw new Error(`Expected ${config.dimension}`);
```

---

### Pitfall 3: Manual Artifact Insert

**Problem:**
```typescript
await supabase.from('misir.artifact').insert({ ... });
await supabase.from('misir.signal').insert({ ... });
// Not atomic, no centroid update
```

**Solution:**
```typescript
await supabase.rpc('insert_artifact_with_signal', { ... });
// Atomic, centroid updates automatically
```

---

### Pitfall 4: JSONB Markers

**Problem:**
```typescript
const markers = subspace.markers;  // Old JSONB column
```

**Solution:**
```typescript
const markers = await getSubspaceMarkers(subspace.id);  // Junction table
```

---

## 10. Performance Considerations ⚡

### Config Caching Strategy

**Recommended TTL:**
- `embedding_model`: 5 minutes (rarely changes)
- `reading_depth_constants`: 1 minute (may tune frequently)
- `vector_index_params`: 1 hour (informational only)
- `centroid_history_threshold`: 1 minute (may tune)

### Database Query Optimization

```typescript
// ❌ BAD - Multiple queries
const subspace = await supabase.from('misir.subspace').select('*').eq('id', 1).single();
const markers = await supabase.from('misir.subspace_marker').select('*').eq('subspace_id', 1);

// ✅ GOOD - Single query with join
const { data } = await supabase
  .from('misir.subspace')
  .select(`
    *,
    markers:misir.subspace_marker (
      marker_id,
      weight,
      marker:misir.marker (*)
    )
  `)
  .eq('id', 1)
  .single();
```

---

## 11. Summary & Next Steps 🎯

### Critical Changes Summary

| What | Where | Action |
|------|-------|--------|
| Reading depth constants | All calculation code | Fetch from `system_config` |
| Embedding dimension | Validation code | Fetch from `system_config.embedding_model.dimension` |
| Artifact insertion | Capture logic | Use `insert_artifact_with_signal()` RPC |
| Marker queries | Dashboard, analytics | Use `subspace_marker` junction table |

### Success Criteria

- [ ] No hardcoded `200` (avg_wpm)
- [ ] No hardcoded `768` (dimension)
- [ ] No hardcoded `0.6`, `0.4` (weights)
- [ ] All artifact inserts use RPC function
- [ ] No JSONB `markers` column queries
- [ ] Config cache hit rate >90%
- [ ] Vector search <50ms
- [ ] Reading depth warnings == 0

### Recommended Timeline

- **Day 1-2:** Config service + reading depth
- **Day 3-4:** Artifact capture + markers
- **Day 5:** Testing & validation
- **Day 6-7:** Integration tests, performance tuning

---

**Backend Status:** Ready for v1.0 Schema  
**Key Takeaway:** Config-driven architecture = production flexibility  
**Next Step:** Implement `SystemConfigCache` service first
