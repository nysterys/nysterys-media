import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PlatformLogo } from '../shared/PlatformLogo';
import { useAuth } from '../../hooks/useAuth';

export default function UsersView() {
  const { user: currentUser, fetchProfile } = useAuth();
  const [users, setUsers]             = useState([]);
  const [platformAccounts, setPlatformAccounts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    const [uRes, aRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('platform_accounts').select('profile_id, platform').eq('is_active', true),
    ]);
    setUsers(uRes.data || []);
    setPlatformAccounts(aRes.data || []);
    setLoading(false);
  }

  function platformsForUser(userId) {
    return [...new Set(
      platformAccounts.filter(a => a.profile_id === userId).map(a => a.platform)
    )];
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">USERS</div>
          <div className="page-subtitle">Manage creator and admin accounts</div>
        </div>
      </div>

      <div className="table-wrap">
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: 70 }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: 110 }} />
            <col />
          </colgroup>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Creator Name</th><th>Platforms</th><th>Idle Timeout</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => {
              const platforms = u.role === 'creator' ? platformsForUser(u.id) : [];
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-confirmed'}`}>{u.role}</span></td>
                  <td>{u.creator_name || <span className="text-muted">—</span>}</td>
                  <td>
                    {platforms.length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {platforms.map(p => <PlatformLogo key={p} name={p} size={20} />)}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: u.idle_timeout_minutes ? 'var(--text)' : 'var(--text-muted)' }}>
                    {u.idle_timeout_minutes ? `${u.idle_timeout_minutes} min` : 'Disabled'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(u)}>Edit</button>
                  </td>
                </tr>
              );
            })}
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

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            if (editingUser.id === currentUser?.id) fetchProfile(currentUser.id);
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [enabled, setEnabled] = useState(user.idle_timeout_minutes != null);
  const [minutes, setMinutes] = useState(user.idle_timeout_minutes || 30);
  const [saving, setSaving]   = useState(false);

  async function save() {
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ idle_timeout_minutes: enabled ? Math.max(1, minutes) : null })
      .eq('id', user.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div className="modal-title">IDLE TIMEOUT — {(user.full_name || '').toUpperCase()}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Enable idle timeout</span>
            </label>
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
              Disable for your own account during development.
            </div>
          </div>
          {enabled && (
            <div className="form-group">
              <label className="form-label">Timeout (minutes)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={480}
                  value={minutes}
                  onChange={e => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 90 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  60s warning before sign-out
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
