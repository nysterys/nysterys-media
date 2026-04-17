import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function TikTokAccountsView() {
  const [accounts, setAccounts] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [a, c] = await Promise.all([
      supabase.from('tiktok_accounts').select('*, profile:profiles(full_name, creator_name)').order('created_at'),
      supabase.from('profiles').select('*').eq('role', 'creator'),
    ]);
    setAccounts(a.data || []);
    setCreators(c.data || []);
    setLoading(false);
  }

  async function toggleActive(acc) {
    await supabase.from('tiktok_accounts').update({ is_active: !acc.is_active }).eq('id', acc.id);
    fetchAll();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TIKTOK ACCOUNTS</div>
          <div className="page-subtitle">Link creator profiles to their TikTok accounts for analytics</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Link Account</button>
      </div>

      <div className="card mb-16" style={{ maxWidth: 680, borderColor: 'rgba(200,245,100,0.2)' }}>
        <div className="card-title">HOW ANALYTICS DATA FLOWS IN</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          You configure Coupler.io to sync TikTok Organic data directly into your Supabase database.
          Set up one importer per report type (6 total). In Coupler.io's transform step, add a static
          column called <code style={{ background: 'var(--surface3)', padding: '1px 6px', borderRadius: 3 }}>tiktok_username</code> with
          the creator's TikTok handle (no @). This is how their data gets matched here.
          The Coupler.io setup guide is in the <strong style={{ color: 'var(--text)' }}>SETUP.md</strong> file.
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◈</div>
          <div className="empty-state-title">No TikTok accounts linked yet</div>
          <div className="empty-state-text">Link Kym and Mys's accounts to enable analytics</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Creator</th><th>TikTok Username</th><th>Display Name</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.profile?.creator_name || a.profile?.full_name}</td>
                  <td>
                    <a
                      href={`https://www.tiktok.com/@${a.tiktok_username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                      onClick={e => e.stopPropagation()}
                    >
                      @{a.tiktok_username}
                    </a>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coupler.io config reference */}
      <div className="card mt-20" style={{ maxWidth: 680 }}>
        <div className="card-title">COUPLER.IO IMPORTER CONFIGURATION</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
          Set up 6 importers in Coupler.io — one per report type. Use these exact table names as destinations:
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {[
            ['Profile insights', 'tiktok_profile_insights'],
            ['Profile audience genders', 'tiktok_audience_gender'],
            ['Profile audience countries', 'tiktok_audience_country'],
            ['Profile audience hourly activity', 'tiktok_audience_hourly'],
            ['Video list insights', 'tiktok_video_insights'],
            ['Video list top countries', 'tiktok_video_countries'],
          ].map(([report, table]) => (
            <div key={table} style={{ display: 'flex', gap: 24, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 240 }}>{report}</span>
              <span style={{ color: 'var(--accent)' }}>→ {table}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12 }}>
          Supabase connection: host = <code>db.cmcwsfqwzrtevxtbxxgw.supabase.co</code> · port = <code>5432</code> · database = <code>postgres</code><br />
          Use a Supabase service role key (Settings → API → service_role) as the PostgreSQL password.
        </p>
      </div>

      {showModal && (
        <TikTokAccountModal
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

function TikTokAccountModal({ account, creators, existingAccounts, onClose, onSaved }) {
  const [form, setForm] = useState({
    profile_id: account?.profile_id || '',
    tiktok_username: account?.tiktok_username || '',
    display_name: account?.display_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filter out creators who already have an account linked (unless editing that one)
  const availableCreators = creators.filter(c =>
    !existingAccounts.find(a => a.profile_id === c.id && a.id !== account?.id)
  );

  async function save() {
    if (!form.profile_id || !form.tiktok_username.trim()) {
      setError('Creator and TikTok username are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      profile_id: form.profile_id,
      tiktok_username: form.tiktok_username.trim().replace(/^@/, ''), // strip @ if entered
      display_name: form.display_name.trim() || null,
    };
    if (account) {
      await supabase.from('tiktok_accounts').update(payload).eq('id', account.id);
    } else {
      const { error: err } = await supabase.from('tiktok_accounts').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">{account ? 'EDIT ACCOUNT' : 'LINK TIKTOK ACCOUNT'}</div>
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
              {availableCreators.map(c => (
                <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">TikTok Username * (without @)</label>
            <input
              className="form-input"
              value={form.tiktok_username}
              onChange={e => setForm(f => ({ ...f, tiktok_username: e.target.value.replace(/^@/, '') }))}
              placeholder="mysthegreat"
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              This must exactly match the username you configure in Coupler.io
            </div>
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
