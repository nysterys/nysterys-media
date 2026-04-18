import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isValidEmail } from '../../utils/format';

export default function AgenciesView() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase.from('agencies').select('*').order('name');
    setAgencies(data || []);
    setLoading(false);
  }

  async function toggleActive(a) {
    await supabase.from('agencies').update({ is_active: !a.is_active }).eq('id', a.id);
    fetch();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">AGENCIES & LABELS</div>
          <div className="page-subtitle">Set up once, reuse across all campaigns</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ New Agency</button>
      </div>

      {agencies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⬡</div>
          <div className="empty-state-title">No agencies yet</div>
          <div className="empty-state-text">Add your first agency or label</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Contact</th><th>Email</th><th>Payment Terms</th><th>Notes</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {agencies.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td>{a.contact_name || <span className="text-muted">—</span>}</td>
                  <td>{a.email || <span className="text-muted">—</span>}</td>
                  <td>{a.payment_terms}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || <span className="text-muted">—</span>}</td>
                  <td><span className={`badge ${a.is_active ? 'badge-active' : 'badge-cancelled'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(a); setShowModal(true); }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AgencyModal
          agency={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetch(); }}
        />
      )}
    </div>
  );
}

function AgencyModal({ agency, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: agency?.name || '',
    contact_name: agency?.contact_name || '',
    email: agency?.email || '',
    phone: agency?.phone || '',
    payment_terms: agency?.payment_terms || 'Net 30',
    notes: agency?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const errors = [];
    if (!form.name.trim()) errors.push('Agency name is required.');
    if (form.email && !isValidEmail(form.email)) errors.push('Email address is not valid.');
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true);
    setError('');
    if (agency) {
      await supabase.from('agencies').update(form).eq('id', agency.id);
    } else {
      await supabase.from('agencies').insert(form);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">{agency ? 'EDIT AGENCY' : 'NEW AGENCY'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Agency / Label Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="YTK Media" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input className="form-input" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Vasily" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <select className="form-select" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                <option>Upon Receipt</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 60</option>
                <option>Net 90</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
