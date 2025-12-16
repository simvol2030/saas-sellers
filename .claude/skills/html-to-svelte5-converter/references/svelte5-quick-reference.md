# Svelte 5 Quick Reference

Quick lookup guide for Svelte 5 runes syntax and common patterns.

## Runes Overview

| Rune | Purpose | Example |
|------|---------|---------|
| `$state()` | Reactive state | `let count = $state(0)` |
| `$derived()` | Computed values | `let doubled = $derived(count * 2)` |
| `$effect()` | Side effects | `$effect(() => console.log(count))` |
| `$props()` | Component props | `let { title } = $props()` |
| `$bindable()` | Two-way binding | `let { value = $bindable() } = $props()` |

---

## State Management

### Basic State
```svelte
<script>
  let count = $state(0);
  let name = $state('');
  let items = $state([]);
</script>
```

### Object State
```svelte
<script>
  let user = $state({
    name: 'John',
    age: 30
  });

  // Mutation works with proxies
  user.age++;
</script>
```

### Array State
```svelte
<script>
  let todos = $state([
    { id: 1, text: 'Learn Svelte', done: false }
  ]);

  // Array methods work reactively
  todos.push({ id: 2, text: 'Build app', done: false });
  todos[0].done = true;
</script>
```

---

## Derived Values

### Simple Derived
```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
```

### Complex Derived with $derived.by
```svelte
<script>
  let numbers = $state([1, 2, 3, 4, 5]);

  let total = $derived.by(() => {
    let sum = 0;
    for (const n of numbers) {
      sum += n;
    }
    return sum;
  });
</script>
```

---

## Effects

### Basic Effect
```svelte
<script>
  let count = $state(0);

  $effect(() => {
    console.log('Count is now:', count);
  });
</script>
```

### Effect with Cleanup
```svelte
<script>
  let count = $state(0);

  $effect(() => {
    const interval = setInterval(() => {
      count++;
    }, 1000);

    return () => clearInterval(interval);
  });
</script>
```

### Pre-effect (runs before DOM updates)
```svelte
<script>
  let value = $state('');

  $effect.pre(() => {
    // Runs before DOM updates
    console.log('About to update DOM');
  });
</script>
```

---

## Props

### Basic Props
```svelte
<script>
  let { title, subtitle } = $props();
</script>

<h1>{title}</h1>
<p>{subtitle}</p>
```

### Props with Defaults
```svelte
<script>
  let {
    title,
    subtitle = 'Default subtitle',
    count = 0
  } = $props();
</script>
```

### Props with TypeScript
```svelte
<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    onSubmit?: (data: FormData) => void;
  }

  let { title, subtitle = '', onSubmit }: Props = $props();
</script>
```

### Bindable Props
```svelte
<script>
  // In child component
  let { value = $bindable() } = $props();
</script>

<input bind:value />

<!-- In parent component -->
<ChildComponent bind:value={parentValue} />
```

---

## Event Handlers

### All event handlers use lowercase without colons

```svelte
<button onclick={handleClick}>Click</button>
<input oninput={handleInput} />
<form onsubmit={handleSubmit} />
<div onmouseenter={handleEnter} onmouseleave={handleLeave} />
```

### Inline Handlers
```svelte
<button onclick={() => count++}>Increment</button>
<button onclick={(e) => handleClick(e, id)}>Click</button>
```

### Event Modifiers (still use `:`)
```svelte
<button onclick|preventDefault={handleClick}>Submit</button>
<div onclick|stopPropagation={handleClick}>Click</div>
<input onkeydown|escape={close} />
```

---

## Template Syntax

### Conditionals
```svelte
{#if condition}
  <p>True</p>
{:else if otherCondition}
  <p>Other</p>
{:else}
  <p>False</p>
{/if}
```

### Loops
```svelte
<!-- With index -->
{#each items as item, i}
  <div>{i}: {item}</div>
{/each}

<!-- With key for performance -->
{#each items as item (item.id)}
  <div>{item.name}</div>
{/each}

<!-- With else fallback -->
{#each items as item}
  <div>{item}</div>
{:else}
  <p>No items</p>
{/each}
```

### Await
```svelte
{#await promise}
  <p>Loading...</p>
{:then value}
  <p>Result: {value}</p>
{:catch error}
  <p>Error: {error.message}</p>
{/await}
```

---

## Bindings

### Input Bindings
```svelte
<input type="text" bind:value={name} />
<input type="number" bind:value={age} />
<input type="checkbox" bind:checked={agreed} />
<input type="radio" bind:group={selected} value="option1" />
<textarea bind:value={text} />
<select bind:value={selected}>
  <option value="a">A</option>
  <option value="b">B</option>
</select>
```

### Element Bindings
```svelte
<script>
  let div;
  let canvas;

  $effect(() => {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Draw on canvas
    }
  });
</script>

<div bind:this={div}>...</div>
<canvas bind:this={canvas}></canvas>
```

### Dimension Bindings
```svelte
<script>
  let width = $state(0);
  let height = $state(0);
</script>

<div bind:clientWidth={width} bind:clientHeight={height}>
  Size: {width} x {height}
</div>
```

---

## Class and Style

### Class Attribute (Svelte 5.16+)
```svelte
<script>
  let active = $state(false);
  let disabled = $state(false);
</script>

<!-- Object syntax -->
<div class={{ active, disabled, 'custom-class': true }}>

<!-- Array syntax -->
<div class={[active && 'active', disabled && 'disabled']}>

<!-- Mixed -->
<div class={['base-class', { active, disabled }]}>
```

### Class Directive (legacy, still works)
```svelte
<div class:active={active} class:disabled>
```

### Style Directive
```svelte
<script>
  let color = $state('#ff3e00');
  let size = $state(16);
</script>

<div style:color style:font-size="{size}px">
  Styled text
</div>
```

---

## Component Communication

### Parent to Child (Props)
```svelte
<!-- Parent -->
<Child title="Hello" count={5} />

<!-- Child -->
<script>
  let { title, count } = $props();
</script>
```

### Child to Parent (Callbacks)
```svelte
<!-- Parent -->
<script>
  function handleSubmit(data) {
    console.log('Received:', data);
  }
</script>
<Child onSubmit={handleSubmit} />

<!-- Child -->
<script>
  let { onSubmit } = $props();
</script>
<button onclick={() => onSubmit?.({ value: 'test' })}>
  Submit
</button>
```

### Two-way Binding
```svelte
<!-- Parent -->
<Child bind:value={parentValue} />

<!-- Child -->
<script>
  let { value = $bindable() } = $props();
</script>
<input bind:value />
```

---

## Lifecycle

### onMount
```svelte
<script>
  import { onMount } from 'svelte';

  onMount(() => {
    console.log('Component mounted');

    return () => {
      console.log('Component will unmount');
    };
  });
</script>
```

### onDestroy
```svelte
<script>
  import { onDestroy } from 'svelte';

  onDestroy(() => {
    console.log('Component destroyed');
  });
</script>
```

### tick (await DOM updates)
```svelte
<script>
  import { tick } from 'svelte';

  async function handleClick() {
    count++;
    await tick(); // Wait for DOM to update
    // DOM is now updated
  }
</script>
```

---

## Common Mistakes to Avoid

### ❌ Wrong: Svelte 4 Syntax
```svelte
<script>
  let count = 0;
  $: doubled = count * 2;
  export let title;
</script>
<button on:click={increment}>
```

### ✅ Correct: Svelte 5 Syntax
```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { title } = $props();
</script>
<button onclick={increment}>
```

### ❌ Wrong: Using className
```svelte
<div className="container">
```

### ✅ Correct: Using class
```svelte
<div class="container">
```

### ❌ Wrong: Mutating props without $bindable
```svelte
<script>
  let { count } = $props();
  count++; // Warning!
</script>
```

### ✅ Correct: Use callback or $bindable
```svelte
<script>
  let { count = $bindable() } = $props();
  count++; // OK
</script>
```

---

## TypeScript Integration

### Component with Types
```svelte
<script lang="ts">
  interface Item {
    id: number;
    name: string;
    active: boolean;
  }

  interface Props {
    items: Item[];
    onSelect?: (item: Item) => void;
  }

  let { items, onSelect }: Props = $props();

  let selectedItem = $state<Item | null>(null);
</script>
```

### Generic Components
```svelte
<script lang="ts" generics="T">
  interface Props<T> {
    items: T[];
    renderItem: (item: T) => string;
  }

  let { items, renderItem }: Props<T> = $props();
</script>

{#each items as item}
  <div>{renderItem(item)}</div>
{/each}
```

---

## Performance Tips

1. **Use keyed each blocks** for dynamic lists:
   ```svelte
   {#each items as item (item.id)}
   ```

2. **Avoid unnecessary effects** - use `$derived` instead:
   ```svelte
   // ✅ Better
   let total = $derived(items.reduce((sum, item) => sum + item.price, 0));

   // ❌ Avoid
   let total = $state(0);
   $effect(() => {
     total = items.reduce((sum, item) => sum + item.price, 0);
   });
   ```

3. **Use `$state.raw`** for large immutable objects:
   ```svelte
   let largeData = $state.raw(bigObjectFromAPI);
   ```

4. **Batch state updates** - they happen automatically in Svelte 5

---

## SvelteKit Compatibility

### Browser-only code
```svelte
<script>
  import { browser } from '$app/environment';

  let windowWidth = $state(0);

  $effect(() => {
    if (browser) {
      windowWidth = window.innerWidth;
    }
  });
</script>
```

### Progressive enhancement
```svelte
<form method="POST" action="?/login" onsubmit={handleSubmit}>
  <!-- Works with and without JS -->
</form>
```
