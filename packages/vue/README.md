# @point-grab/vue

Vue adapter for point-grab.

## Install

```bash
npm install @point-grab/core @point-grab/vue
```

## Usage

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { PointGrabPlugin } from '@point-grab/vue';

const app = createApp(App);
app.use(PointGrabPlugin);
app.mount('#app');
```

## What it adds

- resolves Vue component ancestry via instance metadata
- reads SFC source paths from `type.__file` when available
- strips scoped style hashes from captured HTML

Docs: https://point-grab.com
