import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isValidEmail } from '../../utils/format';

const CONTACT_METHODS = ['Email', 'Text', 'WhatsApp', 'Direct Message'];

function ContactMethodIcon({ method }) {
  if (!method) return null;
  const m = method.toLowerCase();
  const style = { flexShrink: 0 };

  if (m === 'email') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} title="Preferred: Email">
      <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
    </svg>
  );
  if (m === 'text') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} title="Preferred: Text">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
  if (m === 'whatsapp') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} title="Preferred: WhatsApp">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
  if (m === 'direct message') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} title="Preferred: Direct Message">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
  return null;
}

function IconLink({ href, title, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title}
      style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', transition: 'color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--white)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
      {children}
    </a>
  );
}

export default function AgenciesView() {
  const [agencies, setAgencies]   = useState([]);
  const [statsMap, setStatsMap]   = useState({});
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [aRes, cRes, tRes] = await Promise.all([
      supabase.from('agencies').select('*').order('name'),
      supabase.from('campaigns').select(
        'id, agency_id, creator_profile_id, ' +
        'creator:profiles!campaigns_creator_profile_id_fkey(creator_name, full_name), ' +
        'campaign_deliverables(id)'
      ),
      supabase.from('payment_terms').select('id, name').eq('is_active', true).order('sort_order').order('name'),
    ]);
    setAgencies(aRes.data || []);
    setPaymentTerms(tRes.data || []);

    const map = {};
    for (const c of (cRes.data || [])) {
      if (!c.agency_id) continue;
      if (!map[c.agency_id]) map[c.agency_id] = {};
      const cid = c.creator_profile_id || 'unknown';
      if (!map[c.agency_id][cid]) {
        map[c.agency_id][cid] = {
          name: c.creator?.creator_name || c.creator?.full_name || 'Unknown',
          campaigns: 0,
          posts: 0,
        };
      }
      map[c.agency_id][cid].campaigns += 1;
      map[c.agency_id][cid].posts += (c.campaign_deliverables || []).length;
    }
    setStatsMap(map);
    setLoading(false);
  }

  async function toggleActive(a) {
    await supabase.from('agencies').update({ is_active: !a.is_active }).eq('id', a.id);
    fetchAll();
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">AGENCY SETUP</div>
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
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 80 }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: 30 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr><th></th><th>Name</th><th>Contact</th><th></th><th>Terms</th><th>Activity</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {agencies.map(a => {
                const creatorStats = Object.values(statsMap[a.id] || {});
                const hasStats = creatorStats.length > 0;
                return (
                  <tr key={a.id} style={{ opacity: a.is_active ? 1 : 0.5 }}>
                    <td style={{ paddingRight: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {a.website ? (
                          <IconLink href={a.website} title={a.website}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                          </IconLink>
                        ) : <span style={{ width: 14 }} />}
                        {a.portal_url ? (
                          <IconLink href={a.portal_url} title={`Portal: ${a.portal_url}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                              <polyline points="10 17 15 12 10 7"/>
                              <line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                          </IconLink>
                        ) : <span style={{ width: 14 }} />}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td>
                      {a.contact_name ? (
                        a.email ? (
                          <a
                            href={`mailto:${a.email}`}
                            title={[a.email, a.phone].filter(Boolean).join('\n')}
                            className="link"
                            style={{ fontWeight: 400 }}
                          >
                            {a.contact_name}
                          </a>
                        ) : a.contact_name
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td style={{ paddingLeft: 0 }}>
                      <ContactMethodIcon method={a.preferred_contact} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {paymentTerms.find(t => t.id === a.payment_term_id)?.name || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {hasStats ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {creatorStats.map(s => (
                            <div key={s.name} style={{ fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: 6 }}>{s.name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {s.campaigns} campaign{s.campaigns !== 1 ? 's' : ''} · {s.posts} post{s.posts !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${a.is_active ? 'badge-active' : 'badge-cancelled'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(a); setShowModal(true); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AgencyModal
          agency={editing}
          paymentTerms={paymentTerms}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function AgencyModal({ agency, paymentTerms, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:               agency?.name               || '',
    contact_name:       agency?.contact_name       || '',
    email:              agency?.email              || '',
    phone:              agency?.phone              || '',
    preferred_contact:  agency?.preferred_contact  || '',
    website:            agency?.website            || '',
    portal_url:         agency?.portal_url         || '',
    payment_term_id:    agency?.payment_term_id    || paymentTerms[0]?.id || '',
    notes:              agency?.notes              || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProto);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      return withProto;
    } catch { return null; }
  }

  async function save() {
    const errors = [];
    if (!form.name.trim()) errors.push('Agency name is required.');
    if (form.email && !isValidEmail(form.email)) errors.push('Email address is not valid.');
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      name:         form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      email:        form.email.trim().toLowerCase() || null,
      phone:        form.phone.trim() || null,
      notes:        form.notes.trim() || null,
      website:      normalizeUrl(form.website),
      portal_url:   normalizeUrl(form.portal_url),
    };
    if (agency) {
      await supabase.from('agencies').update(payload).eq('id', agency.id);
    } else {
      await supabase.from('agencies').insert(payload);
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
            <input className="form-input" value={form.name} maxLength={120} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="YTK Media" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Name</label>
              <input className="form-input" value={form.contact_name} maxLength={120} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Vasily" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} maxLength={254} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} maxLength={30} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Contact</label>
              <select className="form-select" value={form.preferred_contact} onChange={e => setForm(f => ({ ...f, preferred_contact: e.target.value }))}>
                <option value="">— Select —</option>
                {CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website} maxLength={500} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="ytkmedia.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Portal URL</label>
              <input className="form-input" value={form.portal_url} maxLength={500} onChange={e => setForm(f => ({ ...f, portal_url: e.target.value }))} placeholder="creator-portal.agency.com" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <select className="form-select" value={form.payment_term_id} onChange={e => setForm(f => ({ ...f, payment_term_id: e.target.value }))}>
                <option value="">— Select —</option>
                {paymentTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} maxLength={2000} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
