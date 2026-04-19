import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ── Platform logos ─────────────────────────────────────────────────────────────
function PlatformLogo({ name, size = 24 }) {
  const n = (name || '').toLowerCase();
  if (n.includes('tiktok'))                            return <TikTokLogo size={size} />;
  if (n.includes('instagram'))                         return <InstagramLogo size={size} />;
  if (n.includes('youtube'))                           return <YouTubeLogo size={size} />;
  if (n === 'x' || n.includes('twitter'))              return <XLogo size={size} />;
  if (n.includes('snapchat'))                          return <SnapchatLogo size={size} />;
  if (n.includes('pinterest'))                         return <PinterestLogo size={size} />;
  if (n.includes('facebook'))                          return <FacebookLogo size={size} />;
  if (n.includes('linkedin'))                          return <LinkedInLogo size={size} />;
  if (n.includes('twitch'))                            return <TwitchLogo size={size} />;
  if (n.includes('podcast') || n.includes('spotify'))  return <SpotifyLogo size={size} />;
  return <GenericPlatformLogo size={size} label={(name || '?').slice(0, 2).toUpperCase()} />;
}

function TikTokLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#010101" rx="6"/>
      <rect x="15" y="11" width="9" height="20" rx="2" fill="white"/>
      <rect x="21" y="11" width="3" height="20" rx="1" fill="#69C9D0"/>
      <circle cx="17" cy="29" r="4" fill="#EE1D52"/>
      <circle cx="23" cy="26" r="4" fill="#69C9D0"/>
      <circle cx="20" cy="27.5" r="3" fill="white"/>
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#69C9D0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#EE1D52" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
    </svg>
  );
}

function InstagramLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <defs>
        <linearGradient id="ig-grad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#FCAF45"/>
          <stop offset="50%" stopColor="#F77737"/>
          <stop offset="75%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="42" height="42" fill="url(#ig-grad2)" rx="6"/>
      <rect x="10" y="12" width="22" height="18" rx="4" fill="none" stroke="white" strokeWidth="2"/>
      <circle cx="21" cy="21" r="5" fill="none" stroke="white" strokeWidth="2"/>
      <circle cx="30" cy="14" r="1.5" fill="white"/>
    </svg>
  );
}

function YouTubeLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FF0000" rx="6"/>
      <rect x="7" y="13" width="28" height="16" rx="4" fill="white" opacity="0.15"/>
      <polygon points="17,15 17,27 30,21" fill="white"/>
    </svg>
  );
}

function XLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#000000" rx="6"/>
      <path d="M10 10 L32 32 M32 10 L10 32" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

function SnapchatLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FFFC00" rx="6"/>
      <path d="M21 8 C14 8 12 14 12 18 L12 26 L9 28 C10 29 12 29 14 28 C14 29 17 31 21 31 C25 31 28 29 28 28 C30 29 32 29 33 28 L30 26 L30 18 C30 14 28 8 21 8 Z" fill="#1a1a1a"/>
    </svg>
  );
}

function PinterestLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#E60023" rx="6"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 24, fontWeight: 800, fill: 'white', fontFamily: 'Georgia, serif' }}>P</text>
    </svg>
  );
}

function FacebookLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1877F2" rx="6"/>
      <path d="M23 12 L20 12 C18 12 17 13 17 15 L17 18 L14 18 L14 22 L17 22 L17 32 L21 32 L21 22 L24 22 L25 18 L21 18 L21 16 C21 15 21.5 14.5 22.5 14.5 L25 14.5 Z" fill="white"/>
    </svg>
  );
}

function LinkedInLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0A66C2" rx="6"/>
      <text x="21" y="28" textAnchor="middle"
        style={{ fontSize: 16, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif', letterSpacing: -0.5 }}>in</text>
    </svg>
  );
}

function TwitchLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#9146FF" rx="6"/>
      <path d="M11 9 L11 27 L17 27 L17 31 L21 27 L27 27 L27 9 Z" fill="white" opacity="0.2"/>
      <rect x="17" y="14" width="3" height="7" rx="1" fill="white"/>
      <rect x="23" y="14" width="3" height="7" rx="1" fill="white"/>
    </svg>
  );
}

function SpotifyLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1DB954" rx="6"/>
      <path d="M11 18 Q21 14 31 18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 23 Q21 20 30 23" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 28 Q21 26 28 28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function GenericPlatformLogo({ size, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1e1e1e" rx="6"/>
      <text x="21" y="27" textAnchor="middle" fill="#555"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}

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
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: 110 }} />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Account</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ fontSize: 12, color: 'var(--text-muted)' }}>No accounts linked</td>
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
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: 110 }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Account</th>
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
      <div style={{ marginTop: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>
          Deliverable Types
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
                <col style={{ width: '28%' }} />
                <col />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
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
                          {count === 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingType(t); setShowTypeModal(true); }}>Edit</button>
                          )}
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
