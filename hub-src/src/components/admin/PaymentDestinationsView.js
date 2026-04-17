import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const ACCOUNT_TYPES = ['Checking', 'Savings', 'UTMA', 'Investment', 'Other'];

export default function PaymentDestinationsView() {
  const [creators, setCreators] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCreator, setFilterCreator] = useState('all');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [c, d] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'creator').order('creator_name'),
      supabase.from('payment_destinations')
        .select('*, profile:profiles(creator_name, full_name)')
        .order('profile_id')
        .order('sort_order'),
    ]);
    setCreators(c.data || []);
    setDestinations(d.data || []);
    setLoading(false);
  }

  async function toggleActive(d) {
    await supabase.from('payment_destinations').update({ is_active: !d.is_active }).eq('id', d.id);
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
          {/* Group by creator */}
          {(filterCreator === 'all' ? creators : creators.filter(c => c.id === filterCreator)).map(creator => {
            const creatorDests = filtered.filter(d => d.profile_id === creator.id);
            if (creatorDests.length === 0) return null;
            return (
              <div key={creator.id} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {creator.creator_name || creator.full_name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {creatorDests.map(dest => (
                    <DestinationCard
                      key={dest.id}
                      dest={dest}
                      onEdit={() => { setEditing(dest); setShowModal(true); }}
                      onToggle={() => toggleActive(dest)}
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

function DestinationCard({ dest, onEdit, onToggle }) {
  const typeColors = {
    'Checking': 'var(--blue)',
    'Savings': 'var(--green)',
    'UTMA': 'var(--purple)',
    'Investment': 'var(--orange)',
    'Other': 'var(--text-muted)',
  };

  return (
    <div className="card" style={{ opacity: dest.is_active ? 1 : 0.5, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{dest.name}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>
            <span style={{ color: typeColors[dest.account_type] || 'var(--text-muted)', fontWeight: 600 }}>
              {dest.account_type}
            </span>
            {dest.institution && <span className="text-muted"> · {dest.institution}</span>}
          </div>
        </div>
        {!dest.is_active && (
          <span className="badge badge-cancelled" style={{ fontSize: 10 }}>Inactive</span>
        )}
      </div>
      {dest.account_last4 && (
        <div className="text-muted text-sm" style={{ fontFamily: 'monospace', marginBottom: 4 }}>
          ···· {dest.account_last4}
        </div>
      )}
      {dest.memo && (
        <div className="text-muted text-xs" style={{ marginBottom: 8 }}>{dest.memo}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={onToggle}>
          {dest.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}

function DestinationModal({ destination, creators, onClose, onSaved }) {
  const [form, setForm] = useState({
    profile_id: destination?.profile_id || '',
    name: destination?.name || '',
    account_type: destination?.account_type || 'Savings',
    account_last4: destination?.account_last4 || '',
    institution: destination?.institution || '',
    memo: destination?.memo || '',
    sort_order: destination?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.profile_id || !form.name.trim()) {
      setError('Creator and destination name are required.');
      return;
    }
    if (form.account_last4 && !/^\d{4}$/.test(form.account_last4)) {
      setError('Last 4 must be exactly 4 digits.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      name: form.name.trim(),
      account_last4: form.account_last4 || null,
      institution: form.institution.trim() || null,
      memo: form.memo.trim() || null,
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
          <div className="form-group">
            <label className="form-label">Creator *</label>
            <select
              className="form-select"
              value={form.profile_id}
              onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}
              disabled={!!destination}
            >
              <option value="">Select creator...</option>
              {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Destination Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Savings, UTMA, Checking..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Type *</label>
              <select className="form-select" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Institution</label>
              <input
                className="form-input"
                value={form.institution}
                onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                placeholder="Chase, Fidelity..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last 4 Digits</label>
              <input
                className="form-input"
                value={form.account_last4}
                onChange={e => setForm(f => ({ ...f, account_last4: e.target.value.slice(0, 4) }))}
                placeholder="6789"
                maxLength={4}
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Memo / Notes</label>
            <input
              className="form-input"
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="Any routing notes or identifiers..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Display Order</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              style={{ width: 80 }}
            />
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
