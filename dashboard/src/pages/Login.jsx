import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await authService.login(email, password);
      if (data.success) {
        navigate(from, { replace: true });
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Connection error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: '100%', 
      height: '100vh',
      position: 'relative'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '1rem', 
            borderRadius: '1rem', 
            background: 'var(--primary-glow)', 
            marginBottom: '1rem',
            color: 'var(--primary)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1>Starviel Auth</h1>
          <p style={{ color: 'var(--text-muted)' }}>Admin Management Portal</p>
        </div>

        {error && (
          <div style={{ 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: 'var(--danger)', 
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="email" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="admin@starviel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In to Dashboard'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          &copy; 2026 Starviel Auth. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
