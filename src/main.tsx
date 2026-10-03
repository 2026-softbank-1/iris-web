import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@xyflow/react/dist/base.css';
import './styles/base.css';
import './styles/workspace.css';
import './styles/dashboard.css';
import './styles/overlays.css';
import './styles/project.css';
import './styles/panes.css';
import './styles/logs.css';
import './styles/pages.css';
import { App } from './App';
import { initTheme } from './lib/theme';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
