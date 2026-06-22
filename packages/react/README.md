# @point-grab/react

React adapter for point-grab.

## Install

```bash
npm install @point-grab/core @point-grab/react
```

## Usage

```tsx
import { usePointGrab } from '@point-grab/react';

export function App() {
  usePointGrab();
  return <main>...</main>;
}
```

## What it adds

- resolves component names from the React fiber tree
- reads source locations from `_debugSource` when available
- strips React-specific attributes from captured HTML

Docs: https://point-grab.com
