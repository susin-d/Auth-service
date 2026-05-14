import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { Shield, ArrowRight } from 'lucide-react';

const Login = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await authService.register(email, password);
        setError('');
        setIsRegister(false);
        alert('Account created! Check your email for verification, then sign in.');
      } else {
        const data = await authService.login(email, password);
        localStorage.setItem('console_token', data.access_token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '1rem', background: 'rgba(124,58,237,0.15)', marginBottom: '1rem' }}>
            <Shield size={28} color="var(--primary-light)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>S-Auth Developer Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {isRegister ? 'Create your developer account' : 'Sign in to manage your apps'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontWeight: '600', marginLeft: '0.25rem', fontFamily: 'inherit' }}>
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
