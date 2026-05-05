import type { App, Plugin as VuePlugin } from 'vue';
import type { PointGrabOptions } from '@point-grab/core';
import { initPointGrabVue, disposePointGrab } from './init';

/**
 * Vue plugin that initializes point-grab when installed.
 *
 * @example
 * ```ts
 * import { createApp } from 'vue';
 * import { PointGrabPlugin } from '@point-grab/vue';
 *
 * const app = createApp(App);
 * app.use(PointGrabPlugin, { activationMode: 'toggle' });
 * ```
 */
export const PointGrabPlugin: VuePlugin<Partial<PointGrabOptions> | undefined> = {
  install(app: App, options?: Partial<PointGrabOptions>) {
    const api = initPointGrabVue(options);

    // Make the API available via inject('$point-grab')
    app.provide('$point-grab', api);

    // Clean up when the app unmounts
    app.config.globalProperties.$pointGrabApi = api;

    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      disposePointGrab();
      originalUnmount();
    };
  },
};
