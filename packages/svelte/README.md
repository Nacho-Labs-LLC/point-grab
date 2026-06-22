# @point-grab/svelte

Svelte adapter for point-grab.

## Install

```bash
npm install @point-grab/core @point-grab/svelte
```

## Usage

```svelte
<script>
  import { pointGrab } from '@point-grab/svelte';
</script>

<div use:pointGrab>...</div>
```

## What it adds

- resolves Svelte component metadata when available
- reads source locations from compiler metadata in dev builds
- keeps captured HTML cleaner by removing Svelte-specific noise

Docs: https://point-grab.com
