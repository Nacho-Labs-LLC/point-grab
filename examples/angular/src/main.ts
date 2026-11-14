import { bootstrapApplication } from '@angular/platform-browser';
import { initPointGrabAngular } from '@point-grab/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const pointGrab = initPointGrabAngular({ activationMode: 'hold', devOnly: false });
pointGrab.showToolbar(); // Show the toolbar on arrival so Actions → Add screenshot is discoverable.

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
