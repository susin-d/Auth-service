import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Edit2, 
  Trash2, 
  UserPlus,
  RefreshCw,
  Mail,
  Shield
} from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    role: '',
    account_status: '',
    email_verified: false
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllUsers();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditFormData({
      role: user.role,
      account_status: user.account_status,
      email_verified: user.email_verified
    });
    setIsEditModalOpen(true);
  };

  const handleViewClick = (user) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await adminService.updateUser(selectedUser.id, editFormData);
      if (data.success) {
        setIsEditModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      alert('Failed to update user: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        const data = await adminService.deleteUser(userId);
        if (data.success) {
          fetchUsers();
        }
      } catch (error) {
        alert('Failed to delete user: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return <span className="badge badge-success">Active</span>;
      case 'inactive': return <span className="badge badge-warning">Inactive</span>;
      case 'suspended': return <span className="badge badge-danger">Suspended</span>;
      default: return <span className="badge badge-info">{status}</span>;
    }
  };

  return (
    <div className="glass-card" style={{ padding: '0' }}>
      {/* Modals */}
      {(isEditModalOpen || isViewModalOpen) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', margin: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>{isEditModalOpen ? 'Edit User' : 'User Details'}</h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setIsViewModalOpen(false); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {selectedUser && (
              <div>
                {isViewModalOpen ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ 
                        width: '64px', 
                        height: '64px', 
                        borderRadius: '1rem', 
                        background: 'var(--primary-glow)', 
                        color: 'var(--primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        marginBottom: '0.5rem'
                      }}>
                        {selectedUser.email[0].toUpperCase()}
                      </div>
                      <h4>{selectedUser.full_name || 'No Name'}</h4>
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>{selectedUser.email}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.75rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>User ID</p>
                        <p style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{selectedUser.id}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Role</p>
                        <p>{selectedUser.role}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Status</p>
                        <div>{getStatusBadge(selectedUser.account_status)}</div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Verified</p>
                        <p>{selectedUser.email_verified ? '✅ Yes' : '❌ No'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateUser}>
                    <div className="input-group">
                      <label className="input-label">Role</label>
                      <select 
                        className="input-field" 
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Account Status</label>
                      <select 
                        className="input-field" 
                        value={editFormData.account_status}
                        onChange={(e) => setEditFormData({ ...editFormData, account_status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>

                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        id="email_verified"
                        checked={editFormData.email_verified}
                        onChange={(e) => setEditFormData({ ...editFormData, email_verified: e.target.checked })}
                      />
                      <label htmlFor="email_verified" className="input-label" style={{ marginBottom: 0 }}>Email Verified</label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ flex: 1 }}
                        onClick={() => setIsEditModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ flex: 1 }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem' }}>User Directory</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Manage all registered users and their permissions.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={fetchUsers}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary">
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by name or email..." 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ position: 'relative', width: '180px' }}>
          <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <select 
            className="input-field" 
            style={{ paddingLeft: '2.5rem', appearance: 'none' }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      <div className="data-table-container" style={{ border: 'none', borderRadius: '0' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Created At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                    <div className="animate-pulse" style={{ height: '20px', background: 'var(--bg-hover)', borderRadius: '4px' }}></div>
                  </td>
                </tr>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '10px', 
                        background: user.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: user.role === 'admin' ? 'var(--danger)' : 'var(--info)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600',
                        fontSize: '0.875rem'
                      }}>
                        {user.role === 'admin' ? <Shield size={18} /> : user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: '500' }}>{user.full_name || 'No Name'}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '0.8125rem', 
                      color: user.role === 'admin' ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: user.role === 'admin' ? '600' : '400'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td>{getStatusBadge(user.account_status)}</td>
                  <td>
                    <span style={{ color: user.email_verified ? 'var(--success)' : 'var(--text-dim)' }}>
                      {user.email_verified ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '0.4rem', borderRadius: '0.5rem' }} 
                        title="View"
                        onClick={() => handleViewClick(user)}
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '0.4rem', borderRadius: '0.5rem' }} 
                        title="Edit"
                        onClick={() => handleEditClick(user)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn-danger" 
                        style={{ padding: '0.4rem', borderRadius: '0.5rem' }} 
                        title="Delete"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                  No users found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
