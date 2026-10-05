import { render } from 'solid-js/web';
import { initPointGrabSolid } from '@point-grab/solid';
import App from './App';

initPointGrabSolid({ activationMode: 'hold', devOnly: false });

render(() => <App />, document.getElementById('root')!);
