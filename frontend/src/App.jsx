/**
 * App Root Component
 * Sets up providers, toast notifications, and routing
 */

import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PortalLanding from './pages/PortalLanding';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PortalEditor from './pages/PortalEditor';
import { isAuthenticated } from './services/adminApi';

// Protected Route Wrapper for Admin Pages
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

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

      {/* Main Routing */}
      <Routes>
        {/* Root Portal Routes */}
        <Route path="/" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        <Route path="/register" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        <Route path="/upload" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        <Route path="/selfie" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        <Route path="/details" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        <Route path="/success" element={<PortalLanding slugOverride="root" basePathOverride="" />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/portals/new" 
          element={
            <ProtectedRoute>
              <PortalEditor />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/portals/:id/edit" 
          element={
            <ProtectedRoute>
              <PortalEditor />
            </ProtectedRoute>
          } 
        />

        {/* Dynamic Portal Routes - must be last to not catch /admin etc */}
        <Route path="/:slug/*" element={<PortalLanding />} />
      </Routes>

      <Analytics />
    </>
  );
}

export default App;
