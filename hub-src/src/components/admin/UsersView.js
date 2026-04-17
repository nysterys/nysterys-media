import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setUsers(data || []);
    setLoading(false);
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">USERS</div>
          <div className="page-subtitle">Manage creator and admin accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Invite User</button>
      </div>

      {error && <div className="login-error mb-16">{error}</div>}
      {success && <div style={{ background: 'rgba(74,223,138,0.1)', border: '1px solid rgba(74,223,138,0.3)', color: 'var(--green)', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{success}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Creator Name</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                <td className="text-muted">{u.email}</td>
                <td><span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-confirmed'}`}>{u.role}</span></td>
                <td>{u.creator_name || <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-20" style={{ maxWidth: 560 }}>
        <div className="card-title">HOW TO ADD USERS</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          To add Kym or Mys as users, go to your Supabase dashboard, navigate to Authentication → Users → Invite User.
          Enter their email and after they sign up, update their profile in the <code style={{ background: 'var(--surface3)', padding: '1px 6px', borderRadius: 3 }}>profiles</code> table:
          set <code style={{ background: 'var(--surface3)', padding: '1px 6px', borderRadius: 3 }}>role = 'creator'</code> and
          set <code style={{ background: 'var(--surface3)', padding: '1px 6px', borderRadius: 3 }}>creator_name</code> to their name.
          They will then only see their own campaigns when they log in.
        </p>
      </div>
    </div>
  );
}
