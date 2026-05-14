import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  LogOut, 
  Settings, 
  Activity,
  Mail,
  Key
} from 'lucide-react';
import { authService } from '../services/api';

const Sidebar = () => {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/' },
    { icon: Users, label: 'Users', path: '/users' },
    { icon: Key, label: 'OAuth Clients', path: '/oauth-clients' },
    { icon: Mail, label: 'Broadcast', path: '/broadcast' },
    { icon: Activity, label: 'Audit Logs', path: '/logs' },
    { icon: Shield, label: 'Security', path: '/security' },
  ];

  return (
    <div className="sidebar" style={{
      width: '260px',
      height: '100vh',
      background: 'rgba(255, 255, 255, 0.02)',
      backdropFilter: 'var(--glass-blur)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', padding: '0.5rem' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          background: 'var(--primary)', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Shield size={20} color="white" />
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Starviel Auth</span>
      </div>

      <nav style={{ flex: 1 }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1rem',
              borderRadius: '0.75rem',
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              textDecoration: 'none',
              marginBottom: '0.5rem',
              transition: 'all 0.2s ease',
              border: isActive ? '1px solid var(--glass-border)' : '1px solid transparent'
            })}
          >
            <item.icon size={20} />
            <span style={{ fontSize: '0.9375rem', fontWeight: isActive ? '500' : '400' }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
        <button 
          onClick={() => authService.logout()}
          className="btn-secondary"
          style={{ 
            width: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            padding: '0.875rem 1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <LogOut size={20} />
          <span style={{ fontSize: '0.9375rem' }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
