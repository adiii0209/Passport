/**
 * App Root Component
 * Sets up providers, toast notifications, and background effects
 */

import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import Home from './pages/Home';

function App() {
  return (
    <>

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          className: 'toast-custom',
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Main content */}
      <Home />

      {/* Vercel Web Analytics */}
      <Analytics />
    </>
  );
}

export default App;
