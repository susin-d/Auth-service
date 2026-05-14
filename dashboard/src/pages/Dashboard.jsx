import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, UserCheck, ShieldAlert, Activity, TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <div className="glass-card" style={{ flex: 1 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div style={{ 
        padding: '0.75rem', 
        borderRadius: '0.75rem', 
        background: `hsla(${color}, 0.1)`, 
        color: `hsl(${color})` 
      }}>
        <Icon size={24} />
      </div>
      {trend && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.25rem', 
          fontSize: '0.75rem', 
          color: trend > 0 ? 'var(--success)' : 'var(--danger)',
          background: trend > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          padding: '0.25rem 0.5rem',
          borderRadius: '9999px'
        }}>
          {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '400' }}>{title}</h3>
    <p style={{ fontSize: '1.75rem', fontWeight: '700', marginTop: '0.25rem' }}>{value}</p>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    admins: 0,
    verified: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getAllUsers();
        if (data.success) {
          const users = data.users;
          setStats({
            total: users.length,
            active: users.filter(u => u.account_status === 'active').length,
            admins: users.filter(u => u.role === 'admin').length,
            verified: users.filter(u => u.email_verified).length
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard title="Total Users" value={stats.total} icon={Users} trend={12} color="262, 83%, 58%" />
        <StatCard title="Active Accounts" value={stats.active} icon={Activity} trend={8} color="160, 84%, 39%" />
        <StatCard title="Admin Users" value={stats.admins} icon={ShieldAlert} color="0, 84%, 60%" />
        <StatCard title="Verified Emails" value={stats.verified} icon={UserCheck} trend={5} color="210, 100%, 50%" />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <div className="glass-card" style={{ flex: 2 }}>
          <h3 style={{ marginBottom: '1.5rem' }}>User Growth</h3>
          <div style={{ height: '240px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            [ Chart Placeholder - In a real app we'd use Recharts/Chart.js ]
          </div>
        </div>

        <div className="glass-card" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Security Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'var(--bg-hover)' }}>
                <div style={{ color: 'var(--warning)' }}><ShieldAlert size={20} /></div>
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: '500' }}>Failed login attempt</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP: 192.168.1.{i * 10} • 2m ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
