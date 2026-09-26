import '@fontsource/rajdhani/latin-300.css';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
