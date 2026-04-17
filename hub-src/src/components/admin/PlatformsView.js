import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function PlatformsView() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase.from('platforms').select('*').order('name');
    setPlatforms(data || []);
    setLoading(false);
  }

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    await supabase.from('platforms').insert({ name: newName.trim() });
    setNewName('');
    setAdding(false);
    fetch();
  }

  async function toggle(p) {
    await supabase.from('platforms').update({ is_active: !p.is_active }).eq('id', p.id);
    fetch();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PLATFORMS</div>
          <div className="page-subtitle">Define which platforms campaigns can run on</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 500 }}>
        <div className="card-title">ADD PLATFORM</div>
        <div className="flex gap-8">
          <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Snapchat, Pinterest..." onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn btn-primary" onClick={add} disabled={adding || !newName.trim()}>Add</button>
        </div>
      </div>

      <div className="mt-20">
        {platforms.map(p => (
          <div key={p.id} className="flex items-center justify-between" style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <div className="flex items-center gap-12">
              <span className={`badge ${p.is_active ? 'badge-active' : 'badge-cancelled'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
