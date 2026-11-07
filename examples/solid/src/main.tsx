import { render } from 'solid-js/web';
import { initPointGrabSolid } from '@point-grab/solid';
import App from './App';

const pointGrab = initPointGrabSolid({ activationMode: 'hold', devOnly: false });
// Make element/comment and portable screenshot actions discoverable on arrival.
pointGrab.showToolbar();

render(() => <App />, document.getElementById('root')!);
