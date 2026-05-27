import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerAdd from './pages/CustomerAdd.jsx';
import Alarms from './pages/Alarms.jsx';
import SiaMessages from './pages/SiaMessages.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* Customers */}
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/add" element={<ProtectedRoute><CustomerAdd /></ProtectedRoute>} />

      {/* Alarms — single page; /alarms/unmanaged redirects to ?filter=unmanaged */}
      <Route path="/alarms" element={<ProtectedRoute><Alarms /></ProtectedRoute>} />
      <Route path="/alarms/unmanaged" element={<Navigate to="/alarms?filter=unmanaged" replace />} />
      <Route path="/alarms/customer/:customerId" element={<ProtectedRoute><Alarms mode="customer" /></ProtectedRoute>} />

      {/* SIA Messages */}
      <Route path="/sia-messages" element={<ProtectedRoute><SiaMessages /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
