import type { App, Plugin as VuePlugin } from 'vue';
import type { PointGrabOptions } from 'pointgrab';
import { initPointGrabVue, disposePointGrab } from './init';

/**
 * Vue plugin that initializes pointgrab when installed.
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

    // Make the API available via inject('$pointgrab')
    app.provide('$pointgrab', api);

    // Clean up when the app unmounts
    app.config.globalProperties.$pointgrabApi = api;

    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      disposePointGrab();
      originalUnmount();
    };
  },
};
