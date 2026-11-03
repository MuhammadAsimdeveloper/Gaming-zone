import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { applyTheme, themeForPath } from './lib/theme';
import './index.css';

applyTheme(themeForPath(window.location.pathname));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
