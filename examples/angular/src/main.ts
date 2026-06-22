import { bootstrapApplication } from '@angular/platform-browser';
import { initPointGrabAngular } from '@point-grab/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';

initPointGrabAngular({ activationMode: 'hold', devOnly: false });

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
