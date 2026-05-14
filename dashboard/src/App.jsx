import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import OAuthClients from './pages/OAuthClients';

// Placeholder components for other routes
const Broadcast = () => (
  <div className="glass-card">
    <h3>Broadcast Email</h3>
    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Send mass emails to all users.</p>
    <div style={{ marginTop: '2rem' }}>
      <div className="input-group">
        <label className="input-label">Subject</label>
        <input type="text" className="input-field" placeholder="System Maintenance" />
      </div>
      <div className="input-group">
        <label className="input-label">Message</label>
        <textarea className="input-field" style={{ minHeight: '150px' }} placeholder="Message content..."></textarea>
      </div>
      <button className="btn btn-primary">Send Broadcast</button>
    </div>
  </div>
);

const Logs = () => (
  <div className="glass-card">
    <h3>Audit Logs</h3>
    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Tracking all administrative actions.</p>
    <div style={{ marginTop: '2rem', textAlign: 'center', padding: '4rem', color: 'var(--text-dim)', border: '1px dashed var(--glass-border)', borderRadius: '1rem' }}>
      Log viewer integration coming soon.
    </div>
  </div>
);

const Security = () => (
  <div className="glass-card">
    <h3>Security Settings</h3>
    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Manage global authentication security policies.</p>
  </div>
);

const Unauthorized = () => (
  <div style={{ textAlign: 'center', padding: '4rem' }}>
    <h1 style={{ color: 'var(--danger)' }}>403 - Unauthorized</h1>
    <p>You do not have permission to access this area.</p>
    <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => window.location.href = '/'}>Go Home</button>
  </div>
);

const LiquidBackground = () => (
  <div className="liquid-bg">
    <div className="blob blob-1"></div>
    <div className="blob blob-2"></div>
    <div className="blob blob-3"></div>
  </div>
);

function App() {
  return (
    <>
      <LiquidBackground />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        <Route element={
          <AuthGuard requireAdmin={true}>
            <Layout />
          </AuthGuard>
        }>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="oauth-clients" element={<OAuthClients />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="logs" element={<Logs />} />
          <Route path="security" element={<Security />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
