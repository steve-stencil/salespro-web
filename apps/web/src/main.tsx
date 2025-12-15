/**
 * Application entry point.
 * Renders the root App component with StrictMode.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Import Poppins font (Leap brand font)
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
