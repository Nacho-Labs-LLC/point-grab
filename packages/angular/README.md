# @point-grab/angular

Angular adapter for point-grab.

## Install

```bash
npm install @point-grab/core @point-grab/angular
```

## Usage

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { initPointGrabAngular } from '@point-grab/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';

initPointGrabAngular({ activationMode: 'hold', devOnly: false });
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

## What it adds

- resolves component ancestry via `window.ng` debug APIs
- captures Angular-oriented source and template context in dev builds
- strips Angular-specific classes and attributes from captured HTML

Docs: https://point-grab.com
