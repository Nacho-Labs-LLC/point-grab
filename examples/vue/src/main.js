import { createApp } from 'vue';
import { PointGrabPlugin, getPointGrabApi } from '@point-grab/vue';
import App from './App.vue';

const app = createApp(App);
app.use(PointGrabPlugin, { activationMode: 'hold', devOnly: false });
// Show the toolbar on arrival so Actions → Add screenshot is discoverable.
getPointGrabApi()?.showToolbar();
app.mount('#app');
