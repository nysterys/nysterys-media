import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PlatformLogo, GenericPlatformLogo } from '../shared/PlatformLogo';

function accountUrl(platform, username) {
  const map = {
    tiktok:    `https://www.tiktok.com/@${username}`,
    youtube:   `https://www.youtube.com/@${username}`,
    instagram: `https://www.instagram.com/${username}`,
    x:         `https://x.com/${username}`,
  };
  return map[platform] || null;
}

// ── Main view ──────────────────────────────────────────────────────────────────
export default function PlatformSetupView() {
  const [platforms, setPlatforms]     = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [accounts, setAccounts]       = useState([]);
  const [creators, setCreators]       = useState([]);
  const [delivTypes, setDelivTypes]   = useState([]);
  const [delivUsage, setDelivUsage]   = useState({});
  const [loading, setLoading]         = useState(true);

  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [showAccountModal, setShowAccountModal]   = useState(false);
  const [editingAccount, setEditingAccount]       = useState(null);
  const [defaultPlatform, setDefaultPlatform]     = useState('');
  const [showTypeModal, setShowTypeModal]         = useState(false);
  const [editingType, setEditingType]             = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [pRes, dRes, aRes, cRes, tRes, tuRes] = await Promise.all([
      supabase.from('platforms').select('*').order('name'),
      supabase.from('campaign_deliverables').select('platform_id').not('platform_id', 'is', null),
      supabase.from('platform_accounts').select('*, profile:profiles(full_name, creator_name)').order('platform').order('created_at'),
      supabase.from('profiles').select('*').eq('role', 'creator').order('creator_name'),
      supabase.from('deliverable_types').select('*').order('name'),
      supabase.from('campaign_deliverables').select('deliverable_type_id').not('deliverable_type_id', 'is', null),
    ]);
    setPlatforms(pRes.data || []);
    const counts = {};
    for (const d of (dRes.data || [])) counts[d.platform_id] = (counts[d.platform_id] || 0) + 1;
    setUsageCounts(counts);
    setAccounts(aRes.data || []);
    setCreators(cRes.data || []);
    setDelivTypes(tRes.data || []);
    const typeCounts = {};
    for (const d of (tuRes.data || [])) typeCounts[d.deliverable_type_id] = (typeCounts[d.deliverable_type_id] || 0) + 1;
    setDelivUsage(typeCounts);
    setLoading(false);
  }

  async function togglePlatform(p) {
    await supabase.from('platforms').update({ is_active: !p.is_active }).eq('id', p.id);
    fetchAll();
  }

  async function deletePlatform(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await supabase.from('platforms').delete().eq('id', p.id);
    fetchAll();
  }

  async function toggleAccount(a) {
    await supabase.from('platform_accounts').update({ is_active: !a.is_active }).eq('id', a.id);
    fetchAll();
  }

  function openLinkAccount(platformName) {
    setDefaultPlatform(platformName.toLowerCase());
    setEditingAccount(null);
    setShowAccountModal(true);
  }

  function openEditAccount(a) {
    setDefaultPlatform(a.platform);
    setEditingAccount(a);
    setShowAccountModal(true);
  }

  async function toggleType(t) {
    await supabase.from('deliverable_types').update({ is_active: !t.is_active }).eq('id', t.id);
    fetchAll();
  }

  async function deleteType(t) {
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    await supabase.from('deliverable_types').delete().eq('id', t.id);
    fetchAll();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  // Group accounts by platform name (platform_accounts.platform is lowercase)
  const accountsByPlatform = {};
  const orphanAccounts = [];
  for (const a of accounts) {
    const match = platforms.find(p => p.name.toLowerCase() === a.platform);
    if (match) {
      if (!accountsByPlatform[match.id]) accountsByPlatform[match.id] = [];
      accountsByPlatform[match.id].push(a);
    } else {
      orphanAccounts.push(a);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PLATFORM SETUP</div>
          <div className="page-subtitle">Platforms, account links, and deliverable types</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={() => { setEditingType(null); setShowTypeModal(true); }}>+ Add Type</button>
          <button className="btn btn-ghost" onClick={() => setShowPlatformModal(true)}>+ Add Platform</button>
          <button className="btn btn-primary" onClick={() => { setDefaultPlatform(''); setEditingAccount(null); setShowAccountModal(true); }}>+ Link Account</button>
        </div>
      </div>

      {platforms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◻</div>
          <div className="empty-state-title">No platforms yet</div>
          <div className="empty-state-text">Add platforms like TikTok, Instagram, YouTube...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {platforms.map(p => {
            const pAccounts = accountsByPlatform[p.id] || [];
            const delivCount = usageCounts[p.id] || 0;
            return (
              <div key={p.id}>
                {/* Platform header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '2px solid var(--surface2)', opacity: p.is_active ? 1 : 0.6 }}>
                  <PlatformLogo name={p.name} size={22} />
                  <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>{p.name.toUpperCase()}</span>
                  <span className={`badge ${p.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {delivCount > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {delivCount} deliverable{delivCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePlatform(p)}>
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    {delivCount === 0 && pAccounts.length === 0 && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deletePlatform(p)}>
                        Delete
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => openLinkAccount(p.name)}>
                      + Link Account
                    </button>
                  </div>
                </div>

                {/* Accounts table */}
                <div className="table-wrap" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '35%' }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 90 }} />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Account</th>
                        <th></th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ fontSize: 12, color: 'var(--text-muted)' }}>No accounts linked</td>
                        </tr>
                      ) : (
                        pAccounts.map(a => {
                          const url = accountUrl(a.platform, a.username);
                          return (
                            <tr key={a.id} style={{ opacity: a.is_active ? 1 : 0.5 }}>
                              <td style={{ fontSize: 13 }}>{a.profile?.creator_name || a.profile?.full_name}</td>
                              <td>
                                {url ? (
                                  <a href={url} target="_blank" rel="noreferrer" className="link" onClick={e => e.stopPropagation()}>
                                    @{a.username}
                                  </a>
                                ) : (
                                  <span>@{a.username}</span>
                                )}
                                {a.display_name && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>{a.display_name}</span>
                                )}
                              </td>
                              <td />
                              <td>
                                <span className={`badge ${a.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                                  {a.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>
                                <div className="flex gap-8">
                                  <button className="btn btn-ghost btn-sm" onClick={() => openEditAccount(a)}>Edit</button>
                                  <button className="btn btn-ghost btn-sm" onClick={() => toggleAccount(a)}>
                                    {a.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Orphaned accounts */}
          {orphanAccounts.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '2px solid var(--surface2)' }}>
                <GenericPlatformLogo size={22} label="?" />
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>OTHER</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Platform not defined above</span>
              </div>
              <div className="table-wrap" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: '22%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Account</th>
                      <th></th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanAccounts.map(a => {
                      const url = accountUrl(a.platform, a.username);
                      return (
                        <tr key={a.id} style={{ opacity: a.is_active ? 1 : 0.5 }}>
                          <td style={{ fontSize: 13 }}>
                            {a.profile?.creator_name || a.profile?.full_name}
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>({a.platform})</span>
                          </td>
                          <td>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="link">@{a.username}</a>
                            ) : (
                              <span>@{a.username}</span>
                            )}
                          </td>
                          <td />
                          <td>
                            <span className={`badge ${a.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-8">
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditAccount(a)}>Edit</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => toggleAccount(a)}>
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
            </div>
          )}
        </div>
      )}

      {/* ── Deliverable Types ── */}
      <div style={{ marginTop: 56, paddingTop: 32, borderTop: '2px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 3, height: 18, background: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Deliverable Types</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Platform-independent content formats</span>
        </div>
        {delivTypes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No deliverable types yet</div>
            <div className="empty-state-text">Add types like Video, Reel, Story, Carousel...</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col />
              </colgroup>
              <thead>
                <tr><th>Type</th><th>Description</th><th>Usage</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {delivTypes.map(t => {
                  const count = delivUsage[t.id] || 0;
                  return (
                    <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 500 }}>{t.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.description || <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {count > 0 ? `${count} deliverable${count !== 1 ? 's' : ''}` : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <span className={`badge ${t.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingType(t); setShowTypeModal(true); }}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggleType(t)}>
                            {t.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {count === 0 && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteType(t)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPlatformModal && (
        <AddPlatformModal
          currentPlatforms={platforms}
          onClose={() => setShowPlatformModal(false)}
          onSaved={() => { setShowPlatformModal(false); fetchAll(); }}
        />
      )}

      {showAccountModal && (
        <PlatformAccountModal
          account={editingAccount}
          creators={creators}
          existingAccounts={accounts}
          defaultPlatform={defaultPlatform}
          onClose={() => setShowAccountModal(false)}
          onSaved={() => { setShowAccountModal(false); fetchAll(); }}
        />
      )}

      {showTypeModal && (
        <DeliverableTypeModal
          type={editingType}
          onClose={() => setShowTypeModal(false)}
          onSaved={() => { setShowTypeModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ── Add platform modal ─────────────────────────────────────────────────────────
function AddPlatformModal({ onClose, onSaved, currentPlatforms }) {
  const [name, setName]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    if (currentPlatforms.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A platform with this name already exists.'); return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('platforms').insert({ name: trimmed });
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div className="modal-title">ADD PLATFORM</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          {name.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
              <PlatformLogo name={name.trim()} size={36} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Logo preview</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Platform Name *</label>
            <input
              className="form-input"
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="TikTok, Instagram, YouTube..."
            />
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
              Logos auto-match for TikTok, Instagram, YouTube, X, Snapchat, Pinterest, Facebook, LinkedIn, Twitch, Spotify
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Adding...' : 'Add Platform'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link / edit account modal ──────────────────────────────────────────────────
const PLATFORM_OPTIONS = [
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x',         label: 'X' },
];

function PlatformAccountModal({ account, creators, existingAccounts, defaultPlatform, onClose, onSaved }) {
  const [form, setForm] = useState({
    profile_id:   account?.profile_id   || '',
    platform:     account?.platform     || defaultPlatform || 'tiktok',
    username:     account?.username     || '',
    display_name: account?.display_name || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const linkedPlatforms = existingAccounts
    .filter(a => a.profile_id === form.profile_id && a.id !== account?.id)
    .map(a => a.platform);

  const availableOptions = PLATFORM_OPTIONS.filter(p => !linkedPlatforms.includes(p.value));

  async function save() {
    if (!form.profile_id || !form.platform || !form.username.trim()) {
      setError('Creator, platform, and username are required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      profile_id:   form.profile_id,
      platform:     form.platform,
      username:     form.username.trim().replace(/^@/, ''),
      display_name: form.display_name.trim() || null,
    };
    let err;
    if (account) {
      ({ error: err } = await supabase.from('platform_accounts').update(payload).eq('id', account.id));
    } else {
      ({ error: err } = await supabase.from('platform_accounts').insert(payload));
    }
    if (err) {
      setError(err.code === '23505'
        ? `This creator already has a ${form.platform} account linked.`
        : err.message);
      setSaving(false);
      return;
    }
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
            <select className="form-select" value={form.profile_id}
              onChange={e => {
                const newProfileId = e.target.value;
                const taken = existingAccounts
                  .filter(a => a.profile_id === newProfileId && a.id !== account?.id)
                  .map(a => a.platform);
                const available = PLATFORM_OPTIONS.filter(p => !taken.includes(p.value));
                setForm(f => ({
                  ...f,
                  profile_id: newProfileId,
                  platform: taken.includes(f.platform)
                    ? (available[0]?.value || f.platform)
                    : f.platform,
                }));
              }}
              disabled={!!account}>
              <option value="">Select creator...</option>
              {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Platform *</label>
            <select className="form-select" value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              disabled={!!account}>
              {availableOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Username * (without @)</label>
            <input className="form-input" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/^@/, '') }))}
              placeholder="mysthegreat" />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name (optional)</label>
            <input className="form-input" value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Mys The Great" />
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

// ── Deliverable type modal ─────────────────────────────────────────────────────
function DeliverableTypeModal({ type, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        type?.name        || '',
    description: type?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    const name = form.name.trim();
    if (!name) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const payload = { name, description: form.description.trim() || null };
    if (type) {
      const { error: err } = await supabase.from('deliverable_types').update(payload).eq('id', type.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('deliverable_types').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title">{type ? 'EDIT DELIVERABLE TYPE' : 'ADD DELIVERABLE TYPE'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} autoFocus
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Video, Reel, Story, Carousel..." />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : type ? 'Save' : 'Add Type'}
          </button>
        </div>
      </div>
    </div>
  );
}
