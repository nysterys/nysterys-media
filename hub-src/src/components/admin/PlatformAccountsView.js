import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const PLATFORMS = [
  { value: 'tiktok',    label: 'TikTok',    url: u => `https://www.tiktok.com/@${u}` },
  { value: 'youtube',   label: 'YouTube',   url: u => `https://www.youtube.com/@${u}` },
  { value: 'instagram', label: 'Instagram', url: u => `https://www.instagram.com/${u}` },
  { value: 'x',         label: 'X',         url: u => `https://x.com/${u}` },
];

export default function PlatformAccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [a, c] = await Promise.all([
      supabase.from('platform_accounts').select('*, profile:profiles(full_name, creator_name)').order('platform').order('created_at'),
      supabase.from('profiles').select('*').eq('role', 'creator'),
    ]);
    setAccounts(a.data || []);
    setCreators(c.data || []);
    setLoading(false);
  }

  async function toggleActive(acc) {
    await supabase.from('platform_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id);
    fetchAll();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PLATFORM ACCOUNTS</div>
          <div className="page-subtitle">Link creator profiles to their social media accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Link Account</button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◎</div>
          <div className="empty-state-title">No accounts linked yet</div>
          <div className="empty-state-text">Link Kym and Mys's social media accounts</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Creator</th><th>Platform</th><th>Username</th><th>Display Name</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const platform = PLATFORMS.find(p => p.value === a.platform);
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.profile?.creator_name || a.profile?.full_name}</td>
                    <td><span className="badge badge-not-invoiced">{platform?.label || a.platform}</span></td>
                    <td>
                      {platform ? (
                        <a
                          href={platform.url(a.username)}
                          target="_blank"
                          rel="noreferrer"
                          className="link"
                          onClick={e => e.stopPropagation()}
                        >
                          @{a.username}
                        </a>
                      ) : (
                        <span>@{a.username}</span>
                      )}
                    </td>
                    <td>{a.display_name || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(a); setShowModal(true); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(a)}>
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <PlatformAccountModal
          account={editing}
          creators={creators}
          existingAccounts={accounts}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function PlatformAccountModal({ account, creators, existingAccounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    profile_id: account?.profile_id || '',
    platform: account?.platform || 'tiktok',
    username: account?.username || '',
    display_name: account?.display_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const linkedPlatforms = existingAccounts
    .filter(a => a.profile_id === form.profile_id && a.id !== account?.id)
    .map(a => a.platform);

  const availablePlatforms = PLATFORMS.filter(p => !linkedPlatforms.includes(p.value));

  async function save() {
    if (!form.profile_id || !form.platform || !form.username.trim()) {
      setError('Creator, platform, and username are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      profile_id: form.profile_id,
      platform: form.platform,
      username: form.username.trim().replace(/^@/, ''),
      display_name: form.display_name.trim() || null,
    };
    let err;
    if (account) {
      ({ error: err } = await supabase.from('platform_accounts').update(payload).eq('id', account.id));
    } else {
      ({ error: err } = await supabase.from('platform_accounts').insert(payload));
    }
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{account ? 'EDIT ACCOUNT' : 'LINK PLATFORM ACCOUNT'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error mb-16">{error}</div>}
          <div className="form-group">
            <label className="form-label">Creator *</label>
            <select
              className="form-select"
              value={form.profile_id}
              onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
              disabled={!!account}
            >
              <option value="">Select creator...</option>
              {creators.map(c => (
                <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Platform *</label>
            <select
              className="form-select"
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              disabled={!!account}
            >
              {availablePlatforms.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Username * (without @)</label>
            <input
              className="form-input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/^@/, '') }))}
              placeholder="mysthegreat"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name (optional)</label>
            <input
              className="form-input"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Mys The Great"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : account ? 'Save' : 'Link Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
