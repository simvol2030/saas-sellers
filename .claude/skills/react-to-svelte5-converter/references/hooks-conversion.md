# React Hooks → Svelte 5 Detailed Conversion

Comprehensive guide for converting each React hook to Svelte 5 equivalents with examples.

---

## useState → $state()

### Basic Usage

**React:**
```jsx
const [count, setCount] = useState(0);
const [name, setName] = useState('');

setCount(count + 1);
setCount(prev => prev + 1);
setName('John');
```

**Svelte 5:**
```svelte
<script>
  let count = $state(0);
  let name = $state('');

  count++;
  count = count + 1;
  name = 'John';
</script>
```

**Key differences:**
- No setter function - direct mutation
- No functional updates needed
- Simpler syntax

### Object State

**React:**
```jsx
const [user, setUser] = useState({ name: '', age: 0, email: '' });

// Update single property
setUser({ ...user, name: 'John' });

// Update multiple properties
setUser(prev => ({ ...prev, name: 'John', age: 30 }));
```

**Svelte 5:**
```svelte
<script>
  let user = $state({ name: '', age: 0, email: '' });

  // Direct property mutation
  user.name = 'John';

  // Multiple properties
  user.name = 'John';
  user.age = 30;

  // Or replace entire object
  user = { ...user, name: 'John', age: 30 };
</script>
```

**Benefits:**
- Direct mutation is reactive
- No spread operator needed
- Cleaner code

### Array State

**React:**
```jsx
const [items, setItems] = useState([]);

// Add item
setItems([...items, newItem]);

// Remove item
setItems(items.filter(i => i.id !== id));

// Update item
setItems(items.map(i => i.id === id ? { ...i, done: true } : i));
```

**Svelte 5:**
```svelte
<script>
  let items = $state([]);

  // Add item
  items.push(newItem);
  // or
  items = [...items, newItem];

  // Remove item
  items = items.filter(i => i.id !== id);

  // Update item
  const item = items.find(i => i.id === id);
  if (item) item.done = true;
</script>
```

**Benefits:**
- Can use native array methods
- Direct mutation works
- More intuitive

---

## useEffect → $effect() / onMount()

### Mount Only (no dependencies)

**React:**
```jsx
useEffect(() => {
  console.log('Component mounted');

  return () => {
    console.log('Component unmounted');
  };
}, []);
```

**Svelte 5:**
```svelte
<script>
  import { onMount } from 'svelte';

  onMount(() => {
    console.log('Component mounted');

    return () => {
      console.log('Component unmounted');
    };
  });
</script>
```

**Same behavior** - runs once on mount, cleanup on unmount.

### With Dependencies

**React:**
```jsx
useEffect(() => {
  console.log('Count changed:', count);
  document.title = `Count: ${count}`;
}, [count]);
```

**Svelte 5:**
```svelte
<script>
  $effect(() => {
    console.log('Count changed:', count);
    document.title = `Count: ${count}`;
  });
</script>
```

**Key difference:**
- No dependency array needed
- Svelte automatically tracks what you read
- Re-runs whenever `count` changes

### Multiple Dependencies

**React:**
```jsx
useEffect(() => {
  fetchData(userId, filter);
}, [userId, filter]);
```

**Svelte 5:**
```svelte
<script>
  $effect(() => {
    fetchData(userId, filter);
  });
</script>
```

**Auto-tracking** - reads both `userId` and `filter`, re-runs when either changes.

### With Cleanup

**React:**
```jsx
useEffect(() => {
  const subscription = api.subscribe(id);

  return () => {
    subscription.unsubscribe();
  };
}, [id]);
```

**Svelte 5:**
```svelte
<script>
  $effect(() => {
    const subscription = api.subscribe(id);

    return () => {
      subscription.unsubscribe();
    };
  });
</script>
```

**Same pattern** - return cleanup function.

### Timers

**React:**
```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

**Svelte 5:**
```svelte
<script>
  import { onMount } from 'svelte';

  let count = $state(0);

  onMount(() => {
    const timer = setInterval(() => {
      count++;
    }, 1000);

    return () => clearInterval(timer);
  });
</script>
```

### Async Effects

**React:**
```jsx
useEffect(() => {
  async function loadData() {
    const data = await fetchData();
    setData(data);
  }

  loadData();
}, []);
```

**Svelte 5:**
```svelte
<script>
  import { onMount } from 'svelte';

  let data = $state(null);

  onMount(async () => {
    data = await fetchData();
  });
</script>
```

**Or with $effect:**
```svelte
<script>
  let data = $state(null);

  $effect(() => {
    (async () => {
      data = await fetchData();
    })();
  });
</script>
```

---

## useMemo → $derived()

### Basic Computation

**React:**
```jsx
const doubled = useMemo(() => count * 2, [count]);
const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
```

**Svelte 5:**
```svelte
<script>
  let doubled = $derived(count * 2);
  let total = $derived(items.reduce((sum, i) => sum + i.price, 0));
</script>
```

**Benefits:**
- No dependency array
- Auto-updates
- Cleaner syntax

### Complex Computation with $derived.by()

**React:**
```jsx
const filtered = useMemo(() => {
  let result = items;

  if (searchTerm) {
    result = result.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (sortBy) {
    result = [...result].sort((a, b) => a[sortBy] > b[sortBy] ? 1 : -1);
  }

  return result;
}, [items, searchTerm, sortBy]);
```

**Svelte 5:**
```svelte
<script>
  let filtered = $derived.by(() => {
    let result = items;

    if (searchTerm) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy) {
      result = [...result].sort((a, b) => a[sortBy] > b[sortBy] ? 1 : -1);
    }

    return result;
  });
</script>
```

**Same pattern**, but no deps array.

### Chained Computations

**React:**
```jsx
const doubled = useMemo(() => count * 2, [count]);
const quadrupled = useMemo(() => doubled * 2, [doubled]);
const formatted = useMemo(() => `Value: ${quadrupled}`, [quadrupled]);
```

**Svelte 5:**
```svelte
<script>
  let doubled = $derived(count * 2);
  let quadrupled = $derived(doubled * 2);
  let formatted = $derived(`Value: ${quadrupled}`);
</script>
```

**Auto-chains** - updates flow through.

---

## useCallback → Regular Function (Not Needed!)

**React:**
```jsx
const handleClick = useCallback(() => {
  console.log('Clicked:', id);
  onClick(id);
}, [id, onClick]);

const handleSubmit = useCallback(async (data) => {
  await api.submit(data);
  onSuccess();
}, [onSuccess]);
```

**Svelte 5:**
```svelte
<script>
  function handleClick() {
    console.log('Clicked:', id);
    onClick(id);
  }

  async function handleSubmit(data) {
    await api.submit(data);
    onSuccess();
  }
</script>
```

**Why not needed:**
- Svelte doesn't re-create functions on each render
- No "render" concept - compilation handles it
- Just use regular functions

**Exception** - if passing to child that uses it in `$effect`:
```svelte
<!-- Usually still fine as regular function -->
<script>
  function expensiveFn() {
    // expensive operation
  }

  // Child will only call it when needed
</script>

<Child {expensiveFn} />
```

---

## useRef → bind:this / let

### DOM Reference

**React:**
```jsx
const inputRef = useRef(null);

useEffect(() => {
  inputRef.current.focus();
}, []);

const handleClick = () => {
  console.log(inputRef.current.value);
};

return <input ref={inputRef} />;
```

**Svelte 5:**
```svelte
<script>
  import { onMount } from 'svelte';

  let inputElement;

  onMount(() => {
    inputElement.focus();
  });

  function handleClick() {
    console.log(inputElement.value);
  }
</script>

<input bind:this={inputElement} />
```

**Benefits:**
- No `.current` property
- Direct element access
- Simpler

### Mutable Value (Non-Reactive)

**React:**
```jsx
const countRef = useRef(0);

const handleClick = () => {
  countRef.current++;
  console.log(countRef.current); // doesn't trigger re-render
};
```

**Svelte 5:**
```svelte
<script>
  let count = 0; // Just regular let, not $state

  function handleClick() {
    count++;
    console.log(count); // doesn't trigger re-render
  }
</script>
```

**Use regular `let`** for non-reactive values.

### Previous Value Tracking

**React:**
```jsx
const prevCountRef = useRef();

useEffect(() => {
  prevCountRef.current = count;
}, [count]);

// prevCountRef.current has previous value
```

**Svelte 5:**
```svelte
<script>
  let prevCount;

  $effect(() => {
    const current = count;
    return () => {
      prevCount = current;
    };
  });
</script>
```

**Or simpler:**
```svelte
<script>
  let prevCount = $state();

  $effect(() => {
    prevCount = count;
  });

  // prevCount is one update behind
</script>
```

---

## useContext → getContext() / setContext()

### Provider

**React:**
```jsx
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**Svelte 5:**
```svelte
<!-- App.svelte -->
<script>
  import { setContext } from 'svelte';

  let theme = $state('light');

  setContext('theme', {
    get current() { return theme; },
    set: (value) => { theme = value; }
  });
</script>

<slot />
```

**Or simpler with reactive object:**
```svelte
<script>
  import { setContext } from 'svelte';

  let themeState = $state({ theme: 'light' });

  setContext('theme', themeState);
</script>

<slot />
```

### Consumer

**React:**
```jsx
function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current: {theme}
    </button>
  );
}
```

**Svelte 5:**
```svelte
<!-- ThemedButton.svelte -->
<script>
  import { getContext } from 'svelte';

  const themeState = getContext('theme');
</script>

<button onclick={() => {
  themeState.theme = themeState.theme === 'light' ? 'dark' : 'light';
}}>
  Current: {themeState.theme}
</button>
```

### Multiple Contexts

**React:**
```jsx
const ThemeCtx = createContext();
const UserCtx = createContext();

function Component() {
  const theme = useContext(ThemeCtx);
  const user = useContext(UserCtx);

  return <div>...</div>;
}
```

**Svelte 5:**
```svelte
<script>
  import { getContext } from 'svelte';

  const theme = getContext('theme');
  const user = getContext('user');
</script>

<div>...</div>
```

---

## useReducer → $state() + Functions

**React:**
```jsx
const initialState = { count: 0, step: 1 };

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + state.step };
    case 'decrement':
      return { ...state, count: state.count - state.step };
    case 'setStep':
      return { ...state, step: action.payload };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);

// Usage:
dispatch({ type: 'increment' });
dispatch({ type: 'setStep', payload: 5 });
```

**Svelte 5 (Simplified):**
```svelte
<script>
  let state = $state({ count: 0, step: 1 });

  function increment() {
    state.count += state.step;
  }

  function decrement() {
    state.count -= state.step;
  }

  function setStep(value) {
    state.step = value;
  }

  // Usage:
  // increment();
  // setStep(5);
</script>
```

**Benefits:**
- No action types
- Direct function calls
- Simpler to understand
- Less boilerplate

**If you need dispatch pattern:**
```svelte
<script>
  let state = $state({ count: 0, step: 1 });

  function dispatch(action) {
    switch (action.type) {
      case 'increment':
        state.count += state.step;
        break;
      case 'decrement':
        state.count -= state.step;
        break;
      case 'setStep':
        state.step = action.payload;
        break;
    }
  }

  // Usage same as React:
  // dispatch({ type: 'increment' });
</script>
```

---

## Custom Hooks → Functions with Runes

**React:**
```jsx
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);

  return { count, increment, decrement, reset };
}

// Usage:
const { count, increment, decrement, reset } = useCounter(10);
```

**Svelte 5:**
```svelte
<!-- In a .svelte.js or .svelte.ts file -->
<script context="module">
  export function useCounter(initialValue = 0) {
    let count = $state(initialValue);

    function increment() { count++; }
    function decrement() { count--; }
    function reset() { count = initialValue; }

    return {
      get count() { return count; },
      increment,
      decrement,
      reset
    };
  }
</script>
```

**Or in a `.svelte.js` file:**
```javascript
// counter.svelte.js
export function createCounter(initialValue = 0) {
  let count = $state(initialValue);

  return {
    get count() { return count; },
    increment: () => count++,
    decrement: () => count--,
    reset: () => count = initialValue
  };
}
```

**Usage:**
```svelte
<script>
  import { createCounter } from './counter.svelte.js';

  const counter = createCounter(10);
</script>

<div>{counter.count}</div>
<button onclick={counter.increment}>+</button>
```

---

## useLayoutEffect → $effect.pre()

**React:**
```jsx
useLayoutEffect(() => {
  // Runs synchronously after DOM mutations, before paint
  const height = divRef.current.offsetHeight;
  setHeight(height);
}, []);
```

**Svelte 5:**
```svelte
<script>
  let divElement;
  let height = $state(0);

  $effect.pre(() => {
    // Runs before DOM updates
    if (divElement) {
      height = divElement.offsetHeight;
    }
  });
</script>

<div bind:this={divElement}>Content</div>
```

**Note:** Timing differs slightly - `$effect.pre` runs before DOM updates, while `useLayoutEffect` runs after DOM mutations but before paint.

---

## useImperativeHandle → Not Needed

**React:**
```jsx
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef();

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current.focus();
    },
    setValue: (val) => {
      inputRef.current.value = val;
    }
  }));

  return <input ref={inputRef} />;
});
```

**Svelte 5:**
```svelte
<!-- FancyInput.svelte -->
<script>
  let inputElement;

  // Export functions that parent can call
  export function focus() {
    inputElement?.focus();
  }

  export function setValue(val) {
    if (inputElement) inputElement.value = val;
  }
</script>

<input bind:this={inputElement} />
```

**Usage:**
```svelte
<script>
  import FancyInput from './FancyInput.svelte';

  let inputComponent;

  function handleClick() {
    inputComponent.focus();
    inputComponent.setValue('Hello');
  }
</script>

<FancyInput bind:this={inputComponent} />
<button onclick={handleClick}>Focus & Set</button>
```

---

## Conversion Summary

| React Hook | Svelte 5 Equivalent | Complexity |
|------------|---------------------|------------|
| `useState` | `$state()` | Simple |
| `useEffect` (mount) | `onMount()` | Simple |
| `useEffect` (deps) | `$effect()` | Simple |
| `useMemo` | `$derived()` | Simple |
| `useCallback` | Regular function | Simpler! |
| `useRef` (DOM) | `bind:this` | Simple |
| `useRef` (value) | `let` variable | Simpler! |
| `useContext` | `getContext()`/`setContext()` | Simple |
| `useReducer` | `$state()` + functions | Simpler! |
| `useLayoutEffect` | `$effect.pre()` | Simple |
| `useImperativeHandle` | Export functions | Simpler! |
| Custom hooks | Functions with runes | Simple |
