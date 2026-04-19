import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const ACCOUNT_TYPES = ['Checking', 'Savings', 'UTMA', 'Investment', 'Other'];

// ── Payment method logos ───────────────────────────────────────────────────────
function MethodLogo({ name, size = 24 }) {
  const n = (name || '').toLowerCase();
  if (n.includes('paypal'))                                 return <PayPalLogo size={size} />;
  if (n.includes('zelle'))                                  return <ZelleLogo size={size} />;
  if (n.includes('wire'))                                   return <WireLogo size={size} />;
  if (n.includes('ach'))                                    return <ACHLogo size={size} />;
  if (n.includes('check'))                                  return <CheckLogo size={size} />;
  if (n.includes('direct deposit') || n.includes('direct')) return <DirectDepositLogo size={size} />;
  if (n.includes('venmo'))                                  return <VenmoLogo size={size} />;
  if (n.includes('cash'))                                   return <CashLogo size={size} />;
  if (n.includes('stripe'))                                 return <StripeLogo size={size} />;
  return <GenericMethodLogo size={size} label={(name || '?').slice(0, 2).toUpperCase()} />;
}

function PayPalLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#F5F7FA" rx="6"/>
      <path d="M15 10 L22 10 C26.5 10 29 12.5 28.5 16.5 C28 20.5 25 23 21 23 L18.5 23 L17 30 L13 30 Z" fill="#003087"/>
      <path d="M17.5 16 L24.5 16 C29 16 31.5 18.5 31 22.5 C30.5 26.5 27.5 29 23.5 29 L21 29 L19.5 36 L15.5 36 Z" fill="#009CDE"/>
      <path d="M18.5 14 L22 14 C24 14 25 15 24.8 17 C24.5 19 23 20 21 20 L19 20 Z" fill="#F5F7FA"/>
      <path d="M21 20 L24.5 20 C26.5 20 27.5 21 27.3 23 C27 25 25.5 26 23.5 26 L21.5 26 Z" fill="#F5F7FA"/>
    </svg>
  );
}

function ZelleLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#6D1ED4" rx="6"/>
      <rect x="13" y="9" width="16" height="4" rx="1.5" fill="white"/>
      <rect x="19" y="7" width="4" height="6" rx="1" fill="white"/>
      <polygon points="27,13 29,13 15,29 13,29" fill="white"/>
      <rect x="13" y="29" width="16" height="4" rx="1.5" fill="white"/>
      <rect x="19" y="29" width="4" height="6" rx="1" fill="white"/>
    </svg>
  );
}

function WireLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1a1a2e" rx="6"/>
      <line x1="8" y1="15" x2="34" y2="15" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="21" x2="34" y2="21" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8" y1="27" x2="34" y2="27" stroke="#c9a227" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="14" y1="13" x2="14" y2="29" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="28" y1="13" x2="28" y2="29" stroke="#c9a227" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

function ACHLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0a5c36" rx="6"/>
      <text x="21" y="27" textAnchor="middle"
        style={{ fontSize: 13, fontWeight: 800, fill: '#4ade80', fontFamily: 'Arial, sans-serif', letterSpacing: 0.5 }}>ACH</text>
    </svg>
  );
}

function CheckLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#2a1f00" rx="6"/>
      <rect x="7" y="13" width="28" height="16" rx="2" fill="none" stroke="#c9a227" strokeWidth="1.5"/>
      <line x1="11" y1="23" x2="20" y2="23" stroke="#c9a227" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M11 18 Q13 16 15 18 Q17 20 19 18" fill="none" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
      <rect x="23" y="16" width="9" height="6" rx="1" fill="none" stroke="#c9a227" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

function DirectDepositLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0c2340" rx="6"/>
      <rect x="10" y="24" width="4" height="8" rx="1" fill="#4a9eff" opacity="0.7"/>
      <rect x="16" y="20" width="4" height="12" rx="1" fill="#4a9eff" opacity="0.85"/>
      <rect x="22" y="22" width="4" height="10" rx="1" fill="#4a9eff" opacity="0.7"/>
      <rect x="28" y="18" width="4" height="14" rx="1" fill="#4a9eff"/>
      <path d="M21 8 L21 15 M18 12 L21 15 L24 12" fill="none" stroke="#4a9eff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function VenmoLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#3D95CE" rx="6"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif' }}>V</text>
    </svg>
  );
}

function CashLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#14532d" rx="6"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: '#4ade80', fontFamily: 'Georgia, serif' }}>$</text>
    </svg>
  );
}

function StripeLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#635BFF" rx="6"/>
      <path d="M23.5 13.5 C19 13.5 16.5 15.8 16.5 19 C16.5 25.5 25.5 23.5 25.5 26.5 C25.5 28 24 28.8 21.5 28.8 C18.5 28.8 16 27.5 16 27.5 L16 27.5 C16 27.5 16.5 29.5 16.5 29.5 C16.5 29.5 18.8 30.5 21.8 30.5 C26.5 30.5 29 28.2 29 24.8 C29 18 20 20.2 20 17 C20 15.8 21.2 15 23.2 15 C25.8 15 27.8 16 27.8 16 Z" fill="white"/>
    </svg>
  );
}

function GenericMethodLogo({ size, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1e1e1e" rx="6"/>
      <text x="21" y="27" textAnchor="middle" fill="#555"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}

// ── Institution logos ──────────────────────────────────────────────────────────
function InstitutionLogo({ institution, size = 24 }) {
  if (!institution) return <GenericInstitutionLogo size={size} />;
  const name = institution.toLowerCase();
  if (name.includes('chase'))    return <ChaseLogo size={size} />;
  if (name.includes('vanguard')) return <VanguardLogo size={size} />;
  if (name.includes('fidelity')) return <FidelityLogo size={size} />;
  if (name.includes('schwab'))   return <SchwabLogo size={size} />;
  if (name.includes('bofa') || name.includes('bank of america')) return <BofALogo size={size} />;
  return <GenericInstitutionLogo size={size} label={institution.slice(0, 2).toUpperCase()} />;
}

function ChaseLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#117ACA" rx="6"/>
      <path d="M20 8 L32 20 L20 32 L8 20 Z" fill="none" stroke="white" strokeWidth="2.5"/>
      <path d="M20 14 L26 20 L20 26 L14 20 Z" fill="white"/>
    </svg>
  );
}

function VanguardLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#8B0000" rx="6"/>
      <path d="M8 12 L20 28 L32 12" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 12 L20 22 L27 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    </svg>
  );
}

function FidelityLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#167C45" rx="6"/>
      <text x="20" y="27" textAnchor="middle" fill="white"
        style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -1 }}>F</text>
    </svg>
  );
}

function SchwabLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#00A2E2" rx="6"/>
      <text x="20" y="27" textAnchor="middle" fill="white"
        style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>S</text>
    </svg>
  );
}

function BofALogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#E31837" rx="6"/>
      <rect x="0" y="24" width="40" height="16" fill="#012169" rx="0"/>
      <rect x="0" y="35" width="40" height="5" fill="#E31837"/>
      <text x="20" y="20" textAnchor="middle" fill="white"
        style={{ fontSize: 9, fontWeight: 700, fontFamily: 'Arial, sans-serif', letterSpacing: 0.5 }}>BofA</text>
    </svg>
  );
}

function GenericInstitutionLogo({ size, label = '?' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="40" height="40" fill="#1e1e1e" rx="6"/>
      <text x="20" y="26" textAnchor="middle" fill="#888"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}

const TYPE_COLOR = {
  Checking:   'var(--blue)',
  Savings:    'var(--green)',
  UTMA:       '#a78bfa',
  Investment: 'var(--orange)',
  Other:      'var(--muted)',
};

// ── Main view ─────────────────────────────────────────────────────────────────
export default function PaymentSetupView() {
  const [methods, setMethods]           = useState([]);
  const [usageCounts, setUsageCounts]   = useState({});
  const [destinations, setDestinations] = useState([]);
  const [creators, setCreators]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showMethodModal, setShowMethodModal]   = useState(false);
  const [showDestModal, setShowDestModal]       = useState(false);
  const [editingDest, setEditingDest]           = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [mRes, iRes, dRes, cRes] = await Promise.all([
      supabase.from('payment_methods').select('*').order('sort_order').order('name'),
      supabase.from('invoices').select('payment_method'),
      supabase.from('payment_destinations')
        .select('*, profile:profiles(creator_name, full_name), payout_splits(id)')
        .order('profile_id').order('sort_order'),
      supabase.from('profiles').select('*').eq('role', 'creator').order('creator_name'),
    ]);
    setMethods(mRes.data || []);
    const counts = {};
    for (const inv of (iRes.data || [])) {
      if (!inv.payment_method) continue;
      counts[inv.payment_method.toLowerCase()] = (counts[inv.payment_method.toLowerCase()] || 0) + 1;
    }
    setUsageCounts(counts);
    setDestinations((dRes.data || []).map(d => ({ ...d, hasPayouts: (d.payout_splits || []).length > 0 })));
    setCreators(cRes.data || []);
    setLoading(false);
  }

  async function toggleMethod(m) {
    await supabase.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
    fetchAll();
  }

  async function deleteMethod(m) {
    if (!window.confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
    await supabase.from('payment_methods').delete().eq('id', m.id);
    fetchAll();
  }

  async function toggleDest(d) {
    await supabase.from('payment_destinations').update({ is_active: !d.is_active }).eq('id', d.id);
    fetchAll();
  }

  async function deleteDest(d) {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    await supabase.from('payment_destinations').delete().eq('id', d.id);
    fetchAll();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PAYMENT SETUP</div>
          <div className="page-subtitle">Methods and payout destinations</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={() => setShowMethodModal(true)}>+ Add Method</button>
          <button className="btn btn-primary" onClick={() => { setEditingDest(null); setShowDestModal(true); }}>+ Add Destination</button>
        </div>
      </div>

      {/* ── Payment Methods ── */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>
        Payment Methods
      </div>
      {methods.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 32 }}>
          <div className="empty-state-title">No payment methods yet</div>
          <div className="empty-state-text">Add methods like PayPal, Wire, ACH, Zelle...</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 36 }}>
          <table>
            <thead>
              <tr><th></th><th>Method</th><th>Usage</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {methods.map(m => {
                const count = usageCounts[m.name.toLowerCase()] || 0;
                return (
                  <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.5 }}>
                    <td style={{ width: 32, paddingRight: 0 }}><MethodLogo name={m.name} size={24} /></td>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {count > 0 ? `${count} invoice${count !== 1 ? 's' : ''}` : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${m.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleMethod(m)}>
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {count === 0 && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteMethod(m)}>
                            Delete
                          </button>
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

      {/* ── Payment Destinations ── */}
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--muted)', marginBottom: 10 }}>
        Payout Destinations
      </div>
      {destinations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No destinations configured</div>
          <div className="empty-state-text">Add payout accounts for Kym and Mys</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th></th><th>Destination</th><th>Creator</th><th>Type</th><th>Account</th><th>Memo</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {destinations.map(d => (
                <tr key={d.id} style={{ opacity: d.is_active ? 1 : 0.5 }}>
                  <td style={{ width: 32, paddingRight: 0 }}><InstitutionLogo institution={d.institution} size={24} /></td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{d.profile?.creator_name || d.profile?.full_name || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[d.account_type] || 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {d.account_type}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                    {d.institution && <span>{d.institution}</span>}
                    {d.institution && d.account_last4 && <span style={{ color: '#444' }}> · </span>}
                    {d.account_last4 && <span>···· {d.account_last4}</span>}
                    {!d.institution && !d.account_last4 && <span className="text-muted">—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                    {d.account_type === 'Other' ? (d.memo || <span className="text-muted">—</span>) : (d.memo || <span className="text-muted">—</span>)}
                  </td>
                  <td>
                    <span className={`badge ${d.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingDest(d); setShowDestModal(true); }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleDest(d)}>
                        {d.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {!d.hasPayouts && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteDest(d)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showMethodModal && (
        <AddMethodModal
          currentMethods={methods}
          onClose={() => setShowMethodModal(false)}
          onSaved={() => { setShowMethodModal(false); fetchAll(); }}
        />
      )}

      {showDestModal && (
        <DestinationModal
          destination={editingDest}
          creators={creators}
          onClose={() => setShowDestModal(false)}
          onSaved={() => { setShowDestModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ── Add method modal ───────────────────────────────────────────────────────────
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

// ── Destination modal ──────────────────────────────────────────────────────────
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">{destination ? 'EDIT DESTINATION' : 'ADD DESTINATION'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          {form.institution.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8 }}>
              <InstitutionLogo institution={form.institution.trim()} size={36} />
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
                placeholder="6789" maxLength={4} style={{ fontFamily: 'monospace' }} />
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
