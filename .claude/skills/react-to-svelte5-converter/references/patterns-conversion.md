# React Patterns → Svelte 5 Conversion

Common React patterns and their idiomatic Svelte 5 equivalents.

---

## Conditional Rendering

### Simple Condition

**React:**
```jsx
{isLoggedIn && <Dashboard />}
{error && <ErrorMessage error={error} />}
{count > 0 && <p>Count: {count}</p>}
```

**Svelte 5:**
```svelte
{#if isLoggedIn}
  <Dashboard />
{/if}

{#if error}
  <ErrorMessage {error} />
{/if}

{#if count > 0}
  <p>Count: {count}</p>
{/if}
```

### If-Else

**React:**
```jsx
{isLoggedIn ? <Dashboard /> : <Login />}
{loading ? <Spinner /> : <Content />}
```

**Svelte 5:**
```svelte
{#if isLoggedIn}
  <Dashboard />
{:else}
  <Login />
{/if}

{#if loading}
  <Spinner />
{:else}
  <Content />
{/if}
```

### Multiple Conditions

**React:**
```jsx
{status === 'loading' ? (
  <Spinner />
) : status === 'error' ? (
  <Error />
) : (
  <Content />
)}
```

**Svelte 5:**
```svelte
{#if status === 'loading'}
  <Spinner />
{:else if status === 'error'}
  <Error />
{:else}
  <Content />
{/if}
```

---

## Lists and Iteration

### Basic List

**React:**
```jsx
{items.map(item => (
  <div key={item.id}>{item.name}</div>
))}
```

**Svelte 5:**
```svelte
{#each items as item (item.id)}
  <div>{item.name}</div>
{/each}
```

### With Index

**React:**
```jsx
{items.map((item, index) => (
  <div key={item.id}>
    {index + 1}. {item.name}
  </div>
))}
```

**Svelte 5:**
```svelte
{#each items as item, index (item.id)}
  <div>
    {index + 1}. {item.name}
  </div>
{/each}
```

### Empty State

**React:**
```jsx
{items.length > 0 ? (
  items.map(item => <Item key={item.id} {...item} />)
) : (
  <EmptyState />
)}
```

**Svelte 5:**
```svelte
{#each items as item (item.id)}
  <Item {...item} />
{:else}
  <EmptyState />
{/each}
```

### Nested Lists

**React:**
```jsx
{categories.map(category => (
  <div key={category.id}>
    <h3>{category.name}</h3>
    {category.items.map(item => (
      <div key={item.id}>{item.name}</div>
    ))}
  </div>
))}
```

**Svelte 5:**
```svelte
{#each categories as category (category.id)}
  <div>
    <h3>{category.name}</h3>
    {#each category.items as item (item.id)}
      <div>{item.name}</div>
    {/each}
  </div>
{/each}
```

---

## Forms and Inputs

### Controlled Input

**React:**
```jsx
const [value, setValue] = useState('');

<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text"
/>
```

**Svelte 5:**
```svelte
<script>
  let value = $state('');
</script>

<input
  bind:value
  placeholder="Enter text"
/>
```

### Checkbox

**React:**
```jsx
const [checked, setChecked] = useState(false);

<input
  type="checkbox"
  checked={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>
```

**Svelte 5:**
```svelte
<script>
  let checked = $state(false);
</script>

<input type="checkbox" bind:checked />
```

### Radio Buttons

**React:**
```jsx
const [selected, setSelected] = useState('option1');

<input
  type="radio"
  name="options"
  value="option1"
  checked={selected === 'option1'}
  onChange={(e) => setSelected(e.target.value)}
/>
<input
  type="radio"
  name="options"
  value="option2"
  checked={selected === 'option2'}
  onChange={(e) => setSelected(e.target.value)}
/>
```

**Svelte 5:**
```svelte
<script>
  let selected = $state('option1');
</script>

<input type="radio" bind:group={selected} value="option1" />
<input type="radio" bind:group={selected} value="option2" />
```

### Select Dropdown

**React:**
```jsx
const [selected, setSelected] = useState('');

<select value={selected} onChange={(e) => setSelected(e.target.value)}>
  <option value="">Select...</option>
  <option value="a">Option A</option>
  <option value="b">Option B</option>
</select>
```

**Svelte 5:**
```svelte
<script>
  let selected = $state('');
</script>

<select bind:value={selected}>
  <option value="">Select...</option>
  <option value="a">Option A</option>
  <option value="b">Option B</option>
</select>
```

### Form Submission

**React:**
```jsx
const [formData, setFormData] = useState({ email: '', password: '' });

const handleSubmit = (e) => {
  e.preventDefault();
  console.log(formData);
};

const handleChange = (e) => {
  setFormData({ ...formData, [e.target.name]: e.target.value });
};

<form onSubmit={handleSubmit}>
  <input name="email" value={formData.email} onChange={handleChange} />
  <input name="password" type="password" value={formData.password} onChange={handleChange} />
  <button type="submit">Submit</button>
</form>
```

**Svelte 5:**
```svelte
<script>
  let formData = $state({ email: '', password: '' });

  function handleSubmit(e) {
    e.preventDefault();
    console.log(formData);
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={formData.email} />
  <input type="password" bind:value={formData.password} />
  <button type="submit">Submit</button>
</form>
```

---

## Component Communication

### Props Down

**React:**
```jsx
function Parent() {
  const [count, setCount] = useState(0);

  return <Child count={count} onIncrement={() => setCount(c => c + 1)} />;
}

function Child({ count, onIncrement }) {
  return (
    <div>
      <p>{count}</p>
      <button onClick={onIncrement}>Increment</button>
    </div>
  );
}
```

**Svelte 5:**
```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<Child {count} onIncrement={increment} />
```

```svelte
<!-- Child.svelte -->
<script>
  let { count, onIncrement } = $props();
</script>

<div>
  <p>{count}</p>
  <button onclick={onIncrement}>Increment</button>
</div>
```

### Two-Way Binding

**React (via callback):**
```jsx
function Parent() {
  const [value, setValue] = useState('');

  return <Input value={value} onChange={setValue} />;
}

function Input({ value, onChange }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}
```

**Svelte 5 (bind directive):**
```svelte
<!-- Parent.svelte -->
<script>
  import Input from './Input.svelte';

  let value = $state('');
</script>

<Input bind:value />
```

```svelte
<!-- Input.svelte -->
<script>
  let { value = $bindable() } = $props();
</script>

<input bind:value />
```

---

## Context Pattern

### Theme Context

**React:**
```jsx
const ThemeContext = createContext();

function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      <ThemedButton />
    </ThemeContext.Provider>
  );
}

function ThemedButton() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button onClick={toggleTheme} className={theme}>
      Toggle ({theme})
    </button>
  );
}
```

**Svelte 5:**
```svelte
<!-- App.svelte -->
<script>
  import { setContext } from 'svelte';
  import ThemedButton from './ThemedButton.svelte';

  let theme = $state('light');

  setContext('theme', {
    get value() { return theme; },
    toggle: () => { theme = theme === 'light' ? 'dark' : 'light'; }
  });
</script>

<ThemedButton />
```

```svelte
<!-- ThemedButton.svelte -->
<script>
  import { getContext } from 'svelte';

  const theme = getContext('theme');
</script>

<button onclick={theme.toggle} class={theme.value}>
  Toggle ({theme.value})
</button>
```

---

## Async Patterns

### Data Fetching

**React:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (!cancelled) {
          setUser(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <div>{user.name}</div>;
}
```

**Svelte 5 (with promise):**
```svelte
<script>
  let { userId } = $props();

  let userPromise = $derived(
    fetch(`/api/users/${userId}`).then(r => r.json())
  );
</script>

{#await userPromise}
  <div>Loading...</div>
{:then user}
  <div>{user.name}</div>
{:catch error}
  <div>Error: {error.message}</div>
{/await}
```

**Svelte 5 (with state):**
```svelte
<script>
  import { onMount } from 'svelte';

  let { userId } = $props();

  let user = $state(null);
  let loading = $state(true);
  let error = $state(null);

  $effect(() => {
    let cancelled = false;

    async function fetchUser() {
      loading = true;
      error = null;

      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (!cancelled) {
          user = data;
        }
      } catch (err) {
        if (!cancelled) {
          error = err.message;
        }
      } finally {
        if (!cancelled) {
          loading = false;
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  });
</script>

{#if loading}
  <div>Loading...</div>
{:else if error}
  <div>Error: {error}</div>
{:else}
  <div>{user.name}</div>
{/if}
```

---

## Higher-Order Components → Wrapper Components

**React HOC:**
```jsx
function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user } = useAuth();

    if (!user) {
      return <Login />;
    }

    return <Component {...props} user={user} />;
  };
}

const ProtectedDashboard = withAuth(Dashboard);
```

**Svelte 5 Wrapper:**
```svelte
<!-- AuthWrapper.svelte -->
<script>
  import { getContext } from 'svelte';
  import Login from './Login.svelte';

  let { children } = $props();

  const user = getContext('user');
</script>

{#if user}
  {@render children?.()}
{:else}
  <Login />
{/if}
```

**Usage:**
```svelte
<AuthWrapper>
  <Dashboard />
</AuthWrapper>
```

---

## Render Props → Snippets

**React:**
```jsx
function DataProvider({ children }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return children({ data, refetch: () => fetchData().then(setData) });
}

// Usage:
<DataProvider>
  {({ data, refetch }) => (
    <div>
      {data.map(item => <div key={item.id}>{item.name}</div>)}
      <button onClick={refetch}>Refetch</button>
    </div>
  )}
</DataProvider>
```

**Svelte 5:**
```svelte
<!-- DataProvider.svelte -->
<script>
  import { onMount } from 'svelte';

  let { children } = $props();

  let data = $state([]);

  async function refetch() {
    data = await fetchData();
  }

  onMount(refetch);
</script>

{@render children?.({ data, refetch })}
```

**Usage:**
```svelte
<script>
  import DataProvider from './DataProvider.svelte';
</script>

<DataProvider>
  {#snippet children({ data, refetch })}
    <div>
      {#each data as item (item.id)}
        <div>{item.name}</div>
      {/each}
      <button onclick={refetch}>Refetch</button>
    </div>
  {/snippet}
</DataProvider>
```

---

## Portal Pattern

**React:**
```jsx
import { createPortal } from 'react-dom';

function Modal({ children, isOpen }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-content">
        {children}
      </div>
    </div>,
    document.body
  );
}
```

**Svelte 5 (no portal needed, render in place):**
```svelte
<script>
  let { children, isOpen } = $props();
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal-content">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }
</style>
```

**Svelte 5 (with action for true portal):**
```svelte
<script>
  let { children, isOpen } = $props();

  function portal(node) {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      }
    };
  }
</script>

{#if isOpen}
  <div use:portal class="modal">
    {@render children?.()}
  </div>
{/if}
```

---

## Lazy Loading

**React:**
```jsx
const LazyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
}
```

**Svelte 5:**
```svelte
<script>
  let component = $state(null);

  onMount(async () => {
    const module = await import('./HeavyComponent.svelte');
    component = module.default;
  });
</script>

{#if component}
  <svelte:component this={component} />
{:else}
  <div>Loading...</div>
{/if}
```

**Or with promise:**
```svelte
<script>
  const componentPromise = import('./HeavyComponent.svelte');
</script>

{#await componentPromise}
  <div>Loading...</div>
{:then module}
  <svelte:component this={module.default} />
{/await}
```

---

## Error Boundaries

**React:**
```jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error: {this.state.error.message}</div>;
    }

    return this.props.children;
  }
}
```

**Svelte 5:**
```svelte
<svelte:boundary onerror={(error) => console.error('Error:', error)}>
  {#snippet failed(error)}
    <div>Error: {error.message}</div>
  {/snippet}

  <YourComponents />
</svelte:boundary>
```

---

## Compound Components

**React:**
```jsx
const Tabs = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

Tabs.List = ({ children }) => <div className="tabs-list">{children}</div>;
Tabs.Tab = ({ index, children }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return <button onClick={() => setActiveTab(index)}>{children}</button>;
};
Tabs.Panel = ({ index, children }) => {
  const { activeTab } = useContext(TabsContext);
  return activeTab === index ? <div>{children}</div> : null;
};

// Usage:
<Tabs>
  <Tabs.List>
    <Tabs.Tab index={0}>Tab 1</Tabs.Tab>
    <Tabs.Tab index={1}>Tab 2</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel index={0}>Content 1</Tabs.Panel>
  <Tabs.Panel index={1}>Content 2</Tabs.Panel>
</Tabs>
```

**Svelte 5:**
```svelte
<!-- Tabs.svelte -->
<script>
  import { setContext } from 'svelte';

  let { children } = $props();

  let activeTab = $state(0);

  setContext('tabs', {
    get active() { return activeTab; },
    setActive: (index) => { activeTab = index; }
  });
</script>

{@render children?.()}
```

```svelte
<!-- TabList.svelte -->
<script>
  let { children } = $props();
</script>

<div class="tabs-list">
  {@render children?.()}
</div>
```

```svelte
<!-- Tab.svelte -->
<script>
  import { getContext } from 'svelte';

  let { index, children } = $props();

  const tabs = getContext('tabs');
</script>

<button onclick={() => tabs.setActive(index)}>
  {@render children?.()}
</button>
```

```svelte
<!-- TabPanel.svelte -->
<script>
  import { getContext } from 'svelte';

  let { index, children } = $props();

  const tabs = getContext('tabs');
</script>

{#if tabs.active === index}
  <div>
    {@render children?.()}
  </div>
{/if}
```

**Usage:**
```svelte
<script>
  import Tabs from './Tabs.svelte';
  import TabList from './TabList.svelte';
  import Tab from './Tab.svelte';
  import TabPanel from './TabPanel.svelte';
</script>

<Tabs>
  <TabList>
    <Tab index={0}>Tab 1</Tab>
    <Tab index={1}>Tab 2</Tab>
  </TabList>
  <TabPanel index={0}>Content 1</TabPanel>
  <TabPanel index={1}>Content 2</TabPanel>
</Tabs>
```

---

## Pattern Summary

| React Pattern | Svelte 5 Equivalent | Simplicity |
|---------------|---------------------|------------|
| Conditional `&&` | `{#if}` | Same |
| Ternary | `{#if}{:else}` | Clearer |
| `.map()` | `{#each}` | Same |
| Controlled inputs | `bind:value` | Simpler |
| HOC | Wrapper components | Simpler |
| Render props | Snippets | Clearer |
| Context | Context API | Similar |
| Portals | Usually not needed | Simpler |
| Error boundaries | `<svelte:boundary>` | Similar |
| Lazy loading | Dynamic imports | Same |

Most React patterns have simpler or clearer equivalents in Svelte 5!
