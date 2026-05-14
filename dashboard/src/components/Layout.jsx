import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, User } from 'lucide-react';

const Layout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2.5rem',
          padding: '1rem 1.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'var(--glass-blur)',
          borderRadius: '1.25rem',
          border: '1px solid var(--glass-border)',
          position: 'sticky',
          top: '2rem',
          zIndex: 5
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem' }}>Welcome, Admin</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Here's what's happening today.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search anything..." 
                style={{ width: '240px', paddingLeft: '2.5rem', background: 'var(--bg-card)' }}
              />
            </div>
            
            <button className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '0.75rem' }}>
              <Bell size={20} />
            </button>
            
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: 'var(--primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <User size={20} color="white" />
            </div>
          </div>
        </header>

        <main className="animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
