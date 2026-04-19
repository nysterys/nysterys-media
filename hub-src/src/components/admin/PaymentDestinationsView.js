import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const ACCOUNT_TYPES = ['Checking', 'Savings', 'UTMA', 'Investment', 'Other'];

// ── Institution logos (inline SVG, no external deps) ──────────────────────────
function InstitutionLogo({ institution, size = 40 }) {
  if (!institution) return <GenericLogo size={size} />;
  const name = institution.toLowerCase();

  if (name.includes('chase'))    return <ChaseLogo size={size} />;
  if (name.includes('vanguard')) return <VanguardLogo size={size} />;
  if (name.includes('fidelity')) return <FidelityLogo size={size} />;
  if (name.includes('schwab'))   return <SchwabLogo size={size} />;
  if (name.includes('bofa') || name.includes('bank of america')) return <BofALogo size={size} />;
  return <GenericLogo size={size} label={institution.slice(0, 2).toUpperCase()} />;
}

// Chase: dark navy square with octagon mark
function ChaseLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#117ACA" rx="8"/>
      <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="none" stroke="white" strokeWidth="2.5"/>
      <path d="M20 14 L26 20 L20 26 L14 20 Z" fill="white"/>
    </svg>
  );
}

// Vanguard: dark red with V chevron
function VanguardLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#8B0000" rx="8"/>
      <path d="M8 12 L20 28 L32 12" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 12 L20 22 L27 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    </svg>
  );
}

// Fidelity: green with F lettermark
function FidelityLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#167C45" rx="8"/>
      <text x="20" y="27" textAnchor="middle" fill="white"
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -1 }}>
        F
      </text>
    </svg>
  );
}

// Schwab: blue S
function SchwabLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#00A2E2" rx="8"/>
      <text x="20" y="27" textAnchor="middle" fill="white"
        style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
        S
      </text>
    </svg>
  );
}

// Bank of America: red/white flag stripes
function BofALogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#E31837" rx="8"/>
      <rect x="0" y="24" width="40" height="16" fill="#012169" rx="0"/>
      <rect x="0" y="35" width="40" height="5" fill="#E31837"/>
      <text x="20" y="20" textAnchor="middle" fill="white"
        style={{ fontSize: 9, fontWeight: 700, fontFamily: 'Arial, sans-serif', letterSpacing: 0.5 }}>
        BofA
      </text>
    </svg>
  );
}

// Generic: initials on a surface3 square
function GenericLogo({ size, label = '?' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#1e1e1e" rx="8"/>
      <text x="20" y="26" textAnchor="middle" fill="#888"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </text>
    </svg>
  );
}

// ── Account type chip colors ───────────────────────────────────────────────────
const TYPE_COLOR = {
  Checking:   'var(--blue)',
  Savings:    'var(--green)',
  UTMA:       '#a78bfa',
  Investment: 'var(--orange)',
  Other:      'var(--muted)',
};

// ── Destination card ──────────────────────────────────────────────────────────
function DestinationCard({ dest, onEdit, onToggle, canDelete, onDelete }) {
  return (
    <div className="card" style={{
      opacity: dest.is_active ? 1 : 0.45,
      position: 'relative',
      padding: '16px 18px',
    }}>
      {/* Header: logo + name + inactive badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <InstitutionLogo institution={dest.institution} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dest.name}
            </div>
            {!dest.is_active && (
              <span className="badge badge-cancelled" style={{ fontSize: 10, flexShrink: 0 }}>Inactive</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: TYPE_COLOR[dest.account_type] || 'var(--muted)',
              textTransform: 'uppercase',
            }}>
              {dest.account_type}
            </span>
            {dest.institution && (
              <>
                <span style={{ color: '#333', fontSize: 10 }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dest.institution}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Account number / memo — min-height keeps footer aligned across all cards */}
      <div style={{ minHeight: 36 }}>
        {dest.account_last4 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: 4, letterSpacing: 1 }}>
            ···· {dest.account_last4}
          </div>
        )}
        {dest.memo && (
          <div style={{ fontSize: 11, color: '#555', marginBottom: 4, lineHeight: 1.5 }}>{dest.memo}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={onToggle}>
          {dest.is_active ? 'Deactivate' : 'Activate'}
        </button>
        {canDelete && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function PaymentDestinationsView() {
  const [creators, setCreators]         = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [filterCreator, setFilterCreator] = useState('all');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [c, d] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'creator').order('creator_name'),
      supabase.from('payment_destinations')
        .select('*, profile:profiles(creator_name, full_name), payout_splits(id)')
        .order('profile_id')
        .order('sort_order'),
    ]);
    setCreators(c.data || []);
    const dests = (d.data || []).map(dest => ({
      ...dest,
      hasPayouts: (dest.payout_splits || []).length > 0,
    }));
    setDestinations(dests);
    setLoading(false);
  }

  async function toggleActive(d) {
    await supabase.from('payment_destinations').update({ is_active: !d.is_active }).eq('id', d.id);
    fetchAll();
  }

  async function deleteDestination(d) {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    await supabase.from('payment_destinations').delete().eq('id', d.id);
    fetchAll();
  }

  const filtered = filterCreator === 'all'
    ? destinations
    : destinations.filter(d => d.profile_id === filterCreator);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PAYMENT DESTINATIONS</div>
          <div className="page-subtitle">Configure payout accounts per creator</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
          + Add Destination
        </button>
      </div>

      <div className="filters-row">
        <button className={`filter-chip ${filterCreator === 'all' ? 'active' : ''}`} onClick={() => setFilterCreator('all')}>All</button>
        {creators.map(c => (
          <button key={c.id} className={`filter-chip ${filterCreator === c.id ? 'active' : ''}`} onClick={() => setFilterCreator(c.id)}>
            {c.creator_name || c.full_name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No destinations configured</div>
          <div className="empty-state-text">Add payout accounts for Kym and Mys</div>
        </div>
      ) : (
        <>
          {(filterCreator === 'all' ? creators : creators.filter(c => c.id === filterCreator)).map(creator => {
            const creatorDests = filtered.filter(d => d.profile_id === creator.id);
            if (creatorDests.length === 0) return null;
            return (
              <div key={creator.id} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 12 }}>
                  {creator.creator_name || creator.full_name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {creatorDests.map(dest => (
                    <DestinationCard
                      key={dest.id}
                      dest={dest}
                      onEdit={() => { setEditing(dest); setShowModal(true); }}
                      onToggle={() => toggleActive(dest)}
                      canDelete={!dest.hasPayouts}
                      onDelete={() => deleteDestination(dest)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {showModal && (
        <DestinationModal
          destination={editing}
          creators={creators}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function DestinationModal({ destination, creators, onClose, onSaved }) {
  const [form, setForm] = useState({
    profile_id:    destination?.profile_id    || '',
    name:          destination?.name          || '',
    account_type:  destination?.account_type  || 'Savings',
    account_last4: destination?.account_last4 || '',
    institution:   destination?.institution   || '',
    memo:          destination?.memo          || '',
    sort_order:    destination?.sort_order    ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    if (!form.profile_id || !form.name.trim()) { setError('Creator and destination name are required.'); return; }
    if (form.account_last4 && !/^\d{4}$/.test(form.account_last4)) { setError('Last 4 must be exactly 4 digits.'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      name:          form.name.trim(),
      account_last4: form.account_last4 || null,
      institution:   form.institution.trim() || null,
      memo:          form.memo.trim() || null,
    };
    if (destination) {
      await supabase.from('payment_destinations').update(payload).eq('id', destination.id);
    } else {
      const { error: err } = await supabase.from('payment_destinations').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  // Live logo preview based on institution field
  const logoPreview = form.institution.trim();

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">{destination ? 'EDIT DESTINATION' : 'ADD DESTINATION'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Logo preview */}
          {logoPreview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
              <InstitutionLogo institution={logoPreview} size={36} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Logo preview</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Creator *</label>
            <select className="form-select" value={form.profile_id}
              onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
              disabled={!!destination}>
              <option value="">Select creator...</option>
              {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destination Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Savings, UTMA, Checking..." />
            </div>
            <div className="form-group">
              <label className="form-label">Account Type *</label>
              <select className="form-select" value={form.account_type}
                onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Institution</label>
              <input className="form-input" value={form.institution}
                onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                placeholder="Chase, Fidelity, Vanguard..." />
            </div>
            <div className="form-group">
              <label className="form-label">Last 4 Digits</label>
              <input className="form-input" value={form.account_last4}
                onChange={e => setForm(f => ({ ...f, account_last4: e.target.value.slice(0, 4) }))}
                placeholder="6789" maxLength={4}
                style={{ fontFamily: 'monospace' }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Memo / Notes</label>
            <input className="form-input" value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="Any routing notes or identifiers..." />
          </div>
          <div className="form-group">
            <label className="form-label">Display Order</label>
            <input className="form-input" type="number" min={0} value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              style={{ width: 80 }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : destination ? 'Save' : 'Add Destination'}
          </button>
        </div>
      </div>
    </div>
  );
}
