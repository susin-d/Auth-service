import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Shield, LogOut, User } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './index.css';

const LiquidBackground = () => (
  <div className="liquid-bg">
    <div className="blob blob-1"></div>
    <div className="blob blob-2"></div>
    <div className="blob blob-3"></div>
  </div>
);

const AuthGuard = ({ children }) => {
  const token = localStorage.getItem('console_token');
  if (!token) return <Navigate to="/login" replace />;
  try {
    const decoded = jwtDecode(token);
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('console_token');
      return <Navigate to="/login" replace />;
    }
    return children;
  } catch {
    localStorage.removeItem('console_token');
    return <Navigate to="/login" replace />;
  }
};

const Layout = () => {
  const token = localStorage.getItem('console_token');
  let userEmail = '';
  try { userEmail = jwtDecode(token).email; } catch { }

  const handleLogout = () => {
    localStorage.removeItem('console_token');
    window.location.href = '/login';
  };

  return (
    <div className="layout">
      <div className="top-nav">
        <a href="/" className="brand">
          <div className="brand-icon"><Shield size={18} color="#fff" /></div>
          <span>S-Auth</span>
          <span className="tag">Console</span>
        </a>
        <div className="nav-right">
          <div className="user-info">
            <User size={16} />
            <span>{userEmail}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <LiquidBackground />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
