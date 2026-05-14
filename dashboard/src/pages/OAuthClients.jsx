import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff,
  RefreshCw,
  ExternalLink,
  Shield
} from 'lucide-react';

const OAuthClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    client_description: '',
    logo_url: '',
    redirect_uris: '',
    is_confidential: true
  });

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await adminService.listOAuthClients();
      if (data.success) setClients(data.clients);
    } catch (error) {
      console.error('Failed to fetch clients', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const uris = formData.redirect_uris.split('\n').map(u => u.trim()).filter(Boolean);
      const data = await adminService.registerOAuthClient({
        client_name: formData.client_name,
        client_description: formData.client_description,
        logo_url: formData.logo_url || undefined,
        redirect_uris: uris,
        is_confidential: formData.is_confidential
      });
      if (data.success) {
        setNewClientSecret(data.client);
        setFormData({ client_name: '', client_description: '', logo_url: '', redirect_uris: '', is_confidential: true });
        fetchClients();
      }
    } catch (error) {
      alert('Failed to create client: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Delete this OAuth client? All apps using it will stop working.')) {
      try {
        await adminService.deleteOAuthClient(clientId);
        fetchClients();
      } catch (error) {
        alert('Failed: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      {/* Secret Display Modal */}
      {newClientSecret && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '520px', margin: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', marginBottom: '1rem' }}>
                <Shield size={32} />
              </div>
              <h3>Client Created Successfully</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Save the <strong>Client Secret</strong> below. It will <strong>not</strong> be shown again.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.75rem', border: '1px solid var(--glass-border)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Client ID</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{newClientSecret.client_id}</code>
                  <button onClick={() => copyToClipboard(newClientSecret.client_id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Copy size={16} /></button>
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '0.25rem' }}>Client Secret (copy now!)</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all', color: '#f87171' }}>{newClientSecret.client_secret}</code>
                  <button onClick={() => copyToClipboard(newClientSecret.client_secret)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Copy size={16} /></button>
                </div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setNewClientSecret(null)}>
              I've saved the secret
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', margin: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>Register OAuth Client</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">Application Name *</label>
                <input className="input-field" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} placeholder="My Cool App" required />
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                <input className="input-field" value={formData.client_description} onChange={e => setFormData({...formData, client_description: e.target.value})} placeholder="A short description of your app" />
              </div>
              <div className="input-group">
                <label className="input-label">Logo URL</label>
                <input className="input-field" value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} placeholder="https://example.com/logo.png" />
              </div>
              <div className="input-group">
                <label className="input-label">Redirect URIs * (one per line)</label>
                <textarea className="input-field" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.redirect_uris} onChange={e => setFormData({...formData, redirect_uris: e.target.value})} placeholder={"http://localhost:8080/callback\nhttps://myapp.com/auth/callback"} required />
              </div>
              <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="is_confidential" checked={formData.is_confidential} onChange={e => setFormData({...formData, is_confidential: e.target.checked})} />
                <label htmlFor="is_confidential" className="input-label" style={{ marginBottom: 0 }}>Confidential client (server-side app with client_secret)</label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="glass-card" style={{ padding: 0 }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>OAuth Clients</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Manage applications that can use "Sign in with S-Auth".</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={fetchClients}><RefreshCw size={18} /></button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={18} /><span>New Client</span></button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading clients...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Key size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>No OAuth clients registered yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Click "New Client" to register an application.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {clients.map(client => (
              <div key={client.client_id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.client_name} style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={20} />
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: '500' }}>{client.client_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{client.client_id}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`badge ${client.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {new Date(client.created_at).toLocaleDateString()}
                  </span>
                  <button className="btn-danger" style={{ padding: '0.4rem', borderRadius: '0.5rem' }} onClick={() => handleDelete(client.client_id)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthClients;
