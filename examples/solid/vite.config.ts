import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import pointGrabSolid from '@point-grab/solid/vite';

export default defineConfig({
  plugins: [pointGrabSolid(), solid()],
});
