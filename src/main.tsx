import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StandaloneFieldPage from './components/StandaloneFieldPage.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';

const isStandaloneField =
  window.location.pathname.startsWith('/saha') ||
  window.location.pathname.startsWith('/s/') ||
  window.location.pathname === '/s' ||
  new URLSearchParams(window.location.search).has('saha') ||
  new URLSearchParams(window.location.search).has('r') ||
  new URLSearchParams(window.location.search).get('mode') === 'saha';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStandaloneField ? <StandaloneFieldPage /> : <App />}
  </StrictMode>,
);
