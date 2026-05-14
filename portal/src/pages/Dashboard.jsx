import { useState, useEffect } from 'react';
import { developerService } from '../services/api';
import { Plus, Trash2, Copy, Shield, Key, ExternalLink, RefreshCw, Code, CheckCircle, Box } from 'lucide-react';

const Dashboard = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newSecret, setNewSecret] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({
    client_name: '',
    client_description: '',
    logo_url: '',
    redirect_uris: '',
    is_confidential: true
  });

  const fetchApps = async () => {
    setLoading(true);
    try {
      const data = await developerService.listApps();
      if (data.success) setApps(data.apps);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchApps(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const uris = form.redirect_uris.split('\n').map(u => u.trim()).filter(Boolean);
      if (uris.length === 0) return alert('Add at least one redirect URI');
      const data = await developerService.createApp({
        client_name: form.client_name,
        client_description: form.client_description,
        logo_url: form.logo_url || undefined,
        redirect_uris: uris,
        is_confidential: form.is_confidential
      });
      if (data.success) {
        setNewSecret(data.client);
        setForm({ client_name: '', client_description: '', logo_url: '', redirect_uris: '', is_confidential: true });
        setShowCreate(false);
        fetchApps();
      }
    } catch (e) { alert(e.response?.data?.error || 'Failed to create app'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (clientId, name) => {
    if (!confirm(`Delete "${name}"? Apps using this client will stop working.`)) return;
    try { await developerService.deleteApp(clientId); fetchApps(); }
    catch (e) { alert(e.response?.data?.error || 'Failed'); }
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const backendUrl = 'http://localhost:3000';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Secret reveal modal */}
      {newSecret && (
        <div className="modal-overlay">
          <div className="glass-card modal-card fade-in">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '1rem', background: 'rgba(16,185,129,0.1)', marginBottom: '1rem' }}>
                <CheckCircle size={28} color="var(--success)" />
              </div>
              <h3>App Created!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.375rem' }}>
                Copy your <strong>Client Secret</strong> now — it will <strong>never</strong> be shown again.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="code-block">
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>CLIENT ID</span>
                {newSecret.client_id}
                <button className="copy-btn" onClick={() => copy(newSecret.client_id, 'id')}>{copied === 'id' ? <CheckCircle size={14} /> : <Copy size={14} />}</button>
              </div>
              <div className="code-block" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--danger)', marginBottom: '0.25rem' }}>CLIENT SECRET (save this!)</span>
                <span style={{ color: '#f87171' }}>{newSecret.client_secret}</span>
                <button className="copy-btn" style={{ color: 'var(--danger)' }} onClick={() => copy(newSecret.client_secret, 'secret')}>{copied === 'secret' ? <CheckCircle size={14} /> : <Copy size={14} />}</button>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setNewSecret(null)}>
              I've saved the secret
            </button>
          </div>
        </div>
      )}

      {/* Create App modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="glass-card modal-card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Create New App</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">App Name *</label>
                <input className="input-field" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="My Awesome App" required />
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                <input className="input-field" value={form.client_description} onChange={e => setForm({...form, client_description: e.target.value})} placeholder="What does your app do?" />
              </div>
              <div className="input-group">
                <label className="input-label">Logo URL</label>
                <input className="input-field" value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})} placeholder="https://example.com/logo.png" />
              </div>
              <div className="input-group">
                <label className="input-label">Redirect URIs * (one per line)</label>
                <textarea className="input-field" value={form.redirect_uris} onChange={e => setForm({...form, redirect_uris: e.target.value})} placeholder={"http://localhost:3000/callback\nhttps://myapp.com/auth/callback"} required />
              </div>
              <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="confidential" checked={form.is_confidential} onChange={e => setForm({...form, is_confidential: e.target.checked})} />
                <label htmlFor="confidential" className="input-label" style={{ marginBottom: 0 }}>Confidential client (has a backend to store secrets)</label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create App'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Detail modal */}
      {selectedApp && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedApp(null)}>
          <div className="glass-card modal-card fade-in" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>{selectedApp.client_name}</h3>
              <button onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="code-block">
                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>CLIENT ID</span>
                {selectedApp.client_id}
                <button className="copy-btn" onClick={() => copy(selectedApp.client_id, 'detail-id')}>{copied === 'detail-id' ? <CheckCircle size={14} /> : <Copy size={14} />}</button>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Redirect URIs</p>
                {selectedApp.redirect_uris.map((uri, i) => (
                  <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{uri}</p>
                ))}
              </div>

              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Quick Start — Authorization URL</p>
                <div className="code-block" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {backendUrl}/oauth/authorize?client_id={selectedApp.client_id}&redirect_uri={encodeURIComponent(selectedApp.redirect_uris[0])}&response_type=code&scope=profile+email
                  <button className="copy-btn" onClick={() => copy(`${backendUrl}/oauth/authorize?client_id=${selectedApp.client_id}&redirect_uri=${encodeURIComponent(selectedApp.redirect_uris[0])}&response_type=code&scope=profile+email`, 'url')}>{copied === 'url' ? <CheckCircle size={14} /> : <Copy size={14} />}</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span className={`badge ${selectedApp.is_active ? 'badge-success' : 'badge-danger'}`}>{selectedApp.is_active ? 'Active' : 'Inactive'}</span>
                <span className="badge badge-info">{selectedApp.is_confidential ? 'Confidential' : 'Public (PKCE)'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>Your Apps</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Create and manage applications that use "Sign in with S-Auth".</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchApps}><RefreshCw size={16} /></button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> New App</button>
        </div>
      </div>

      {/* App List */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>Loading...</div>
      ) : apps.length === 0 ? (
        <div className="glass-card empty-state">
          <Box size={48} />
          <p style={{ fontSize: '1.0625rem', fontWeight: '500', color: 'var(--text-muted)' }}>No apps yet</p>
          <p style={{ fontSize: '0.875rem' }}>Click "New App" to register your first OAuth2 application.</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Your First App
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {apps.map(app => (
            <div key={app.client_id} className="glass-card fade-in" style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedApp(app)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {app.logo_url ? (
                    <img src={app.logo_url} alt="" style={{ width: '42px', height: '42px', borderRadius: '12px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={20} />
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: '600', marginBottom: '0.125rem' }}>{app.client_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{app.client_id}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`badge ${app.is_active ? 'badge-success' : 'badge-danger'}`}>{app.is_active ? 'Active' : 'Inactive'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{new Date(app.created_at).toLocaleDateString()}</span>
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(app.client_id, app.client_name); }} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {app.client_description && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginLeft: '3.25rem' }}>{app.client_description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Docs Reference */}
      <div className="glass-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(59,130,246,0.1)', color: 'var(--info)' }}>
            <Code size={20} />
          </div>
          <div>
            <h4 style={{ marginBottom: '0.25rem' }}>Integration Guide</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Learn how to add "Sign in with S-Auth" to your app with our step-by-step guide.
            </p>
            <a href="/docs/OAUTH-PROVIDER.md" target="_blank" className="btn btn-secondary btn-sm">
              <ExternalLink size={14} /> View Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
