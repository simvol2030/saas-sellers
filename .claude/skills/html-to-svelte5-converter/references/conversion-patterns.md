# HTML to Svelte 5 Conversion Patterns

This reference contains common HTML/JS patterns and their Svelte 5 equivalents.

## State Management Patterns

### Simple Counter

**HTML + Vanilla JS:**
```html
<div id="count">0</div>
<button id="inc">+</button>
<script>
  let count = 0;
  document.getElementById('inc').onclick = () => {
    count++;
    document.getElementById('count').textContent = count;
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let count = $state(0);
</script>

<div>{count}</div>
<button onclick={() => count++}>+</button>
```

---

### Toggle Visibility

**HTML + Vanilla JS:**
```html
<div id="content" style="display: none;">Hidden content</div>
<button id="toggle">Toggle</button>
<script>
  const content = document.getElementById('content');
  document.getElementById('toggle').onclick = () => {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let visible = $state(false);
</script>

{#if visible}
  <div>Hidden content</div>
{/if}
<button onclick={() => visible = !visible}>Toggle</button>
```

---

## Form Patterns

### Input Binding

**HTML + Vanilla JS:**
```html
<input type="text" id="name">
<p>Hello, <span id="greeting">stranger</span>!</p>
<script>
  document.getElementById('name').oninput = (e) => {
    document.getElementById('greeting').textContent = e.target.value || 'stranger';
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let name = $state('');
</script>

<input type="text" bind:value={name}>
<p>Hello, {name || 'stranger'}!</p>
```

---

### Form Submission

**HTML + Vanilla JS:**
```html
<form id="loginForm">
  <input type="email" id="email" required>
  <input type="password" id="password" required>
  <button type="submit">Login</button>
</form>
<script>
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log({ email, password });
  };
</script>
```

**Svelte 5:**
```svelte
<script lang="ts">
  let email = $state('');
  let password = $state('');

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    console.log({ email, password });
  }
</script>

<form onsubmit={handleSubmit}>
  <input type="email" bind:value={email} required>
  <input type="password" bind:value={password} required>
  <button type="submit">Login</button>
</form>
```

---

## List Rendering Patterns

### Dynamic List

**HTML + Vanilla JS:**
```html
<ul id="list"></ul>
<button id="add">Add Item</button>
<script>
  let items = ['Item 1', 'Item 2'];
  const ul = document.getElementById('list');

  function render() {
    ul.innerHTML = '';
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
  }

  document.getElementById('add').onclick = () => {
    items.push(`Item ${items.length + 1}`);
    render();
  };

  render();
</script>
```

**Svelte 5:**
```svelte
<script>
  let items = $state(['Item 1', 'Item 2']);

  function addItem() {
    items.push(`Item ${items.length + 1}`);
  }
</script>

<ul>
  {#each items as item, i}
    <li>{item}</li>
  {/each}
</ul>
<button onclick={addItem}>Add Item</button>
```

---

### Filtered List

**HTML + Vanilla JS:**
```html
<input type="text" id="search" placeholder="Search...">
<ul id="results"></ul>
<script>
  const allItems = ['Apple', 'Banana', 'Cherry', 'Date'];

  function filter() {
    const query = document.getElementById('search').value.toLowerCase();
    const filtered = allItems.filter(item =>
      item.toLowerCase().includes(query)
    );

    const ul = document.getElementById('results');
    ul.innerHTML = '';
    filtered.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
  }

  document.getElementById('search').oninput = filter;
  filter();
</script>
```

**Svelte 5:**
```svelte
<script>
  const allItems = ['Apple', 'Banana', 'Cherry', 'Date'];
  let search = $state('');

  let filtered = $derived(
    allItems.filter(item =>
      item.toLowerCase().includes(search.toLowerCase())
    )
  );
</script>

<input type="text" bind:value={search} placeholder="Search...">
<ul>
  {#each filtered as item}
    <li>{item}</li>
  {/each}
</ul>
```

---

## Class and Style Patterns

### Dynamic Classes

**HTML + Vanilla JS:**
```html
<button id="btn" class="btn">Click me</button>
<script>
  let active = false;
  const btn = document.getElementById('btn');

  btn.onclick = () => {
    active = !active;
    btn.className = active ? 'btn active' : 'btn';
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let active = $state(false);
</script>

<button
  class={{ btn: true, active }}
  onclick={() => active = !active}
>
  Click me
</button>
```

---

### Dynamic Styles

**HTML + Vanilla JS:**
```html
<div id="box"></div>
<input type="color" id="colorPicker">
<script>
  const box = document.getElementById('box');
  document.getElementById('colorPicker').oninput = (e) => {
    box.style.backgroundColor = e.target.value;
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let color = $state('#ff3e00');
</script>

<div style:background-color={color}></div>
<input type="color" bind:value={color}>
```

---

## Timer and Interval Patterns

### Timer

**HTML + Vanilla JS:**
```html
<div id="timer">0</div>
<script>
  let seconds = 0;
  const timer = document.getElementById('timer');

  setInterval(() => {
    seconds++;
    timer.textContent = seconds;
  }, 1000);
</script>
```

**Svelte 5:**
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

---

## Event Handling Patterns

### Multiple Event Types

**HTML + Vanilla JS:**
```html
<div id="box">Hover or click me</div>
<script>
  const box = document.getElementById('box');

  box.onmouseenter = () => console.log('entered');
  box.onmouseleave = () => console.log('left');
  box.onclick = () => console.log('clicked');
</script>
```

**Svelte 5:**
```svelte
<script>
  function handleEnter() { console.log('entered'); }
  function handleLeave() { console.log('left'); }
  function handleClick() { console.log('clicked'); }
</script>

<div
  onmouseenter={handleEnter}
  onmouseleave={handleLeave}
  onclick={handleClick}
>
  Hover or click me
</div>
```

---

### Event Delegation

**HTML + Vanilla JS:**
```html
<ul id="list">
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
<script>
  document.getElementById('list').onclick = (e) => {
    if (e.target.tagName === 'LI') {
      console.log('Clicked:', e.target.textContent);
    }
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  const items = ['Item 1', 'Item 2', 'Item 3'];

  function handleClick(item: string) {
    console.log('Clicked:', item);
  }
</script>

<ul>
  {#each items as item}
    <li onclick={() => handleClick(item)}>{item}</li>
  {/each}
</ul>
```

---

## Computed Values Patterns

### Derived State

**HTML + Vanilla JS:**
```html
<input type="number" id="price" value="100">
<div>Price: $<span id="priceDisplay">100</span></div>
<div>Tax (10%): $<span id="taxDisplay">10</span></div>
<div>Total: $<span id="totalDisplay">110</span></div>
<script>
  function update() {
    const price = parseFloat(document.getElementById('price').value);
    const tax = price * 0.1;
    const total = price + tax;

    document.getElementById('priceDisplay').textContent = price;
    document.getElementById('taxDisplay').textContent = tax.toFixed(2);
    document.getElementById('totalDisplay').textContent = total.toFixed(2);
  }

  document.getElementById('price').oninput = update;
</script>
```

**Svelte 5:**
```svelte
<script>
  let price = $state(100);
  let tax = $derived(price * 0.1);
  let total = $derived(price + tax);
</script>

<input type="number" bind:value={price}>
<div>Price: ${price}</div>
<div>Tax (10%): ${tax.toFixed(2)}</div>
<div>Total: ${total.toFixed(2)}</div>
```

---

## Modal/Dialog Patterns

### Simple Modal

**HTML + Vanilla JS:**
```html
<button id="openModal">Open Modal</button>
<div id="modal" style="display: none;">
  <div class="modal-content">
    <span id="closeModal">&times;</span>
    <p>Modal content here</p>
  </div>
</div>
<script>
  const modal = document.getElementById('modal');
  document.getElementById('openModal').onclick = () => {
    modal.style.display = 'block';
  };
  document.getElementById('closeModal').onclick = () => {
    modal.style.display = 'none';
  };
</script>
```

**Svelte 5:**
```svelte
<script>
  let showModal = $state(false);
</script>

<button onclick={() => showModal = true}>Open Modal</button>

{#if showModal}
  <div class="modal">
    <div class="modal-content">
      <span onclick={() => showModal = false}>&times;</span>
      <p>Modal content here</p>
    </div>
  </div>
{/if}
```

---

## Tabs Pattern

**HTML + Vanilla JS:**
```html
<div class="tabs">
  <button class="tab active" data-tab="tab1">Tab 1</button>
  <button class="tab" data-tab="tab2">Tab 2</button>
</div>
<div id="tab1" class="content">Content 1</div>
<div id="tab2" class="content" style="display: none;">Content 2</div>
<script>
  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.dataset.tab;

      document.querySelectorAll('.tab').forEach(b =>
        b.classList.remove('active')
      );
      btn.classList.add('active');

      document.querySelectorAll('.content').forEach(c =>
        c.style.display = 'none'
      );
      document.getElementById(tabId).style.display = 'block';
    };
  });
</script>
```

**Svelte 5:**
```svelte
<script>
  let activeTab = $state('tab1');
</script>

<div class="tabs">
  <button
    class={{ tab: true, active: activeTab === 'tab1' }}
    onclick={() => activeTab = 'tab1'}
  >
    Tab 1
  </button>
  <button
    class={{ tab: true, active: activeTab === 'tab2' }}
    onclick={() => activeTab = 'tab2'}
  >
    Tab 2
  </button>
</div>

{#if activeTab === 'tab1'}
  <div class="content">Content 1</div>
{:else if activeTab === 'tab2'}
  <div class="content">Content 2</div>
{/if}
```
