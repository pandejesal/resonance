---
name: react-accessibility
description: Accessibility and performance patterns for React + TypeScript
---

# React Accessibility & Performance

## Error Boundaries
```tsx
// ALWAYS wrap page-level components in error boundaries
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## ARIA Labels
```tsx
// Every interactive element needs an accessible name
// BAD:
<button onClick={play}><PlayIcon /></button>
// GOOD:
<button onClick={play} aria-label={isPlaying ? "Pause" : "Play"}>
  <PlayIcon />
</button>

// Active route indicator
<Link to="/library" aria-current={isActive ? "page" : undefined}>
  Library
</Link>
```

## Zustand Selectors
```tsx
// ALWAYS use selectors to prevent unnecessary re-renders
// BAD:
const { isPlaying, currentTrack, progress } = usePlayerStore();
// GOOD:
const isPlaying = usePlayerStore(s => s.isPlaying);
const currentTrack = usePlayerStore(s => s.currentTrack);
```

## useEffect Cleanup
```tsx
// ALWAYS clean up intervals, timeouts, and subscriptions
useEffect(() => {
  const interval = setInterval(poll, 1000);
  return () => clearInterval(interval);
}, []);

// For async operations, use AbortController
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal });
  return () => controller.abort();
}, []);
```

## List Keys
```tsx
// Use stable unique IDs, NOT array indices
// BAD:
{items.map((item, i) => <div key={i} />)}
// GOOD:
{items.map(item => <div key={item.id} />)}
```

## Type Safety
```tsx
// NEVER use `any` — define proper types
// BAD:
const [data, setData] = useState<any>(null);
// GOOD:
const [data, setData] = useState<Track[] | null>(null);

// Catch errors as unknown
try { ... } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Unknown error';
}
```
