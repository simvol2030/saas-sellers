---
name: react-to-svelte5-converter
description: Use this skill proactively when converting React components to Svelte 5. Trigger when user mentions migrating from React, converting JSX/TSX to Svelte, transforming React hooks to Svelte runes, or needs React components converted to .svelte files. Analyzes React component complexity, autonomously decomposes large components if needed, maps React hooks to Svelte 5 runes, and generates production-ready Svelte components with MCP documentation validation.
---

# React to Svelte 5 Converter

## Overview

Convert React (JSX/TSX) components into modern Svelte 5 components with proper runes syntax. This skill analyzes React code, maps hooks to Svelte equivalents, optionally decomposes large components, and generates clean, idiomatic Svelte 5 code ready for SvelteKit projects.

## Workflow Decision Tree

**When to use this skill:**
- User provides React components (.jsx, .tsx files) for conversion
- User mentions "convert React to Svelte", "migrate from React"
- User wants React hooks transformed to Svelte 5 runes
- React component needs to be split and converted to multiple Svelte components

**Component Decomposition Rules:**

1. **Large Component Detection:**
   - Component has >200 lines of code
   - Multiple distinct responsibilities (navigation + content + forms)
   - Complex nested structure (>3 levels deep)
   - Multiple useState/useReducer managing different domains

2. **Decomposition Strategy:**
   - **If user provided decomposition plan** → Follow their specified breakdown
   - **If NO decomposition plan** → Analyze component, propose breakdown, get approval, then convert

3. **Output Directory:**
   - Always ask user where to save converted components
   - Default: same directory structure as React source
   - Support custom path specification

---

## Step 1: Analysis of React Components

When user provides React component(s):

1. **Read all React files:**
   - Identify `.jsx`, `.tsx` files
   - Parse component structure
   - Identify imports and dependencies

2. **Analyze React patterns:**
   - **Hooks used:** `useState`, `useEffect`, `useMemo`, `useCallback`, `useContext`, `useRef`, `useReducer`, custom hooks
   - **Props:** destructuring, default values, TypeScript types
   - **Event handlers:** `onClick`, `onChange`, `onSubmit`, etc.
   - **Rendering patterns:** conditional (`&&`, ternary), lists (`.map()`), fragments
   - **Styling:** CSS Modules, CSS-in-JS, className patterns
   - **State management:** local state, context, external stores

3. **Assess component complexity:**
   ```
   SIMPLE COMPONENT (<100 lines, single responsibility):
   → Direct 1:1 conversion

   MEDIUM COMPONENT (100-200 lines, focused purpose):
   → Convert as-is, possibly suggest minor optimizations

   LARGE COMPONENT (>200 lines, multiple responsibilities):
   → REQUIRES DECOMPOSITION
   → Check if user provided breakdown plan
   → If not, analyze and propose breakdown
   ```

4. **Identify decomposition opportunities:**
   - Repeated JSX patterns → reusable components
   - Distinct sections (header, sidebar, main, footer)
   - Form groups → separate form components
   - List items → item components
   - Modals, dialogs → separate UI components

---

## Step 2: Decomposition Planning (for Large Components)

### When Component is Large:

**A. User Provided Decomposition Plan:**
```markdown
User says: "Split LoginPage into Header, LoginForm, and Footer components"

ACTION:
1. Follow user's specified breakdown exactly
2. Skip proposal step
3. Proceed to Step 3 (Agreement confirmation)
```

**B. No Decomposition Plan Provided:**
```markdown
ACTION:
1. Analyze component structure
2. Identify logical boundaries:
   - Separate responsibilities (data fetching, display, forms)
   - UI sections (navigation, content, sidebar)
   - Reusable patterns

3. Propose breakdown structure:

EXAMPLE PROPOSAL:
---
**Component Analysis: DashboardPage.jsx**

This is a large component (350 lines) with multiple responsibilities.

**Proposed Decomposition:**

1. **DashboardLayout.svelte** - Main container
   - Props: `user`, `children`
   - Responsibility: Layout structure

2. **DashboardHeader.svelte** - Header with user info
   - Props: `user`, `onLogout`
   - Responsibility: Top navigation

3. **StatsPanel.svelte** - Statistics widgets
   - Props: `stats: Stats[]`
   - Responsibility: Display metrics

4. **ActivityFeed.svelte** - Recent activity list
   - Props: `activities: Activity[]`
   - Responsibility: Activity timeline

5. **QuickActions.svelte** - Action buttons
   - Props: `actions: Action[]`, `onAction`
   - Responsibility: User actions

**Component Hierarchy:**
```
DashboardLayout
├── DashboardHeader
├── StatsPanel
├── ActivityFeed
└── QuickActions
```

**Confirm or adjust this structure before conversion.**
---

4. Wait for user confirmation
5. Apply adjustments if requested
```

### Component Breakdown Criteria:

**Create separate components for:**
- **Different functional domains:**
  - Data fetching ≠ Data display
  - Form logic ≠ Form UI
  - Navigation ≠ Content

- **Reusable patterns:**
  - Repeated JSX (cards, list items, buttons)
  - Common UI elements (modals, tooltips, badges)

- **Clear boundaries:**
  - Self-contained functionality
  - Own props and state
  - Independent testing capability

---

## Step 3: Agreement with User

Present conversion plan:

**For Simple/Medium Components:**
```markdown
**Conversion Plan:**

Converting `ComponentName.jsx` → `ComponentName.svelte`

**React patterns detected:**
- useState (3 instances) → $state()
- useEffect (2 instances) → $effect() / onMount()
- useMemo (1 instance) → $derived()
- Props with TypeScript types
- Event handlers: onClick, onChange

**Output:**
- Single .svelte file
- Preserved functionality and visual design
- TypeScript types maintained

**Output directory:** [ask user or confirm default]

Proceed with conversion?
```

**For Large Components (with decomposition):**
```markdown
[Show decomposition proposal from Step 2]

**Output directory:** [ask user]

Confirm structure and proceed?
```

**Wait for user confirmation before proceeding to Step 4.**

---

## Step 4: Generate Svelte 5 Components

### CRITICAL: Always Use MCP Documentation

**BEFORE converting ANY component**, fetch Svelte 5 documentation:

```javascript
mcp__svelte-llm__get_documentation({
  section: ["What are runes?", "$state", "$derived", "$effect", "$props", "Basic markup", "class", "Scoped styles"]
})
```

Fetch additional sections based on React patterns:
- Forms: `bind:`, `{#if ...}`, `{#each ...}`
- Context: `Context`
- Lifecycle: `Lifecycle hooks`
- Advanced: `$effect.pre`, `Stores`

### React to Svelte 5 Mapping

#### State Management

**useState → $state()**
```jsx
// React
const [count, setCount] = useState(0);
const [name, setName] = useState('');
setCount(count + 1);
setName('John');
```

```svelte
<!-- Svelte 5 -->
<script>
  let count = $state(0);
  let name = $state('');
  count++;
  name = 'John';
</script>
```

**useState with object → $state() with object**
```jsx
// React
const [user, setUser] = useState({ name: '', age: 0 });
setUser({ ...user, name: 'John' });
```

```svelte
<!-- Svelte 5 -->
<script>
  let user = $state({ name: '', age: 0 });
  user.name = 'John'; // Direct mutation works
</script>
```

#### Effects

**useEffect (mount/unmount) → onMount()**
```jsx
// React
useEffect(() => {
  console.log('mounted');
  return () => console.log('unmounted');
}, []);
```

```svelte
<!-- Svelte 5 -->
<script>
  import { onMount } from 'svelte';

  onMount(() => {
    console.log('mounted');
    return () => console.log('unmounted');
  });
</script>
```

**useEffect (with dependencies) → $effect()**
```jsx
// React
useEffect(() => {
  console.log('count changed:', count);
}, [count]);
```

```svelte
<!-- Svelte 5 -->
<script>
  $effect(() => {
    console.log('count changed:', count);
  });
</script>
```

#### Derived Values

**useMemo → $derived()**
```jsx
// React
const doubled = useMemo(() => count * 2, [count]);
```

```svelte
<!-- Svelte 5 -->
<script>
  let doubled = $derived(count * 2);
</script>
```

**useCallback → regular function (not needed)**
```jsx
// React
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);
```

```svelte
<!-- Svelte 5 -->
<script>
  function handleClick() {
    console.log(count);
  }
</script>
```

#### Props

**React props → $props()**
```jsx
// React
interface Props {
  title: string;
  count?: number;
}

function MyComponent({ title, count = 0 }: Props) {
  // ...
}
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  interface Props {
    title: string;
    count?: number;
  }

  let { title, count = 0 }: Props = $props();
</script>
```

#### Event Handlers

**React events → Svelte events (lowercase, no colon)**
```jsx
// React
<button onClick={handleClick}>Click</button>
<input onChange={handleChange} />
```

```svelte
<!-- Svelte 5 -->
<button onclick={handleClick}>Click</button>
<input oninput={handleChange} />
```

#### Conditional Rendering

**Logical AND → {#if}**
```jsx
// React
{isOpen && <Modal />}
```

```svelte
<!-- Svelte 5 -->
{#if isOpen}
  <Modal />
{/if}
```

#### Lists

**.map() → {#each}**
```jsx
// React
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

```svelte
<!-- Svelte 5 -->
{#each items as item (item.id)}
  <div>{item.name}</div>
{/each}
```

#### Styling

**className → class**
```jsx
// React
<div className="container active">
```

```svelte
<!-- Svelte 5 -->
<div class="container active">
```

### Component Template Structure

Every converted `.svelte` file:

```svelte
<script lang="ts">
  // 1. Imports
  import { onMount } from 'svelte';

  // 2. Props (from React props)
  interface Props {
    title: string;
    items?: Array<{ id: number; name: string }>;
  }

  let { title, items = [] }: Props = $props();

  // 3. Local state (from useState)
  let count = $state(0);

  // 4. Derived values (from useMemo)
  let doubled = $derived(count * 2);

  // 5. Effects (from useEffect)
  onMount(() => {
    // mount logic
  });

  $effect(() => {
    // reactive logic
  });

  // 6. Functions (event handlers)
  function handleClick() {
    count++;
  }
</script>

<!-- 7. Template (from JSX) -->
<div class="component">
  <h1>{title}</h1>

  {#each items as item (item.id)}
    <div>{item.name}</div>
  {/each}

  <button onclick={handleClick}>
    Clicked {count} times
  </button>
</div>

<!-- 8. Scoped styles -->
<style>
  .component {
    padding: 1rem;
  }
</style>
```

### Conversion Checklist

- [ ] **MCP documentation consulted**
- [ ] **useState** → `$state()`
- [ ] **useEffect** → `$effect()` or `onMount()`
- [ ] **useMemo** → `$derived()`
- [ ] **useCallback** → removed
- [ ] **useRef (DOM)** → `bind:this`
- [ ] **useContext** → `getContext()`
- [ ] **props** → `$props()`
- [ ] **onClick, onChange** → `onclick`, `oninput`
- [ ] **className** → `class`
- [ ] **{condition &&}** → `{#if}`
- [ ] **.map()** → `{#each}`
- [ ] **TypeScript types** preserved
- [ ] **Functionality** preserved
- [ ] **SvelteKit compatible**

---

## Step 5: User Testing & Iteration

After converting:

1. **Present code:**
   ```markdown
   ## ComponentName.svelte

   **Original:** `ComponentName.jsx` (150 lines)
   **Converted:** `ComponentName.svelte` (95 lines)

   ```svelte
   [full component code]
   ```

   **Testing:** Copy to https://svelte.dev/playground
   **Saved to:** [output directory]
   ```

2. **Wait for feedback**
3. **Iterate** based on user input

---

## Output Directory Handling

Always confirm output directory:

```markdown
**Output Directory:**

Where should I save the converted component(s)?

Options:
1. Same directory as source
2. Custom path: [user specifies]
3. Default: `src/lib/components/`

Please specify.
```

---

## Quality Checklist

- [ ] All React hooks converted
- [ ] Functionality preserved
- [ ] Visual design maintained
- [ ] TypeScript types updated
- [ ] Event handlers lowercase
- [ ] No React code remains
- [ ] SvelteKit compatible
- [ ] Tested in playground
- [ ] Saved to directory

---

## Notes

- Focus on **Svelte 5 ONLY**
- Always use MCP documentation
- React code simplifies in Svelte
- Remove unnecessary memoization
- Test in playground
- Preserve TypeScript types
- Maintain visual/functional parity

## References

### react-svelte-mapping.md
Quick lookup table: React → Svelte 5 equivalents (hooks, events, props, styling)

### hooks-conversion.md
Detailed conversion for each React hook with examples

### patterns-conversion.md
Common React patterns → Svelte equivalents (conditionals, lists, forms, context)
