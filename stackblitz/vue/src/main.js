import { createApp } from 'vue';
import { PointGrabPlugin } from '@point-grab/vue';
import App from './App.vue';

const app = createApp(App);
app.use(PointGrabPlugin, { activationMode: 'hold' });
app.mount('#app');
