import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LandingPage from './LandingPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage appUrl={import.meta.env.VITE_APP_URL || 'http://localhost:5169/login'} githubUrl={import.meta.env.VITE_GITHUB_URL} />
  </StrictMode>,
);
