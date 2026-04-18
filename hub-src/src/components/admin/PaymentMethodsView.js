import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PaymentMethodsView() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('payment_methods').select('*').order('sort_order').order('name');
    setMethods(data || []);
    setLoading(false);
  }

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    const maxSort = methods.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
    await supabase.from('payment_methods').insert({ name: newName.trim(), sort_order: maxSort + 1 });
    setNewName('');
    setAdding(false);
    load();
  }

  async function toggle(m) {
    await supabase.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
    load();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PAYMENT METHODS</div>
          <div className="page-subtitle">Methods available in invoice dropdowns</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 500, marginBottom: 24 }}>
        <div className="card-title">ADD METHOD</div>
        <div className="flex gap-8">
          <input
            className="form-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Direct Deposit, Venmo..."
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button className="btn btn-primary" onClick={add} disabled={adding || !newName.trim()}>Add</button>
        </div>
      </div>

      {methods.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No payment methods yet</div>
          <div className="empty-state-text">Add methods like PayPal, Wire, ACH, Zelle...</div>
        </div>
      ) : (
        <div>
          {methods.map(m => (
            <div key={m.id} className="flex items-center justify-between" style={{
              padding: '12px 16px', borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: 500 }}>{m.name}</span>
              <div className="flex items-center gap-12">
                <span className={`badge ${m.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                  {m.is_active ? 'Active' : 'Inactive'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(m)}>
                  {m.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
