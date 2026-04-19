import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ── Platform logos (inline SVG) ───────────────────────────────────────────────
function PlatformLogo({ name, size = 42 }) {
  const n = (name || '').toLowerCase();
  if (n.includes('tiktok'))                          return <TikTokLogo size={size} />;
  if (n.includes('instagram'))                       return <InstagramLogo size={size} />;
  if (n.includes('youtube'))                         return <YouTubeLogo size={size} />;
  if (n.includes('twitter') || n === 'x')           return <XLogo size={size} />;
  if (n.includes('snapchat'))                        return <SnapchatLogo size={size} />;
  if (n.includes('pinterest'))                       return <PinterestLogo size={size} />;
  if (n.includes('facebook'))                        return <FacebookLogo size={size} />;
  if (n.includes('linkedin'))                        return <LinkedInLogo size={size} />;
  if (n.includes('twitch'))                          return <TwitchLogo size={size} />;
  if (n.includes('podcast') || n.includes('spotify')) return <SpotifyLogo size={size} />;
  return <GenericPlatformLogo size={size} label={(name || '?').slice(0, 2).toUpperCase()} />;
}

// TikTok: black with the TikTok note mark (two overlapping circles + bar)
function TikTokLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#010101" rx="8"/>
      {/* White note body */}
      <rect x="15" y="11" width="9" height="20" rx="2" fill="white"/>
      {/* Cyan accent on right */}
      <rect x="21" y="11" width="3" height="20" rx="1" fill="#69C9D0"/>
      {/* Red accent note head left */}
      <circle cx="17" cy="29" r="4" fill="#EE1D52"/>
      {/* Cyan note head right */}
      <circle cx="23" cy="26" r="4" fill="#69C9D0"/>
      {/* White over centre to clean up overlap */}
      <circle cx="20" cy="27.5" r="3" fill="white"/>
      {/* Curl of note */}
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#69C9D0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#EE1D52" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
    </svg>
  );
}

// Instagram: gradient square with camera outline
function InstagramLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#FCAF45"/>
          <stop offset="50%" stopColor="#F77737"/>
          <stop offset="75%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="42" height="42" fill="url(#ig-grad)" rx="8"/>
      {/* Camera body */}
      <rect x="10" y="12" width="22" height="18" rx="4" fill="none" stroke="white" strokeWidth="2"/>
      {/* Lens */}
      <circle cx="21" cy="21" r="5" fill="none" stroke="white" strokeWidth="2"/>
      {/* Flash dot */}
      <circle cx="30" cy="14" r="1.5" fill="white"/>
    </svg>
  );
}

// YouTube: red with white play triangle
function YouTubeLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FF0000" rx="8"/>
      {/* White rounded rect bg */}
      <rect x="7" y="13" width="28" height="16" rx="4" fill="white" opacity="0.15"/>
      {/* Play triangle */}
      <polygon points="17,15 17,27 30,21" fill="white"/>
    </svg>
  );
}

// X (Twitter): black with X mark
function XLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#000000" rx="8"/>
      <path d="M10 10 L32 32 M32 10 L10 32" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

// Snapchat: yellow with ghost
function SnapchatLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FFFC00" rx="8"/>
      {/* Ghost silhouette */}
      <path d="M21 8 C14 8 12 14 12 18 L12 26 L9 28 C10 29 12 29 14 28 C14 29 17 31 21 31 C25 31 28 29 28 28 C30 29 32 29 33 28 L30 26 L30 18 C30 14 28 8 21 8 Z" fill="#1a1a1a"/>
    </svg>
  );
}

// Pinterest: red P
function PinterestLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#E60023" rx="8"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 24, fontWeight: 800, fill: 'white', fontFamily: 'Georgia, serif' }}>P</text>
    </svg>
  );
}

// Facebook: blue F
function FacebookLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1877F2" rx="8"/>
      {/* f lettermark */}
      <path d="M23 12 L20 12 C18 12 17 13 17 15 L17 18 L14 18 L14 22 L17 22 L17 32 L21 32 L21 22 L24 22 L25 18 L21 18 L21 16 C21 15 21.5 14.5 22.5 14.5 L25 14.5 Z" fill="white"/>
    </svg>
  );
}

// LinkedIn: blue in
function LinkedInLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0A66C2" rx="8"/>
      <text x="21" y="28" textAnchor="middle"
        style={{ fontSize: 16, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif', letterSpacing: -0.5 }}>in</text>
    </svg>
  );
}

// Twitch: purple with controller/T
function TwitchLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#9146FF" rx="8"/>
      {/* Twitch speech bubble shape */}
      <path d="M11 9 L11 27 L17 27 L17 31 L21 27 L27 27 L27 9 Z" fill="white" opacity="0.2"/>
      <rect x="17" y="14" width="3" height="7" rx="1" fill="white"/>
      <rect x="23" y="14" width="3" height="7" rx="1" fill="white"/>
    </svg>
  );
}

// Spotify: green circle with bars
function SpotifyLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1DB954" rx="8"/>
      <path d="M11 18 Q21 14 31 18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 23 Q21 20 30 23" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 28 Q21 26 28 28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

// Generic fallback
function GenericPlatformLogo({ size, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1e1e1e" rx="8"/>
      <text x="21" y="27" textAnchor="middle" fill="#555"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}

// ── Platform card ─────────────────────────────────────────────────────────────
function PlatformCard({ platform, usageCount, onToggle, onDelete }) {
  return (
    <div className="card" style={{ opacity: platform.is_active ? 1 : 0.45, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <PlatformLogo name={platform.name} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {platform.name}
            </div>
            {!platform.is_active && (
              <span className="badge badge-cancelled" style={{ fontSize: 10, flexShrink: 0 }}>Inactive</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: usageCount > 0 ? 'var(--muted)' : '#333' }}>
            {usageCount > 0
              ? `${usageCount} deliverable${usageCount !== 1 ? 's' : ''}`
              : 'No deliverables yet'}
          </div>
        </div>
      </div>

      <div style={{ minHeight: 8, flex: 1 }} />

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onToggle}>
          {platform.is_active ? 'Deactivate' : 'Activate'}
        </button>
        {usageCount === 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--red)', marginLeft: 'auto' }}
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add platform modal ────────────────────────────────────────────────────────
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

// ── Main view ─────────────────────────────────────────────────────────────────
export default function PlatformsView() {
  const [platforms, setPlatforms]     = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [pRes, dRes] = await Promise.all([
      supabase.from('platforms').select('*').order('name'),
      supabase.from('campaign_deliverables').select('platform_id').not('platform_id', 'is', null),
    ]);
    setPlatforms(pRes.data || []);
    // Count deliverables per platform
    const counts = {};
    for (const d of (dRes.data || [])) {
      counts[d.platform_id] = (counts[d.platform_id] || 0) + 1;
    }
    setUsageCounts(counts);
    setLoading(false);
  }

  async function toggle(p) {
    await supabase.from('platforms').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  }

  async function deletePlatform(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await supabase.from('platforms').delete().eq('id', p.id);
    load();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  const active   = platforms.filter(p => p.is_active);
  const inactive = platforms.filter(p => !p.is_active);

  function Grid({ items }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {items.map(p => (
          <PlatformCard
            key={p.id}
            platform={p}
            usageCount={usageCounts[p.id] || 0}
            onToggle={() => toggle(p)}
            onDelete={() => deletePlatform(p)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PLATFORMS</div>
          <div className="page-subtitle">Define which platforms campaigns can run on</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Platform</button>
      </div>

      {platforms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No platforms yet</div>
          <div className="empty-state-text">Add platforms like TikTok, Instagram, YouTube...</div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              {inactive.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 12 }}>Active</div>
              )}
              <Grid items={active} />
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 12 }}>Inactive</div>
              <Grid items={inactive} />
            </div>
          )}
        </>
      )}

      {showModal && (
        <AddPlatformModal
          currentPlatforms={platforms}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
