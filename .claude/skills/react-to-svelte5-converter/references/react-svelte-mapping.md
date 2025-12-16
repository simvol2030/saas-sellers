# React to Svelte 5 Quick Reference

Complete mapping table for React patterns to Svelte 5 equivalents.

## State & Hooks

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `useState(value)` | `$state(value)` | Direct mutation instead of setter |
| `useEffect(() => {...}, [])` | `onMount(() => {...})` | Runs once on mount |
| `useEffect(() => {...}, [deps])` | `$effect(() => {...})` | Auto-tracks dependencies |
| `useMemo(() => compute(), [deps])` | `$derived(compute())` | Computed values |
| `useCallback(() => {...}, [deps])` | `function() {...}` | Not needed, remove |
| `useRef(null)` (DOM) | `bind:this={ref}` | DOM element reference |
| `useRef(value)` (value) | `let ref = value` | Non-reactive value |
| `useContext(Ctx)` | `getContext('key')` | Read context |
| `useReducer(reducer, init)` | `$state()` + functions | Simplify to state |
| Custom hooks | Regular functions with runes | Can use `$state`, `$derived` inside |

## Props & Components

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `function Comp({ prop }) {}` | `let { prop } = $props()` | Props destructuring |
| `prop = defaultValue` | `let { prop = defaultValue } = $props()` | Default values |
| `interface Props { ... }` | `interface Props { ... }` | Same TypeScript |
| `{children}` | `{@render children?.()}` | Render prop pattern |
| `<Component key={id} />` | `{#each ... (id)}` | Keys in `{#each}` |
| `forwardRef` | Not needed | Direct element access |
| `React.memo(Comp)` | Not needed | Auto-optimized |

## Events

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `onClick={handler}` | `onclick={handler}` | Lowercase, no colon |
| `onChange={handler}` | `oninput={handler}` | `oninput` for inputs |
| `onSubmit={handler}` | `onsubmit={handler}` | Lowercase |
| `onMouseEnter={handler}` | `onmouseenter={handler}` | Lowercase |
| `onKeyDown={handler}` | `onkeydown={handler}` | Lowercase |
| `onClick={(e) => fn(e, id)}` | `onclick={(e) => fn(e, id)}` | Same inline syntax |
| `event.preventDefault()` | `event.preventDefault()` | Same |
| `event.stopPropagation()` | `event.stopPropagation()` | Same |

## Conditional Rendering

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `{cond && <Comp />}` | `{#if cond}<Comp />{/if}` | Block syntax |
| `{cond ? <A /> : <B />}` | `{#if cond}<A />{:else}<B />{/if}` | If-else |
| `{cond1 ? <A /> : cond2 ? <B /> : <C />}` | `{#if cond1}<A />{:else if cond2}<B />{:else}<C />{/if}` | Multi-branch |
| `{val === 'a' && <A />}` | `{#if val === 'a'}<A />{/if}` | Comparison |

## Lists

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `items.map(i => <div key={i.id}>{i.name}</div>)` | `{#each items as i (i.id)}<div>{i.name}</div>{/each}` | Keyed each |
| `items.map((i, idx) => ...)` | `{#each items as i, idx (i.id)}` | With index |
| `{items.map(...)}` | `{#each items as item}{/each}` | No return needed |
| Empty fallback | `{#each items as i}{:else}<Empty />{/each}` | Else block |

## Styling

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `className="foo"` | `class="foo"` | Use `class` not `className` |
| `className={active ? 'active' : ''}` | `class={{ active }}` | Object syntax |
| `className={cn('base', active && 'active')}` | `class={['base', active && 'active']}` | Array syntax |
| `style={{ color: 'red' }}` | `style:color="red"` | Individual properties |
| `style={{ fontSize: size + 'px' }}` | `style:font-size="{size}px"` | Dynamic values |
| CSS Modules `styles.button` | Scoped `<style>` | Built-in scoping |
| `styled-components` | `<style>` + `$state` | Native reactive styles |

## Forms

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `<input value={v} onChange={e => setV(e.target.value)} />` | `<input bind:value={v} />` | Two-way binding |
| `<input checked={c} onChange={e => setC(e.target.checked)} />` | `<input type="checkbox" bind:checked={c} />` | Checkbox binding |
| `<select value={v} onChange={e => setV(e.target.value)}>` | `<select bind:value={v}>` | Select binding |
| `<textarea value={t} onChange={...} />` | `<textarea bind:value={t} />` | Textarea binding |
| Controlled component | `bind:value` | Simpler |
| Uncontrolled component | `bind:this` then read value | Direct access |

## Context

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `const Ctx = createContext(default)` | `setContext('key', value)` | In parent |
| `<Ctx.Provider value={v}>{children}</Ctx.Provider>` | `setContext('key', v)` then `<slot />` | Provider pattern |
| `const val = useContext(Ctx)` | `const val = getContext('key')` | In child |
| Context with `$state` | `setContext('key', $state({...}))` | Reactive context |

## Lifecycle

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `useEffect(() => { setup(); }, [])` | `onMount(() => { setup(); })` | Mount only |
| `useEffect(() => { return cleanup; }, [])` | `onMount(() => { return cleanup; })` | Cleanup |
| `useEffect(() => {...}, [dep])` | `$effect(() => {...})` | Reactive to dep |
| `useLayoutEffect` | `$effect.pre(() => {...})` | Before DOM paint |
| No `useInsertionEffect` | Use `$effect.pre` | Similar timing |
| Component unmount | Return from `onMount` or `$effect` | Cleanup function |

## Refs & DOM

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `const ref = useRef(null)` | `let ref` | Declare variable |
| `<div ref={ref} />` | `<div bind:this={ref} />` | Bind element |
| `ref.current.focus()` | `ref.focus()` | Direct access |
| `ref.current = value` | `let ref = value` | Mutable value |
| `useRef` for previous value | `let prev; $effect(() => { prev = current; })` | Track in effect |

## Fragments

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `<Fragment>...</Fragment>` | Just multiple elements | No wrapper needed |
| `<>...</>` | Multiple elements | No wrapper needed |
| `<Fragment key={...}>` | `{#each}` with multiple children | Use each block |

## Performance

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `React.memo(Component)` | Not needed | Auto-optimized |
| `useMemo(() => expensive(), [deps])` | `$derived(expensive())` | Auto-caches |
| `useCallback(() => {...}, [deps])` | Regular function | Not needed |
| `key={id}` prop | `{#each items as item (item.id)}` | In each blocks |
| `shouldComponentUpdate` | Not needed | Granular reactivity |
| `PureComponent` | Not needed | All components pure |

## Error Handling

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `ErrorBoundary` class | `<svelte:boundary>` | Error boundaries |
| `componentDidCatch` | `onerror` on boundary | Error handler |
| `getDerivedStateFromError` | Error prop in boundary | Fallback UI |

## Async

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `useEffect` + async | `$effect` + async | Can use async |
| Loading state pattern | `{#await promise}` | Built-in |
| Data fetching | `$effect` or load functions | SvelteKit load |
| Suspense | `{#await}` | Template-level |

## Portals

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `createPortal(child, container)` | Not built-in | Use actions |
| Modal portal | Render in place | No teleport needed |
| Tooltip portal | Use CSS positioning | Or actions |

## Common Patterns

| React Pattern | Svelte 5 Pattern | Notes |
|---------------|------------------|-------|
| HOC (Higher Order Component) | Wrapper component | Simpler |
| Render props | Snippets `{@render}` | Named slots |
| Compound components | Slot props | Context + slots |
| Custom hooks | Functions with runes | Export functions |
| Context + hooks | Context + `$state` | Reactive context |

## TypeScript

| React | Svelte 5 | Notes |
|-------|----------|-------|
| `React.FC<Props>` | `interface Props` + `$props()` | More explicit |
| `PropsWithChildren<Props>` | Add `children?: any` to Props | Manual |
| `React.ReactNode` | `any` (children type) | Less strict |
| Generic components | `<script generics="T">` | Template generics |
| `typeof Component` | `ComponentType<typeof Comp>` | Import from svelte |

## Build & Tooling

| React | Svelte 5 | Notes |
|-------|----------|-------|
| Create React App | `npm create svelte@latest` | SvelteKit |
| Next.js | SvelteKit | Full framework |
| Vite + React | Vite + Svelte | Same Vite |
| `jsx` pragma | Not needed | `.svelte` files |
| `tsconfig.json` | `tsconfig.json` | Same config |
| `package.json` scripts | Same | Standard npm |

## Not Needed in Svelte

These React concepts don't exist or aren't needed in Svelte:

- `useCallback` - functions don't need memoization
- `useMemo` for functions - only for expensive computations
- `React.memo` - components auto-optimized
- `forwardRef` - direct element access
- `useImperativeHandle` - not needed
- `useTransition` - built-in transitions
- `useDeferredValue` - use `$derived`
- `useId` - use `$props.id()` (Svelte 5.20+)
- `startTransition` - not needed
- `Suspense` (mostly) - use `{#await}`
- Virtual DOM - Svelte compiles to direct DOM updates
- Reconciliation - no diffing needed

## Migration Strategy

1. **Start with leaf components** (no children)
2. **Convert hooks one-by-one:**
   - `useState` → `$state`
   - `useEffect` → `$effect` or `onMount`
   - `useMemo` → `$derived`
   - Remove `useCallback`
3. **Update JSX to template syntax:**
   - `{cond &&}` → `{#if}`
   - `.map()` → `{#each}`
   - `className` → `class`
4. **Convert event handlers** to lowercase
5. **Test in Svelte playground**
6. **Move up component tree**
