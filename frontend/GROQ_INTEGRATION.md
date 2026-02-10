# Groq AI Space Generation Integration

## Overview

The frontend now uses Groq AI (Llama 3) to generate intelligent space structures with subspaces and markers. This replaces manual space creation with AI-powered semantic knowledge architecture.

## Architecture

```
User Input → Groq AI → Subspaces + Markers → Backend → Nomic Embeddings → Database
```

### Flow

1. **Frontend**: User creates space with name, description, intention
2. **Groq**: Generates 4-8 subspaces with 4-6 markers each (adaptive based on complexity)
3. **Backend**: Embeds markers using Nomic AI (768-dim vectors)
4. **Database**: Stores space, subspaces, markers with embeddings + centroids

## Setup

### 1. Get Gemini API Key

```bash
# Visit: https://makersuite.google.com/app/apikey
# Create an API key
```

### 2. Configure Environment

```bash
# frontend/.env.local
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies

Already installed - no SDK needed! Uses direct REST API calls.

## Usage

### Basic Space Creation

```typescript
import { useCreateSpace } from '@/lib/api/spaces';

function CreateSpaceButton() {
  const createSpace = useCreateSpace();
  
  const handleCreate = async () => {
    await createSpace.mutateAsync({
      name: 'Machine Learning',
      description: 'Deep learning and neural networks',
      intention: 'Learn for research project',
      userId: currentUserId
    });
  };
  
  return <button onClick={handleCreate}>Create Space</button>;
}
```

### What Happens

1. **Gemini analyzes** the input:
   - Domain complexity: "Machine Learning" → High complexity
   - Expertise signal: "research project" → Deep learner
   - Mode selection: Automatic → "Advanced" mode

2. **Gemini generates** (example):
   ```json
   [
     {
       "name": "Supervised Learning Foundations",
       "description": "Algorithms and theory for labeled data",
       "markers": [
         "linear regression",
         "logistic regression",
         "support vector machines",
         "regularization techniques"
       ],
       "depth": "foundational",
       "suggested_study_order": 1
     },
     {
       "name": "Deep Learning Theory",
       "description": "Neural network architectures and optimization",
       "markers": [
         "backpropagation algorithm",
         "gradient descent variants",
         "convolutional neural networks",
         "transformer architecture"
       ],
       "depth": "intermediate",
       "prerequisites": ["Supervised Learning Foundations"],
       "suggested_study_order": 2
     }
   ]
   ```

3. **Backend processes**:
   - Creates space record
   - Creates subspace records
   - Embeds each marker: `"linear regression"` → `[0.123, -0.456, ...]` (768-dim)
   - Calculates centroid: `average(marker embeddings)`
   - Stores everything in database

4. **User sees**: Fully structured space ready for learning!

## Prompt Modes

### Standard Mode (Default)
- **Triggers**: Any intention without specific keywords
- **Output**: 4-8 subspaces, adaptive terminology
- **Adaptation**: Analyzes domain complexity automatically

```typescript
{
  name: 'Python Programming',
  intention: 'Learn to build web apps',
  // → Standard mode, ~6 subspaces, balanced depth
}
```

### Advanced Mode
- **Triggers**: "research", "academic", "deep understanding", "theory"
- **Output**: 7-12 subspaces, hierarchical with prerequisites
- **Adaptation**: Includes learning paths and advanced topics

```typescript
{
  name: 'Quantum Computing',
  intention: 'Research project on quantum algorithms',
  // → Advanced mode, ~10 subspaces, hierarchical
}
```

### Fast Mode
- **Triggers**: "quick", "intro", "basics", "getting started"
- **Output**: 3-5 subspaces, essentials only
- **Adaptation**: Minimal but respects domain complexity

```typescript
{
  name: 'Coffee Brewing',
  intention: 'Quick overview',
  // → Fast mode, 3-4 subspaces, beginner-friendly
}
```

## API Reference

### `generateSpace(options)`

```typescript
interface GenerateSpaceOptions {
  name: string;           // Space name (e.g., "Machine Learning")
  description?: string;   // Optional context
  intention?: string;     // User's learning goal
  userId: string;        // Authenticated user ID
}

const spaceRequest = await generateSpace({
  name: 'Economics',
  description: 'Microeconomics and market theory',
  intention: 'Prepare for graduate studies',
  userId: 'user-123'
});
// Returns: CreateSpaceRequest ready to send to backend
```

### `useCreateSpace()`

React Query hook for space creation with AI generation:

```typescript
const createSpace = useCreateSpace();

createSpace.mutate({
  name: 'Space name',
  userId: 'user-id',
  intention: 'Learning goal'
});

// States:
createSpace.isPending  // true while generating + creating
createSpace.isSuccess  // true after complete
createSpace.error      // error if failed
```

### `useCreateSpaceManual()`

For manual space creation without AI:

```typescript
const createManual = useCreateSpaceManual();

createManual.mutate({
  user_id: 'user-id',
  name: 'Manual Space',
  description: 'No AI generation'
});
```

## Quality Controls

### Validation

The system enforces quality rules:

✅ **Allowed**:
- Specific markers: "neural networks", "backpropagation"
- Domain terms: "microeconomics", "supply curve"
- Technical concepts: "gradient descent", "loss function"

❌ **Blocked**:
- Generic terms: "concept", "idea", "thing"
- Duplicates: Same marker in multiple subspaces
- Too vague: "advanced topic", "important stuff"

### Fallback Strategy

1. Try selected mode (Standard/Advanced/Fast)
2. If fails → Try Fast mode
3. If fails → Return minimal template:
   ```json
   [{
     "name": "Space Name",
     "description": "Add your own subspaces",
     "markers": ["bookmark to add content"]
   }]
   ```

## Cost Estimation

### Gemini Pricing (Feb 2026)

- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

### Typical Costs

| Mode | Est. Cost | Tokens |
|------|-----------|--------|
| Fast | $0.005 | ~1500 |
| Standard | $0.01 | ~2500 |
| Advanced | $0.015 | ~4000 |

**At Scale**:
- 1,000 spaces/month: ~$10-15
- 10,000 spaces/month: ~$100-150

### Optimization

```typescript
import { estimateGenerationCost } from '@/lib/services/space-generation';

const cost = estimateGenerationCost(
  'Machine Learning',
  'Deep learning theory',
  'Research project'
);

console.log(cost);
// {
//   estimatedInputTokens: 523,
//   estimatedOutputTokens: 2000,
//   estimatedCostUSD: 0.00964
// }
```

## Backend Integration

### Request Format

```json
POST /api/v1/spaces

{
  "name": "Machine Learning",
  "description": "Deep learning and neural networks",
  "intention": "Learn for research",
  "subspaces": [
    {
      "name": "Supervised Learning",
      "description": "Labeled data algorithms",
      "markers": ["linear regression", "SVM", "decision trees"],
      "depth": "foundational",
      "suggested_study_order": 1
    }
  ]
}
```

### Backend Processing

```python
# 1. Create space
space = create_space(name, description, user_id)

# 2. For each subspace:
for subspace in request.subspaces:
    # Create subspace
    sub = create_subspace(space.id, subspace.name, ...)
    
    # Embed markers (Nomic AI - 768 dimensions)
    embeddings = []
    for marker_label in subspace.markers:
        embedding = embed_text(marker_label)  # → [0.1, -0.2, ...]
        embeddings.append(embedding)
        create_marker(space.id, marker_label, embedding)
    
    # Calculate centroid
    centroid = np.mean(embeddings, axis=0)
    update_subspace_centroid(sub.id, centroid)
```

## Troubleshooting

### "GEMINI_API_KEY not configured"

```bash
# Add to frontend/.env.local
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here

# Restart dev server
npm run dev
```

### "Invalid JSON from Gemini"

Gemini occasionally returns markdown blocks. The system auto-strips:

```
```json
{...}
```
↓
{...}
```

If still failing, check logs for the actual response.

### "All subspaces filtered out"

Gemini generated low-quality markers (e.g., "concept", "idea").

**Solution**: Retry with more specific description/intention.

### Backend 500 Error

Check backend logs for:
- Embedding service errors
- Supabase connection issues
- Missing user_id in JWT token

## Advanced Features

### Custom Terminology

Gemini adapts terminology automatically:

**High-tech domain + research intent**:
```json
{
  "markers": [
    "stochastic gradient descent",
    "vanishing gradients problem",
    "transformer attention mechanism"
  ]
}
```

**Practical domain + beginner intent**:
```json
{
  "markers": [
    "coffee beans",
    "brewing time",
    "water temperature"
  ]
}
```

### Learning Paths

Advanced mode creates prerequisite chains:

```json
{
  "name": "Quantum Field Theory",
  "depth": "advanced",
  "prerequisites": ["Quantum Mechanics Foundations"],
  "suggested_study_order": 8
}
```

Frontend can use this to:
- Show recommended learning order
- Lock advanced topics until prerequisites complete
- Display skill trees

## Next Steps

1. **Get Gemini API key**: https://makersuite.google.com/app/apikey
2. **Add to .env.local**: `NEXT_PUBLIC_GEMINI_API_KEY=...`
3. **Test**: Create a space in the frontend
4. **Monitor**: Check browser console for generation logs
5. **Verify**: Check database for subspaces + markers with embeddings

## Files Created

```
frontend/
├── lib/
│   ├── ai/
│   │   ├── index.ts              # Exports
│   │   ├── gemini.ts             # REST API client
│   │   ├── gemini-prompts.ts    # v2.1 adaptive prompts
│   │   └── validation.ts         # Output quality checks
│   └── services/
│       └── space-generation.ts   # Orchestration layer
├── lib/api/
│   └── spaces.ts                 # Updated hooks with AI
└── types/
    └── api.ts                    # Updated with subspace types

backend/
└── interfaces/api/
    └── spaces.py                 # Updated endpoint with embedding
```

## Support

For issues:
1. Check browser console for Gemini errors
2. Check backend logs for embedding errors
3. Verify NEXT_PUBLIC_GEMINI_API_KEY is set
4. Ensure backend is running with MOCK_AUTH=False
5. Test with simple space first (e.g., "Coffee")

---

**Documentation Version**: 1.0  
**Last Updated**: February 7, 2026  
**Integration Status**: ✅ Complete
