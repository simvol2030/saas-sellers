---
name: html-to-svelte5-converter
description: Use this skill proactively when analyzing, converting, or decomposing HTML/CSS/JS files into Svelte 5 components. Trigger when user mentions converting HTML to Svelte, creating Svelte components from static files, migrating HTML pages to Svelte, or decomposing HTML into modular components. Always use MCP Svelte documentation during conversion to ensure correct Svelte 5 runes syntax ($state, $derived, $effect, $props) and SvelteKit compatibility.
---

# HTML to Svelte 5 Converter

## Overview

Convert static HTML/CSS/JS files into modern, reactive Svelte 5 components with proper runes syntax. This skill guides through analysis, decomposition, agreement, generation, and iterative refinement of components ready for SvelteKit projects.

## Workflow Decision Tree

**When to use this skill:**
- User provides HTML file(s) for conversion to Svelte
- User wants to decompose HTML into reusable components
- User mentions "convert to Svelte", "create Svelte components from HTML"
- User wants to modernize static HTML pages with Svelte 5

**This skill will NOT:**
- Create new HTML designs from scratch
- Handle React/Vue to Svelte conversions (different workflow)
- Work with Svelte 4 syntax (only Svelte 5 with runes)

## Step 1: Analysis of Source Files

When user provides HTML/CSS/JS files for conversion:

1. **Read all provided files** to understand:
   - HTML structure and semantic markup
   - CSS styling (embedded, inline, or external)
   - JavaScript functionality (event handlers, dynamic behavior)
   - Dependencies between elements

2. **Identify interactive elements:**
   - Forms with validation
   - Dynamic content (counters, timers, etc.)
   - Event handlers (clicks, inputs, etc.)
   - State-dependent elements

3. **Map JavaScript to Svelte 5 equivalents:**
   - `let` variables → `$state()`
   - Computed values → `$derived()`
   - Event listeners → `$effect()` or component lifecycle
   - DOM manipulation → Reactive bindings

## Step 2: Decomposition into Components

Break down HTML into logical, reusable components:

### Component Categorization

**Content Sections** (static or semi-static blocks):
- Hero sections
- Feature grids
- Testimonials
- Pricing tables
- FAQ sections

**UI Modules** (interactive elements):
- Navigation bars
- Modals/dialogs
- Forms (login, signup, contact)
- Cards (product, user, article)
- Accordions/tabs

**Functional Modules** (complex interactions):
- Data tables with sorting/filtering
- Image galleries/carousels
- Search components
- Shopping carts
- Real-time widgets

### Component Naming Convention

Follow Svelte best practices:
- **PascalCase**: `HeroSection.svelte`, `ProductCard.svelte`
- **Descriptive**: Indicate purpose clearly
- **Hierarchical**: `Nav/NavBar.svelte`, `Nav/NavItem.svelte` for nested structures

### Example Decomposition

```
landing-page.html + styles.css + script.js
↓
├── Header.svelte          (navigation + logo)
├── HeroSection.svelte     (main banner with CTA)
├── Features.svelte        (features grid)
│   └── FeatureCard.svelte (individual feature)
├── Testimonials.svelte    (testimonials carousel)
├── PricingCards.svelte    (pricing comparison)
└── Footer.svelte          (footer links + social)
```

## Step 3: Agreement with User

Present decomposition plan for approval:

```markdown
I've analyzed the HTML files. Here's the proposed component structure:

**Components to create:**

1. **Header.svelte** - Navigation bar with logo and menu items
   - Props: `menuItems` (array), `logoUrl` (string)
   - Interactive: Mobile menu toggle

2. **HeroSection.svelte** - Main banner section
   - Props: `title`, `subtitle`, `ctaText`, `ctaLink`
   - Interactive: Button click tracking

3. **FeatureCard.svelte** - Reusable feature card
   - Props: `icon`, `title`, `description`
   - Non-interactive

... (continue for all components)

**Questions:**
- Should pricing cards be static or fetch data dynamically?
- Do you want dark mode support built-in?
- Any specific TypeScript types needed?

Please confirm or request changes before I proceed with generation.
```

**Wait for user confirmation before proceeding to Step 4.**

## Step 4: Generate Svelte 5 Components

### CRITICAL: Always Use MCP Documentation

**BEFORE generating ANY component**, fetch relevant Svelte 5 documentation:

```javascript
// ALWAYS call this first:
mcp__svelte-llm__get_documentation({
  section: ["What are runes?", "$state", "$derived", "$effect", "$props", "Basic markup", "class", "Scoped styles"]
})
```

Fetch additional sections as needed for specific features:
- Forms: `bind:`, `{#if ...}`, `{#each ...}`
- Animations: `transition:`, `animate:`
- Advanced: `$effect.pre`, `Context`, `Lifecycle hooks`

### Svelte 5 Runes Syntax Rules (MANDATORY)

**DO NOT use Svelte 4 syntax. ONLY use Svelte 5 runes:**

#### State Management
```svelte
<!-- ✅ CORRECT: Svelte 5 -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log('Count changed:', count);
  });
</script>

<!-- ❌ WRONG: Svelte 4 syntax -->
<script>
  let count = 0;
  $: doubled = count * 2;
  $: console.log('Count changed:', count);
</script>
```

#### Props
```svelte
<!-- ✅ CORRECT: Svelte 5 -->
<script>
  let { title, subtitle = 'Default subtitle' } = $props();
</script>

<!-- ❌ WRONG: Svelte 4 -->
<script>
  export let title;
  export let subtitle = 'Default subtitle';
</script>
```

#### Event Handlers
```svelte
<!-- ✅ CORRECT: Svelte 5 (no colon) -->
<button onclick={handleClick}>Click me</button>
<input oninput={handleInput} />
<form onsubmit={handleSubmit}>

<!-- ❌ WRONG: Svelte 4 -->
<button on:click={handleClick}>Click me</button>
<input on:input={handleInput} />
<form on:submit={handleSubmit}>
```

#### Class Attribute
```svelte
<!-- ✅ CORRECT: Use 'class', not 'className' -->
<div class="container">
<div class={{ active, disabled }}>

<!-- ❌ WRONG: React syntax -->
<div className="container">
```

### Component Template Structure

Every generated `.svelte` file should follow this structure:

```svelte
<script lang="ts">
  // 1. Imports (if needed)
  import type { ComponentType } from 'svelte';

  // 2. Props with TypeScript types
  let {
    title,
    subtitle = 'Default value',
    items = []
  }: {
    title: string;
    subtitle?: string;
    items?: Array<{ id: number; name: string }>;
  } = $props();

  // 3. Local state with $state
  let isOpen = $state(false);
  let count = $state(0);

  // 4. Derived values with $derived
  let filteredItems = $derived(
    items.filter(item => item.name.includes(searchTerm))
  );

  // 5. Effects with $effect (if needed)
  $effect(() => {
    // Side effects, API calls, subscriptions
    console.log('Component mounted or state changed');
  });

  // 6. Functions
  function handleClick() {
    count++;
  }
</script>

<!-- 7. Template -->
<div class="component-wrapper">
  <h1>{title}</h1>
  {#if subtitle}
    <p>{subtitle}</p>
  {/if}

  <button onclick={handleClick}>
    Clicked {count} times
  </button>

  {#each filteredItems as item (item.id)}
    <div>{item.name}</div>
  {/each}
</div>

<!-- 8. Scoped styles -->
<style>
  .component-wrapper {
    padding: 1rem;
  }

  h1 {
    font-size: 2rem;
    color: var(--primary-color, #333);
  }
</style>
```

### TypeScript Support

Always include proper TypeScript types:

```svelte
<script lang="ts">
  interface Props {
    title: string;
    items: Array<{
      id: number;
      name: string;
      active: boolean;
    }>;
    onItemClick?: (id: number) => void;
  }

  let { title, items, onItemClick }: Props = $props();
</script>
```

### Converting HTML Forms

HTML form example:
```html
<form id="loginForm">
  <input type="email" id="email" required>
  <input type="password" id="password" required>
  <button type="submit">Login</button>
  <span id="error"></span>
</form>

<script>
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    // validation logic...
  });
</script>
```

Svelte 5 equivalent:
```svelte
<script lang="ts">
  let email = $state('');
  let password = $state('');
  let error = $state('');

  let isValid = $derived(
    email.includes('@') && password.length >= 8
  );

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!isValid) {
      error = 'Invalid email or password too short';
      return;
    }

    // Login logic here
    console.log({ email, password });
  }
</script>

<form onsubmit={handleSubmit}>
  <input
    type="email"
    bind:value={email}
    required
  />
  <input
    type="password"
    bind:value={password}
    required
  />
  <button type="submit" disabled={!isValid}>
    Login
  </button>

  {#if error}
    <span class="error">{error}</span>
  {/if}
</form>

<style>
  .error {
    color: red;
    font-size: 0.875rem;
  }
</style>
```

### Converting JavaScript Event Handlers

HTML with vanilla JS:
```html
<div id="counter">0</div>
<button id="increment">+</button>
<button id="decrement">-</button>

<script>
  let count = 0;
  const display = document.getElementById('counter');

  document.getElementById('increment').addEventListener('click', () => {
    count++;
    display.textContent = count;
  });

  document.getElementById('decrement').addEventListener('click', () => {
    count--;
    display.textContent = count;
  });
</script>
```

Svelte 5 equivalent:
```svelte
<script>
  let count = $state(0);
</script>

<div>{count}</div>
<button onclick={() => count++}>+</button>
<button onclick={() => count--}>-</button>
```

### SvelteKit Compatibility

Ensure components are SvelteKit-ready:

1. **Use `$lib` imports:**
   ```svelte
   <script>
     import Button from '$lib/components/Button.svelte';
     import { formatDate } from '$lib/utils/date';
   </script>
   ```

2. **Server-safe code:**
   - Avoid `window`, `document` in top-level code
   - Use `$effect()` for browser-only code

   ```svelte
   <script>
     let windowWidth = $state(0);

     $effect(() => {
       // Runs only in browser
       windowWidth = window.innerWidth;

       const handleResize = () => {
         windowWidth = window.innerWidth;
       };

       window.addEventListener('resize', handleResize);

       return () => {
         window.removeEventListener('resize', handleResize);
       };
     });
   </script>
   ```

3. **Progressive enhancement:**
   - Components should work with JS disabled when possible
   - Use semantic HTML

## Step 5: User Testing & Iteration

After generating each component:

1. **Present complete code:**
   ```markdown
   Here's `ComponentName.svelte`:

   ```svelte
   [full component code]
   ```

   **Svelte 5 features used:**
   - `$state()` for reactive count
   - `$derived()` for computed values
   - `onclick` event handler (not `on:click`)
   - TypeScript types for props

   **Testing:** Copy this code to https://svelte.dev/playground to test
   ```

2. **Wait for user feedback:**
   - User tests in playground
   - User reports errors or requests changes
   - Fix and iterate

3. **Iterative fixes:**
   - Read error messages carefully
   - Check MCP documentation if unsure
   - Apply fixes and present updated code

## Common Conversion Patterns

### Pattern: Conditional Rendering

HTML:
```html
<div id="message" style="display: none;">Hello!</div>
<button onclick="document.getElementById('message').style.display='block'">Show</button>
```

Svelte 5:
```svelte
<script>
  let visible = $state(false);
</script>

{#if visible}
  <div>Hello!</div>
{/if}
<button onclick={() => visible = true}>Show</button>
```

### Pattern: Lists

HTML:
```html
<ul id="list"></ul>
<script>
  const items = ['Apple', 'Banana', 'Cherry'];
  const ul = document.getElementById('list');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
</script>
```

Svelte 5:
```svelte
<script>
  let items = $state(['Apple', 'Banana', 'Cherry']);
</script>

<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>
```

### Pattern: Timers/Intervals

HTML:
```html
<div id="timer">0</div>
<script>
  let seconds = 0;
  setInterval(() => {
    seconds++;
    document.getElementById('timer').textContent = seconds;
  }, 1000);
</script>
```

Svelte 5:
```svelte
<script>
  import { onMount } from 'svelte';

  let seconds = $state(0);

  onMount(() => {
    const interval = setInterval(() => {
      seconds++;
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<div>{seconds}</div>
```

## Quality Checklist

Before marking a component complete, verify:

- [ ] **MCP documentation consulted** for all Svelte 5 features used
- [ ] **Only Svelte 5 runes syntax** used (no Svelte 4)
  - [ ] `$state()` instead of `let`
  - [ ] `$derived()` instead of `$:`
  - [ ] `$effect()` instead of reactive `$:`
  - [ ] `$props()` instead of `export let`
  - [ ] `onclick` instead of `on:click`
- [ ] **TypeScript types** added for props and complex state
- [ ] **Scoped styles** included (if needed)
- [ ] **SvelteKit compatible** (no browser globals in top-level)
- [ ] **Tested in Svelte playground** by user
- [ ] **No errors or warnings** in playground

## Error Handling

If user reports errors from playground:

1. **Read the error message carefully**
2. **Check documentation** via MCP if needed
3. **Common issues:**
   - Using `on:click` instead of `onclick` → Fix: remove colon
   - Using `export let` → Fix: use `$props()`
   - Using `$:` for reactivity → Fix: use `$derived()` or `$effect()`
   - Missing TypeScript types → Fix: add proper types
4. **Apply fix and re-present code**

## Notes

- This skill focuses on **Svelte 5 ONLY** - never use Svelte 4 syntax
- Always verify syntax against MCP documentation
- Encourage user to test each component in playground before moving to next
- Components should be production-ready for SvelteKit projects
- Maintain clean, readable code with proper TypeScript types

## References

This skill includes helpful reference files in the `references/` directory:

### conversion-patterns.md
Common HTML/JS patterns and their Svelte 5 equivalents. Use this when converting:
- State management (counters, toggles)
- Forms (input binding, submission)
- Lists (dynamic rendering, filtering)
- Timers and intervals
- Modals and tabs

**When to read:** When encountering a specific HTML pattern that needs conversion.

### svelte5-quick-reference.md
Quick lookup guide for Svelte 5 syntax and runes. Contains:
- Runes overview ($state, $derived, $effect, $props)
- Template syntax (conditionals, loops, await)
- Bindings (input, element, dimensions)
- Class and style directives
- Component communication patterns

**When to read:** When unsure about correct Svelte 5 syntax or need a quick reminder.

### component-templates.md
Ready-to-use Svelte 5 component templates for common UI patterns:
- Navigation bars (with mobile menu)
- Login forms (with validation)
- Product cards
- Modal dialogs
- Data tables (with sorting)
- Accordions
- Search/filter components

**When to read:** When creating a component similar to these templates - use as a starting point and adapt.
