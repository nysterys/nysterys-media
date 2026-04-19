import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// ── Method logos (inline SVG, no external deps) ───────────────────────────────
function MethodLogo({ name, size = 42 }) {
  const n = (name || '').toLowerCase();
  if (n.includes('paypal'))                              return <PayPalLogo size={size} />;
  if (n.includes('zelle'))                               return <ZelleLogo size={size} />;
  if (n.includes('wire'))                                return <WireLogo size={size} />;
  if (n.includes('ach'))                                 return <ACHLogo size={size} />;
  if (n.includes('check'))                               return <CheckLogo size={size} />;
  if (n.includes('direct deposit') || n.includes('direct')) return <DirectDepositLogo size={size} />;
  if (n.includes('venmo'))                               return <VenmoLogo size={size} />;
  if (n.includes('cash'))                                return <CashLogo size={size} />;
  return <GenericMethodLogo size={size} label={(name || '?').slice(0, 2).toUpperCase()} />;
}

// PayPal: deep navy with PP
function PayPalLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#003087" rx="8"/>
      <text x="21" y="27" textAnchor="middle"
        style={{ fontSize: 15, fontWeight: 800, fill: '#009CDE', fontFamily: 'Arial, sans-serif', letterSpacing: -1 }}>PP</text>
    </svg>
  );
}

// Zelle: purple Z
function ZelleLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#6D1ED4" rx="8"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif' }}>Z</text>
    </svg>
  );
}

// Wire: gold horizontal lines suggesting a wire transfer
function WireLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1a1a2e" rx="8"/>
      <line x1="8" y1="15" x2="34" y2="15" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="21" x2="34" y2="21" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="27" x2="34" y2="27" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="13" x2="14" y2="29" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="28" y1="13" x2="28" y2="29" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

// ACH: dark green with ACH text
function ACHLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0a5c36" rx="8"/>
      <text x="21" y="27" textAnchor="middle"
        style={{ fontSize: 13, fontWeight: 800, fill: '#4ade80', fontFamily: 'Arial, sans-serif', letterSpacing: 0.5 }}>ACH</text>
    </svg>
  );
}

// Check: stylised paper check
function CheckLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#2a1f00" rx="8"/>
      <rect x="7" y="13" width="28" height="16" rx="2" fill="none" stroke="#c9a227" strokeWidth="1.5"/>
      <line x1="11" y1="23" x2="20" y2="23" stroke="#c9a227" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M11 18 Q13 16 15 18 Q17 20 19 18" fill="none" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
      <rect x="23" y="16" width="9" height="6" rx="1" fill="none" stroke="#c9a227" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

// Direct Deposit: bar chart with down-arrow
function DirectDepositLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0c2340" rx="8"/>
      <rect x="10" y="24" width="4" height="8" rx="1" fill="#4a9eff" opacity="0.7"/>
      <rect x="16" y="20" width="4" height="12" rx="1" fill="#4a9eff" opacity="0.85"/>
      <rect x="22" y="22" width="4" height="10" rx="1" fill="#4a9eff" opacity="0.7"/>
      <rect x="28" y="18" width="4" height="14" rx="1" fill="#4a9eff"/>
      <path d="M21 8 L21 15 M18 12 L21 15 L24 12" fill="none" stroke="#4a9eff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Venmo: teal V
function VenmoLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#3D95CE" rx="8"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif' }}>V</text>
    </svg>
  );
}

// Cash: dollar sign on green
function CashLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#14532d" rx="8"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: '#4ade80', fontFamily: 'Georgia, serif' }}>$</text>
    </svg>
  );
}

// Generic fallback: initials on surface3
function GenericMethodLogo({ size, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 8, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1e1e1e" rx="8"/>
      <text x="21" y="27" textAnchor="middle" fill="#555"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}

// ── Method card ───────────────────────────────────────────────────────────────
function MethodCard({ method, onToggle, onDelete, invoiceCount }) {
  return (
    <div className="card" style={{ opacity: method.is_active ? 1 : 0.45, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <MethodLogo name={method.name} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {method.name}
            </div>
            {!method.is_active && (
              <span className="badge badge-cancelled" style={{ fontSize: 10, flexShrink: 0 }}>Inactive</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: invoiceCount > 0 ? 'var(--muted)' : '#333' }}>
            {invoiceCount > 0 ? `Used on ${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}` : 'No invoices yet'}
          </div>
        </div>
      </div>

      {/* Consistent height spacer */}
      <div style={{ minHeight: 8, flex: 1 }} />

      <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onToggle}>
          {method.is_active ? 'Deactivate' : 'Activate'}
        </button>
        {invoiceCount === 0 && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add method modal ──────────────────────────────────────────────────────────
function AddMethodModal({ onClose, onSaved, currentMethods }) {
  const [name, setName]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    if (currentMethods.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A method with this name already exists.'); return;
    }
    setSaving(true);
    const maxSort = currentMethods.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    const { error: err } = await supabase.from('payment_methods').insert({ name: trimmed, sort_order: maxSort + 1 });
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div className="modal-title">ADD PAYMENT METHOD</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          {name.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
              <MethodLogo name={name.trim()} size={36} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Logo preview</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Method Name *</label>
            <input
              className="form-input"
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="PayPal, Wire, ACH, Zelle..."
            />
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
              Logos auto-match for PayPal, Zelle, Wire, ACH, Check, Direct Deposit, Venmo, Cash
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Adding...' : 'Add Method'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function PaymentMethodsView() {
  const [methods, setMethods]         = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [mRes, iRes] = await Promise.all([
      supabase.from('payment_methods').select('*').order('sort_order').order('name'),
      supabase.from('invoices').select('payment_method'),
    ]);
    setMethods(mRes.data || []);
    // Count invoice usage per method name (case-insensitive match)
    const counts = {};
    for (const inv of (iRes.data || [])) {
      if (!inv.payment_method) continue;
      const key = inv.payment_method.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    setUsageCounts(counts);
    setLoading(false);
  }

  async function toggle(m) {
    await supabase.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
    load();
  }

  async function deleteMethod(m) {
    if (!window.confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
    await supabase.from('payment_methods').delete().eq('id', m.id);
    load();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  const active   = methods.filter(m => m.is_active);
  const inactive = methods.filter(m => !m.is_active);

  const invoiceCount = (m) => usageCounts[m.name.toLowerCase()] || 0;

  function Grid({ items }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {items.map(m => (
          <MethodCard
            key={m.id}
            method={m}
            onToggle={() => toggle(m)}
            onDelete={() => deleteMethod(m)}
            invoiceCount={invoiceCount(m)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PAYMENT METHODS</div>
          <div className="page-subtitle">Methods available in invoice dropdowns</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Method</button>
      </div>

      {methods.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No payment methods yet</div>
          <div className="empty-state-text">Add methods like PayPal, Wire, ACH, Zelle...</div>
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
        <AddMethodModal
          currentMethods={methods}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
