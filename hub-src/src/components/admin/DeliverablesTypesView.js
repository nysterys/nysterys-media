import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function DeliverablesTypesView() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase.from('deliverable_types').select('*').order('name');
    setTypes(data || []);
    setLoading(false);
  }

  async function add() {
    if (!form.name.trim()) return;
    setAdding(true);
    await supabase.from('deliverable_types').insert({ name: form.name.trim(), description: form.description.trim() || null });
    setForm({ name: '', description: '' });
    setAdding(false);
    fetch();
  }

  async function toggle(t) {
    await supabase.from('deliverable_types').update({ is_active: !t.is_active }).eq('id', t.id);
    fetch();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">DELIVERABLE TYPES</div>
          <div className="page-subtitle">Define content formats for campaigns</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 500, marginBottom: 24 }}>
        <div className="card-title">ADD TYPE</div>
        <div className="form-group">
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Carousel, Video Series..." />
        </div>
        <div className="form-group">
          <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
        </div>
        <button className="btn btn-primary" onClick={add} disabled={adding || !form.name.trim()}>Add Type</button>
      </div>

      {types.map(t => (
        <div key={t.id} className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontWeight: 500 }}>{t.name}</span>
            {t.description && <span className="text-muted text-sm" style={{ marginLeft: 10 }}>{t.description}</span>}
          </div>
          <div className="flex items-center gap-12">
            <span className={`badge ${t.is_active ? 'badge-active' : 'badge-cancelled'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(t)}>{t.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
