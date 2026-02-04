# Zustand Store Architecture

## Overview

Misir uses Zustand for performant, type-safe global state management.

## Stores

### Auth Store (`lib/store/auth.ts`)
Manages user authentication state and session.

```tsx
import { useAuthStore } from '@/lib/store';

function MyComponent() {
  const { user, loading, signOut } = useAuthStore();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;
  
  return <button onClick={signOut}>Sign Out</button>;
}
```

**State:**
- `user: User | null` - Current authenticated user
- `loading: boolean` - Auth initialization state

**Actions:**
- `initialize()` - Set up auth listener (called automatically)
- `signOut()` - Sign out current user

### Intent Store (`lib/store/intents.ts`)
Manages user intents, snapshots, and optimistic updates.

```tsx
import { useIntentStore } from '@/lib/store';

function IntentList() {
  const { intents, loading, addIntent, updateIntent } = useIntentStore();
  
  return (
    <div>
      {intents.map(intent => (
        <IntentCard key={intent.id} intent={intent} />
      ))}
    </div>
  );
}
```

**State:**
- `intents: Intent[]` - All user intents
- `snapshots: IntentSnapshot[]` - Latest snapshots
- `loading: boolean` - Data fetching state
- `selectedIntentId: string | null` - Currently selected intent

**Actions:**
- `setIntents(intents)` - Replace all intents
- `addIntent(intent)` - Add new intent
- `updateIntent(id, updates)` - Update specific intent
- `deleteIntent(id)` - Remove intent
- `setSnapshots(snapshots)` - Update snapshots
- `selectIntent(id)` - Select intent for detail view
- `optimisticAddArtifact(intentId, evidenceDelta)` - Optimistic artifact update

### UI Store (`lib/store/ui.ts`)
Manages UI preferences and modal states. Persists to localStorage.

```tsx
import { useUIStore } from '@/lib/store';

function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  
  return (
    <aside className={sidebarOpen ? 'open' : 'closed'}>
      <button onClick={toggleSidebar}>Toggle</button>
    </aside>
  );
}
```

**State (Persisted):**
- `theme: 'dark' | 'light'` - Color theme
- `selectedView: 'grid' | 'list'` - Intent display mode

**State (Session):**
- `sidebarOpen: boolean` - Sidebar visibility
- `createIntentModalOpen: boolean` - Modal state

**Actions:**
- `toggleSidebar()` - Toggle sidebar
- `setSidebarOpen(open)` - Set sidebar state
- `setTheme(theme)` - Change theme
- `toggleCreateIntentModal()` - Toggle modal
- `setSelectedView(view)` - Change view mode

## Benefits

✅ **Performance** - Components only re-render when their selected data changes
✅ **DevTools** - Redux DevTools support for debugging
✅ **Persistence** - UI preferences saved to localStorage
✅ **Type Safety** - Full TypeScript support
✅ **No Providers** - Direct store access, no wrapper components
✅ **Small Bundle** - ~1KB gzipped

## Best Practices

### Selector Pattern
Only subscribe to what you need:

```tsx
// ❌ Bad - re-renders on any auth change
const authStore = useAuthStore();

// ✅ Good - only re-renders when user changes
const user = useAuthStore(state => state.user);
```

### Actions
Keep business logic in actions:

```tsx
// ❌ Bad - logic in component
function Component() {
  const intents = useIntentStore(state => state.intents);
  const setIntents = useIntentStore(state => state.setIntents);
  
  const deleteIntent = (id: string) => {
    setIntents(intents.filter(i => i.id !== id));
  };
}

// ✅ Good - use the action
function Component() {
  const deleteIntent = useIntentStore(state => state.deleteIntent);
  
  return <button onClick={() => deleteIntent(id)}>Delete</button>;
}
```

### Server State
Use stores for optimistic updates, but fetch from API:

```tsx
async function addArtifact(intentId: string, artifact: Artifact) {
  // Optimistic update
  useIntentStore.getState().optimisticAddArtifact(intentId, 5);
  
  try {
    // Server update
    await fetch('/api/artifacts', { method: 'POST', body: JSON.stringify(artifact) });
  } catch (error) {
    // Revert on error
    useIntentStore.getState().optimisticAddArtifact(intentId, -5);
  }
}
```
