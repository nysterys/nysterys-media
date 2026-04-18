import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import Comments from '../shared/Comments';
import { format, parseISO } from 'date-fns';

const CAMPAIGN_STATUSES = ['Negotiating', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const PAYMENT_STATUSES = ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed'];

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [creators, setCreators] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [deliverableTypes, setDeliverableTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [detailTab, setDetailTab] = useState('deliverables');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [c, a, cr, p, dt] = await Promise.all([
      supabase.from('campaigns').select(`
        *, agency:agencies(name), creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
        campaign_deliverables:campaign_deliverables_with_stats(*, platform:platforms(name), deliverable_type:deliverable_types(name),
          revision_rounds(* , submitted_by_profile:profiles!revision_rounds_submitted_by_fkey(full_name))),
        invoices(*)
      `).order('created_at', { ascending: false }),
      supabase.from('agencies').select('*').eq('is_active', true),
      supabase.from('profiles').select('*').eq('role', 'creator'),
      supabase.from('platforms').select('*').eq('is_active', true),
      supabase.from('deliverable_types').select('*').eq('is_active', true),
    ]);
    setCampaigns(c.data || []);
    setAgencies(a.data || []);
    setCreators(cr.data || []);
    setPlatforms(p.data || []);
    setDeliverableTypes(dt.data || []);
    setLoading(false);
  }

  const filtered = campaigns.filter(c => {
    const statusOk = filter === 'all' || c.status === filter;
    const creatorOk = creatorFilter === 'all' || c.creator_profile_id === creatorFilter;
    return statusOk && creatorOk;
  });

  async function openDetail(c) {
    setSelectedCampaign(c);
    setDetailTab('deliverables');
  }

  function closeDetail() { setSelectedCampaign(null); }

  const fmtDate = (d) => d ? format(parseISO(d), 'MMM d, yyyy') : '—';
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CAMPAIGNS</div>
          <div className="page-subtitle">{campaigns.length} total deals</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Campaign</button>
      </div>

      <div className="filters-row">
        <span className="text-muted text-xs" style={{ marginRight: 4 }}>STATUS</span>
        {['all', ...CAMPAIGN_STATUSES].map(s => (
          <button key={s} className={`filter-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />
        <span className="text-muted text-xs" style={{ marginRight: 4 }}>CREATOR</span>
        <button className={`filter-chip ${creatorFilter === 'all' ? 'active' : ''}`} onClick={() => setCreatorFilter('all')}>All</button>
        {creators.map(cr => (
          <button key={cr.id} className={`filter-chip ${creatorFilter === cr.id ? 'active' : ''}`} onClick={() => setCreatorFilter(cr.id)}>
            {cr.creator_name || cr.full_name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◎</div>
          <div className="empty-state-title">No campaigns found</div>
          <div className="empty-state-text">Adjust filters or create a new campaign</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Creator</th>
                <th>Agency</th>
                <th>Platforms</th>
                <th>Post Date</th>
                <th>Rate</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const earliestPost = c.campaign_deliverables?.reduce((min, d) => {
                  if (!d.contracted_post_date) return min;
                  return !min || d.contracted_post_date < min ? d.contracted_post_date : min;
                }, null);
                return (
                  <tr key={c.id} onClick={() => openDetail(c)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.campaign_name}</div>
                      <div className="text-muted text-xs">{c.brand_name}</div>
                    </td>
                    <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                        {c.campaign_deliverables?.map(d => (
                          <span key={d.id} className="badge badge-confirmed">{d.platform?.name || '?'}</span>
                        ))}
                        {(!c.campaign_deliverables || c.campaign_deliverables.length === 0) && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td>{fmtDate(earliestPost)}</td>
                    <td>
                      {c.contracted_rate
                        ? <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmtMoney(c.contracted_rate)}</span>
                        : <span className="text-muted">TBD</span>
                      }
                      {c.is_rush && <span className="badge badge-overdue" style={{ marginLeft: 6 }}>Rush</span>}
                    </td>
                    <td><Badge status={c.status} /></td>
                    <td>
                      {c.invoices?.[0]
                        ? <Badge status={c.invoices[0].payment_status} />
                        : <span className="text-muted text-xs">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CampaignModal
          agencies={agencies}
          creators={creators}
          platforms={platforms}
          deliverableTypes={deliverableTypes}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAll(); }}
        />
      )}

      {selectedCampaign && (
        <CampaignDetail
          campaign={selectedCampaign}
          agencies={agencies}
          creators={creators}
          platforms={platforms}
          deliverableTypes={deliverableTypes}
          tab={detailTab}
          setTab={setDetailTab}
          onClose={closeDetail}
          onUpdated={fetchAll}
        />
      )}
    </div>
  );
}

// ============================================================
// Campaign Create Modal
// ============================================================
function CampaignModal({ agencies, creators, platforms, deliverableTypes, onClose, onSaved }) {
  const [form, setForm] = useState({
    campaign_name: '', brand_name: '', agency_id: '', creator_profile_id: '',
    contracted_rate: '', is_rush: false, rush_premium: '',
    deal_signed_date: '', campaign_start_date: '', campaign_end_date: '',
    usage_rights_notes: '',
    brief: '', admin_notes: '', status: 'Negotiating',
  });
  const [deliverables, setDeliverables] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addDeliverable() {
    setDeliverables(d => [...d, {
      platform_id: '', deliverable_type_id: '', deliverable_details: '',
      quantity: 1, contracted_post_date: '',
    }]);
  }

  function setD(i, k, v) {
    setDeliverables(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  }

  function removeD(i) { setDeliverables(d => d.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!form.campaign_name.trim() || !form.brand_name.trim()) {
      setError('Campaign name and brand name are required.');
      return;
    }
    setSaving(true);
    setError('');

    const { data: camp, error: campErr } = await supabase.from('campaigns').insert({
      ...form,
      contracted_rate: form.contracted_rate ? parseFloat(form.contracted_rate) : null,
      rush_premium: form.rush_premium ? parseFloat(form.rush_premium) : 0,
      agency_id: form.agency_id || null,
      creator_profile_id: form.creator_profile_id || null,
    }).select().single();

    if (campErr) { setError(campErr.message); setSaving(false); return; }

    if (deliverables.length > 0) {
      await supabase.from('campaign_deliverables').insert(
        deliverables.map(d => ({
          campaign_id: camp.id,
          platform_id: d.platform_id || null,
          deliverable_type_id: d.deliverable_type_id || null,
          deliverable_details: d.deliverable_details || null,
          quantity: d.quantity || 1,
          contracted_post_date: d.contracted_post_date || null,
        }))
      );
    }

    // Auto-create invoice record
    await supabase.from('invoices').insert({
      campaign_id: camp.id,
      invoice_amount: form.contracted_rate ? parseFloat(form.contracted_rate) : null,
      payment_status: 'Not Invoiced',
    });

    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">NEW CAMPAIGN</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input className="form-input" value={form.campaign_name} onChange={e => setF('campaign_name', e.target.value)} placeholder="Summer Promo 2025" />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Name *</label>
              <input className="form-input" value={form.brand_name} onChange={e => setF('brand_name', e.target.value)} placeholder="Brand Co." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Creator</label>
              <select className="form-select" value={form.creator_profile_id} onChange={e => setF('creator_profile_id', e.target.value)}>
                <option value="">Select creator...</option>
                {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Agency / Label</label>
              <select className="form-select" value={form.agency_id} onChange={e => setF('agency_id', e.target.value)}>
                <option value="">Select agency...</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Contracted Rate ($)</label>
              <input className="form-input" type="number" value={form.contracted_rate} onChange={e => setF('contracted_rate', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setF('status', e.target.value)}>
                {CAMPAIGN_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deal Signed</label>
              <input className="form-input" type="date" value={form.deal_signed_date} onChange={e => setF('deal_signed_date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Campaign Start</label>
              <input className="form-input" type="date" value={form.campaign_start_date} onChange={e => setF('campaign_start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Campaign End</label>
              <input className="form-input" type="date" value={form.campaign_end_date} onChange={e => setF('campaign_end_date', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_rush} onChange={e => setF('is_rush', e.target.checked)} />
              Rush deal
            </label>
          </div>
          {form.is_rush && (
            <div className="form-group">
              <label className="form-label">Rush Premium ($)</label>
              <input className="form-input" type="number" value={form.rush_premium} onChange={e => setF('rush_premium', e.target.value)} placeholder="0.00" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Brief / Instructions</label>
            <textarea className="form-textarea" value={form.brief} onChange={e => setF('brief', e.target.value)} placeholder="Campaign brief, talking points, requirements..." />
          </div>

          <div className="form-group">
            <label className="form-label">Usage Rights Notes</label>
            <input className="form-input" value={form.usage_rights_notes} onChange={e => setF('usage_rights_notes', e.target.value)} placeholder="e.g. 6 months digital, no paid amplification..." />
          </div>

          <div className="form-group">
            <label className="form-label">Internal Notes</label>
            <textarea className="form-textarea" value={form.admin_notes} onChange={e => setF('admin_notes', e.target.value)} placeholder="Notes visible to all team members..." style={{ minHeight: 60 }} />
          </div>

          <div className="divider" />

          <div className="flex items-center justify-between mb-12">
            <div style={{ fontWeight: 600, fontSize: 13 }}>PLATFORM DELIVERABLES</div>
            <button className="btn btn-secondary btn-sm" onClick={addDeliverable}>+ Add Platform</button>
          </div>

          {deliverables.map((d, i) => (
            <div key={i} className="deliverable-card">
              <div className="deliverable-card-header">
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Platform {i + 1}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeD(i)}>Remove</button>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Platform</label>
                  <select className="form-select" value={d.platform_id} onChange={e => setD(i, 'platform_id', e.target.value)}>
                    <option value="">Select...</option>
                    {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Deliverable Type</label>
                  <select className="form-select" value={d.deliverable_type_id} onChange={e => setD(i, 'deliverable_type_id', e.target.value)}>
                    <option value="">Select...</option>
                    {deliverableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Contracted Post Date</label>
                  <input className="form-input" type="date" value={d.contracted_post_date} onChange={e => setD(i, 'contracted_post_date', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min={1} value={d.quantity} onChange={e => setD(i, 'quantity', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Deliverable Details</label>
                <input className="form-input" value={d.deliverable_details} onChange={e => setD(i, 'deliverable_details', e.target.value)} placeholder="Specific instructions for this platform..." />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create Campaign'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Campaign Detail Side Panel
// ============================================================
function CampaignDetail({ campaign, agencies, creators, platforms, deliverableTypes, tab, setTab, onClose, onUpdated }) {
  const [c, setC] = useState(campaign);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [showAddRevision, setShowAddRevision] = useState(null);
  const [showEditDeliverable, setShowEditDeliverable] = useState(null);
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);

  useEffect(() => { setC(campaign); }, [campaign]);

  const fmtDate = (d) => d ? format(parseISO(d), 'MMM d, yyyy') : '—';
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

  async function updateCampaignStatus(status) {
    if (status === 'Completed') {
      const deliverables = c.campaign_deliverables || [];
      const allPosted = deliverables.length > 0 && deliverables.every(d => d.draft_status === 'Posted');
      if (!allPosted) {
        alert(`Cannot mark as Completed — ${deliverables.filter(d => d.draft_status !== 'Posted').length} deliverable(s) are not yet Posted.`);
        setEditingStatus(false);
        return;
      }
    }
    await supabase.from('campaigns').update({ status }).eq('id', c.id);
    setEditingStatus(false);
    onUpdated();
  }

  async function updatePaymentStatus(payment_status) {
    if (c.invoices?.[0]) {
      await supabase.from('invoices').update({ payment_status }).eq('id', c.invoices[0].id);
    }
    setEditingPayment(false);
    onUpdated();
  }

  async function markPosted(deliverableId, postUrl, postDate) {
    await supabase.from('campaign_deliverables').update({
      post_url: postUrl, actual_post_date: postDate, draft_status: 'Posted', posted_at: new Date().toISOString(),
    }).eq('id', deliverableId);
    onUpdated();
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="flex items-center justify-between mb-8">
          <Badge status={c.status} />
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 1 }}>{c.campaign_name}</div>
        <div className="text-muted mt-4">{c.brand_name} · {c.agency?.name || 'No agency'}</div>
        <div className="mt-8" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditCampaign(true)}>Edit Campaign</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingStatus(true)}>Update Status</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingPayment(true)}>Update Payment</button>
        </div>
      </div>

      <div className="tabs" style={{ padding: '0 24px' }}>
        {['deliverables', 'details', 'invoice', 'comments'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      <div className="detail-body">
        {tab === 'deliverables' && (
          <DeliverableTab
            campaign={c}
            platforms={platforms}
            deliverableTypes={deliverableTypes}
            onUpdated={onUpdated}
          />
        )}

        {tab === 'details' && (
          <DetailsTab campaign={c} agencies={agencies} creators={creators} onUpdated={onUpdated} />
        )}

        {tab === 'invoice' && (
          <InvoiceTab campaign={c} onUpdated={onUpdated} />
        )}

        {tab === 'comments' && (
          <Comments campaignId={c.id} />
        )}
      </div>

      {editingStatus && (
        <QuickPickModal
          title="Update Campaign Status"
          options={CAMPAIGN_STATUSES}
          onPick={updateCampaignStatus}
          onClose={() => setEditingStatus(false)}
        />
      )}

      {editingPayment && (
        <QuickPickModal
          title="Update Payment Status"
          options={PAYMENT_STATUSES}
          onPick={updatePaymentStatus}
          onClose={() => setEditingPayment(false)}
        />
      )}

      {showEditCampaign && (
        <EditCampaignModal
          campaign={c}
          agencies={agencies}
          creators={creators}
          onClose={() => setShowEditCampaign(false)}
          onSaved={() => { setShowEditCampaign(false); onUpdated(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Details Tab — inline editable form
// ============================================================
function DetailsTab({ campaign, agencies, creators, onUpdated }) {
  const [form, setForm] = useState({
    campaign_name: campaign.campaign_name || '',
    brand_name: campaign.brand_name || '',
    agency_id: campaign.agency_id || '',
    creator_profile_id: campaign.creator_profile_id || '',
    contracted_rate: campaign.contracted_rate ?? '',
    is_rush: campaign.is_rush || false,
    rush_premium: campaign.rush_premium ?? '',
    deal_signed_date: campaign.deal_signed_date || '',
    campaign_start_date: campaign.campaign_start_date || '',
    campaign_end_date: campaign.campaign_end_date || '',
    usage_rights_notes: campaign.usage_rights_notes || '',
    brief: campaign.brief || '',
    admin_notes: campaign.admin_notes || '',
    status: campaign.status || 'Negotiating',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false); }

  async function save() {
    if (!form.campaign_name.trim() || !form.brand_name.trim()) {
      setError('Campaign name and brand name are required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('campaigns').update({
      campaign_name: form.campaign_name.trim(),
      brand_name: form.brand_name.trim(),
      agency_id: form.agency_id || null,
      creator_profile_id: form.creator_profile_id || null,
      contracted_rate: form.contracted_rate !== '' ? parseFloat(form.contracted_rate) : null,
      is_rush: form.is_rush,
      rush_premium: form.rush_premium !== '' ? parseFloat(form.rush_premium) : 0,
      deal_signed_date: form.deal_signed_date || null,
      campaign_start_date: form.campaign_start_date || null,
      campaign_end_date: form.campaign_end_date || null,
      usage_rights_notes: form.usage_rights_notes || null,
      brief: form.brief || null,
      admin_notes: form.admin_notes || null,
      status: form.status,
    }).eq('id', campaign.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    onUpdated();
  }

  return (
    <div>
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Campaign Name *</label>
          <input className="form-input" value={form.campaign_name} onChange={e => setF('campaign_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Brand Name *</label>
          <input className="form-input" value={form.brand_name} onChange={e => setF('brand_name', e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Creator</label>
          <select className="form-select" value={form.creator_profile_id} onChange={e => setF('creator_profile_id', e.target.value)}>
            <option value="">Select creator...</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Agency / Label</label>
          <select className="form-select" value={form.agency_id} onChange={e => setF('agency_id', e.target.value)}>
            <option value="">No agency</option>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => setF('status', e.target.value)}>
            {CAMPAIGN_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Deal Signed</label>
          <input className="form-input" type="date" value={form.deal_signed_date} onChange={e => setF('deal_signed_date', e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Contracted Rate ($)</label>
          <input className="form-input" type="number" value={form.contracted_rate} onChange={e => setF('contracted_rate', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Campaign Start</label>
          <input className="form-input" type="date" value={form.campaign_start_date} onChange={e => setF('campaign_start_date', e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Campaign End</label>
          <input className="form-input" type="date" value={form.campaign_end_date} onChange={e => setF('campaign_end_date', e.target.value)} />
        </div>
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label className="checkbox-row" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={form.is_rush} onChange={e => setF('is_rush', e.target.checked)} />
            Rush deal
          </label>
        </div>
      </div>

      {form.is_rush && (
        <div className="form-group">
          <label className="form-label">Rush Premium ($)</label>
          <input className="form-input" type="number" value={form.rush_premium} onChange={e => setF('rush_premium', e.target.value)} />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Brief / Instructions</label>
        <textarea className="form-textarea" value={form.brief} onChange={e => setF('brief', e.target.value)} placeholder="Campaign brief, talking points, requirements..." />
      </div>

      <div className="form-group">
        <label className="form-label">Usage Rights Notes</label>
        <input className="form-input" value={form.usage_rights_notes} onChange={e => setF('usage_rights_notes', e.target.value)} placeholder="e.g. 6 months digital, no paid amplification..." />
      </div>

      <div className="form-group">
        <label className="form-label">Internal Notes</label>
        <textarea className="form-textarea" value={form.admin_notes} onChange={e => setF('admin_notes', e.target.value)} style={{ minHeight: 60 }} />
      </div>

      <div className="flex items-center gap-12">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Saved ✓</span>}
      </div>
    </div>
  );
}

// ============================================================
// Edit Campaign Modal (quick edit from header button)
// ============================================================
function EditCampaignModal({ campaign, agencies, creators, onClose, onSaved }) {
  const [form, setForm] = useState({
    campaign_name: campaign.campaign_name || '',
    brand_name: campaign.brand_name || '',
    agency_id: campaign.agency_id || '',
    creator_profile_id: campaign.creator_profile_id || '',
    contracted_rate: campaign.contracted_rate ?? '',
    is_rush: campaign.is_rush || false,
    rush_premium: campaign.rush_premium ?? '',
    deal_signed_date: campaign.deal_signed_date || '',
    campaign_start_date: campaign.campaign_start_date || '',
    campaign_end_date: campaign.campaign_end_date || '',
    usage_rights_notes: campaign.usage_rights_notes || '',
    brief: campaign.brief || '',
    admin_notes: campaign.admin_notes || '',
    status: campaign.status || 'Negotiating',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.campaign_name.trim() || !form.brand_name.trim()) {
      setError('Campaign name and brand name are required.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('campaigns').update({
      campaign_name: form.campaign_name.trim(),
      brand_name: form.brand_name.trim(),
      agency_id: form.agency_id || null,
      creator_profile_id: form.creator_profile_id || null,
      contracted_rate: form.contracted_rate !== '' ? parseFloat(form.contracted_rate) : null,
      is_rush: form.is_rush,
      rush_premium: form.rush_premium !== '' ? parseFloat(form.rush_premium) : 0,
      deal_signed_date: form.deal_signed_date || null,
      campaign_start_date: form.campaign_start_date || null,
      campaign_end_date: form.campaign_end_date || null,
      usage_rights_notes: form.usage_rights_notes || null,
      brief: form.brief || null,
      admin_notes: form.admin_notes || null,
      status: form.status,
    }).eq('id', campaign.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">EDIT CAMPAIGN</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input className="form-input" value={form.campaign_name} onChange={e => setF('campaign_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Brand Name *</label>
              <input className="form-input" value={form.brand_name} onChange={e => setF('brand_name', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Creator</label>
              <select className="form-select" value={form.creator_profile_id} onChange={e => setF('creator_profile_id', e.target.value)}>
                <option value="">Select creator...</option>
                {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Agency / Label</label>
              <select className="form-select" value={form.agency_id} onChange={e => setF('agency_id', e.target.value)}>
                <option value="">No agency</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Contracted Rate ($)</label>
              <input className="form-input" type="number" value={form.contracted_rate} onChange={e => setF('contracted_rate', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setF('status', e.target.value)}>
                {CAMPAIGN_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deal Signed</label>
              <input className="form-input" type="date" value={form.deal_signed_date} onChange={e => setF('deal_signed_date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Campaign Start</label>
              <input className="form-input" type="date" value={form.campaign_start_date} onChange={e => setF('campaign_start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Campaign End</label>
              <input className="form-input" type="date" value={form.campaign_end_date} onChange={e => setF('campaign_end_date', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_rush} onChange={e => setF('is_rush', e.target.checked)} />
              Rush deal
            </label>
          </div>
          {form.is_rush && (
            <div className="form-group">
              <label className="form-label">Rush Premium ($)</label>
              <input className="form-input" type="number" value={form.rush_premium} onChange={e => setF('rush_premium', e.target.value)} placeholder="0.00" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Brief / Instructions</label>
            <textarea className="form-textarea" value={form.brief} onChange={e => setF('brief', e.target.value)} placeholder="Campaign brief, talking points, requirements..." />
          </div>

          <div className="form-group">
            <label className="form-label">Usage Rights Notes</label>
            <input className="form-input" value={form.usage_rights_notes} onChange={e => setF('usage_rights_notes', e.target.value)} placeholder="e.g. 6 months digital, no paid amplification..." />
          </div>

          <div className="form-group">
            <label className="form-label">Internal Notes</label>
            <textarea className="form-textarea" value={form.admin_notes} onChange={e => setF('admin_notes', e.target.value)} style={{ minHeight: 60 }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

const DELIVERABLE_STATUSES = ['Not Started', 'Draft Submitted', 'Revisions Requested', 'Approved', 'Posted'];

function DeliverableTab({ campaign, platforms, deliverableTypes, onUpdated }) {
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [showAddRevision, setShowAddRevision] = useState(null);
  const [showMarkPosted, setShowMarkPosted] = useState(null);
  const [editingDeliverable, setEditingDeliverable] = useState(null);
  const [editingRevision, setEditingRevision] = useState(null);

  const fmtDate = (d) => d ? format(parseISO(d), 'MMM d, yyyy') : '—';

  const deliverables = campaign.campaign_deliverables || [];
  const allPosted = deliverables.length > 0 && deliverables.every(d => d.draft_status === 'Posted');
  const postedCount = deliverables.filter(d => d.draft_status === 'Posted').length;

  async function deleteDeliverable(d) {
    if (!window.confirm(`Delete this ${d.platform?.name || 'platform'} deliverable? This will also delete all its revision rounds. This cannot be undone.`)) return;
    await supabase.from('campaign_deliverables').delete().eq('id', d.id);
    onUpdated();
  }

  async function deleteRevision(r) {
    if (!window.confirm(`Delete Round ${r.round_number}? This cannot be undone.`)) return;
    await supabase.from('revision_rounds').delete().eq('id', r.id);
    onUpdated();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-12">
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
          {postedCount}/{deliverables.length} Posted
          {deliverables.length > 0 && !allPosted && (
            <span style={{ color: 'var(--orange)', marginLeft: 8 }}>· Campaign cannot be Completed until all are posted</span>
          )}
          {allPosted && deliverables.length > 0 && (
            <span style={{ color: 'var(--green)', marginLeft: 8 }}>· All posted ✓</span>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddDeliverable(true)}>+ Add Platform</button>
      </div>

      {deliverables.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">◻</div>
          <div className="empty-state-title">No platforms yet</div>
          <div className="empty-state-text">Add platforms covered under this deal</div>
        </div>
      )}

      {deliverables.map(d => (
        <div key={d.id} className="deliverable-card">
          <div className="deliverable-card-header">
            <div>
              <span className="deliverable-platform">{d.platform?.name || 'Unknown Platform'}</span>
              {d.deliverable_type && <span className="text-muted text-sm" style={{ marginLeft: 8 }}>· {d.deliverable_type.name}</span>}
              {d.quantity > 1 && <span className="text-muted text-sm"> × {d.quantity}</span>}
            </div>
            <div className="flex items-center gap-8">
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setEditingDeliverable(d)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--red, #e74c3c)' }} onClick={() => deleteDeliverable(d)}>Delete</button>
              <Badge status={d.draft_status} />
            </div>
          </div>

          {d.deliverable_details && (
            <div className="text-muted text-sm mb-8">{d.deliverable_details}</div>
          )}

          {/* TikTok video preview */}
          {d.cover_image_url && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <a href={d.post_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ flexShrink: 0, display: 'block', width: 72, height: 96, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={d.cover_image_url} alt="video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
              <div style={{ flex: 1, minWidth: 0 }}>
                {d.video_title && (
                  <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginBottom: 4, color: 'var(--text)', wordBreak: 'break-word' }}>
                    {d.video_title}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {d.views != null && <span>👁 {Number(d.views).toLocaleString()}</span>}
                  {d.likes != null && <span>♥ {Number(d.likes).toLocaleString()}</span>}
                  {d.comments != null && <span>💬 {Number(d.comments).toLocaleString()}</span>}
                  {d.shares != null && <span>↗ {Number(d.shares).toLocaleString()}</span>}
                  {d.engagement_rate != null && <span style={{ color: 'var(--orange)' }}>{d.engagement_rate}% ER</span>}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-16 mb-12" style={{ fontSize: 12 }}>
            <div><span className="text-muted">Due: </span><span>{fmtDate(d.contracted_post_date)}</span></div>
            {d.actual_post_date && (
              <div><span className="text-muted">Posted: </span><span style={{ color: 'var(--green)' }}>{fmtDate(d.actual_post_date)}</span></div>
            )}
            {d.post_url && (
              <a href={d.post_url} target="_blank" rel="noreferrer" className="link text-sm" onClick={e => e.stopPropagation()}>View Post ↗</a>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="detail-section-title" style={{ marginBottom: 8 }}>REVISION ROUNDS</div>
            {(!d.revision_rounds || d.revision_rounds.length === 0) && (
              <div className="text-muted text-sm">No drafts submitted yet.</div>
            )}
            {d.revision_rounds?.sort((a, b) => a.round_number - b.round_number).map(r => (
              <div key={r.id} className="revision-round">
                <div className="revision-round-header">
                  <span className="round-number">Round {r.round_number}</span>
                  <div className="flex items-center gap-8">
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => setEditingRevision({ ...r, deliverable_id: d.id })}
                    >Edit</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '2px 8px', color: 'var(--red, #e74c3c)' }}
                      onClick={() => deleteRevision(r)}
                    >Delete</button>
                    <Badge status={r.agency_decision} />
                  </div>
                </div>
                {r.submitted_at && <div className="text-sm text-muted">Submitted: {fmtDate(r.submitted_at?.split('T')[0])}</div>}
                {r.draft_url && <a href={r.draft_url} target="_blank" rel="noreferrer" className="link text-sm">View Draft ↗</a>}
                {r.draft_notes && <div className="text-sm mt-4">{r.draft_notes}</div>}
                {r.agency_feedback && (
                  <div className="mt-8" style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: 4, fontSize: 12 }}>
                    <span className="text-muted">Agency feedback: </span>{r.agency_feedback}
                  </div>
                )}
                {r.agency_response_date && <div className="text-sm text-muted mt-4">Response: {fmtDate(r.agency_response_date)}</div>}
              </div>
            ))}
          </div>

          <div className="flex gap-8">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddRevision(d)}>+ Add Round</button>
            {d.draft_status !== 'Posted' && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMarkPosted(d)}>Mark Posted</button>
            )}
          </div>
        </div>
      ))}

      {showAddDeliverable && (
        <AddDeliverableModal
          campaignId={campaign.id}
          platforms={platforms}
          deliverableTypes={deliverableTypes}
          onClose={() => setShowAddDeliverable(false)}
          onSaved={() => { setShowAddDeliverable(false); onUpdated(); }}
        />
      )}

      {showAddRevision && (
        <AddRevisionModal
          deliverable={showAddRevision}
          onClose={() => setShowAddRevision(null)}
          onSaved={() => { setShowAddRevision(null); onUpdated(); }}
          isAdmin={true}
        />
      )}

      {showMarkPosted && (
        <MarkPostedModal
          deliverable={showMarkPosted}
          onClose={() => setShowMarkPosted(null)}
          onSaved={() => { setShowMarkPosted(null); onUpdated(); }}
        />
      )}

      {editingDeliverable && (
        <EditDeliverableModal
          deliverable={editingDeliverable}
          platforms={platforms}
          deliverableTypes={deliverableTypes}
          onClose={() => setEditingDeliverable(null)}
          onSaved={() => { setEditingDeliverable(null); onUpdated(); }}
        />
      )}

      {editingRevision && (
        <EditRevisionModal
          revision={editingRevision}
          onClose={() => setEditingRevision(null)}
          onSaved={() => { setEditingRevision(null); onUpdated(); }}
        />
      )}
    </div>
  );
}

function EditRevisionModal({ revision, onClose, onSaved }) {
  const [form, setForm] = useState({
    round_number: revision.round_number || 1,
    submitted_at: revision.submitted_at ? revision.submitted_at.split('T')[0] : '',
    draft_url: revision.draft_url || '',
    draft_notes: revision.draft_notes || '',
    agency_decision: revision.agency_decision || 'Pending',
    agency_feedback: revision.agency_feedback || '',
    agency_response_date: revision.agency_response_date || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('revision_rounds').update({
      round_number: parseInt(form.round_number) || revision.round_number,
      submitted_at: form.submitted_at ? new Date(form.submitted_at).toISOString() : null,
      draft_url: form.draft_url || null,
      draft_notes: form.draft_notes || null,
      agency_decision: form.agency_decision,
      agency_feedback: form.agency_feedback || null,
      agency_response_date: form.agency_response_date || null,
    }).eq('id', revision.id);

    // Sync deliverable draft_status to latest round's decision
    const statusMap = { 'Pending': 'Draft Submitted', 'Approved': 'Approved', 'Revisions Requested': 'Revisions Requested' };
    await supabase.from('campaign_deliverables').update({
      draft_status: statusMap[form.agency_decision] || 'Draft Submitted',
    }).eq('id', revision.deliverable_id);

    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>EDIT ROUND {revision.round_number}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Round #</label>
              <input className="form-input" type="number" min={1} value={form.round_number} onChange={e => setForm(f => ({ ...f, round_number: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Submitted Date</label>
              <input className="form-input" type="date" value={form.submitted_at} onChange={e => setForm(f => ({ ...f, submitted_at: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Draft URL</label>
            <input className="form-input" value={form.draft_url} onChange={e => setForm(f => ({ ...f, draft_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.draft_notes} onChange={e => setForm(f => ({ ...f, draft_notes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Agency Decision</label>
            <select className="form-select" value={form.agency_decision} onChange={e => setForm(f => ({ ...f, agency_decision: e.target.value }))}>
              <option>Pending</option>
              <option>Approved</option>
              <option>Revisions Requested</option>
            </select>
          </div>
          {form.agency_decision !== 'Pending' && (
            <>
              <div className="form-group">
                <label className="form-label">Agency Response Date</label>
                <input className="form-input" type="date" value={form.agency_response_date} onChange={e => setForm(f => ({ ...f, agency_response_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Agency Feedback</label>
                <textarea className="form-textarea" value={form.agency_feedback} onChange={e => setForm(f => ({ ...f, agency_feedback: e.target.value }))} style={{ minHeight: 60 }} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

function EditDeliverableModal({ deliverable, platforms, deliverableTypes, onClose, onSaved }) {
  const [form, setForm] = useState({
    platform_id: deliverable.platform_id || '',
    deliverable_type_id: deliverable.deliverable_type_id || '',
    deliverable_details: deliverable.deliverable_details || '',
    quantity: deliverable.quantity || 1,
    contracted_post_date: deliverable.contracted_post_date || '',
    actual_post_date: deliverable.actual_post_date || '',
    post_url: deliverable.post_url || '',
    draft_status: deliverable.draft_status || 'Not Started',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const update = {
      platform_id: form.platform_id || null,
      deliverable_type_id: form.deliverable_type_id || null,
      deliverable_details: form.deliverable_details || null,
      quantity: parseInt(form.quantity) || 1,
      contracted_post_date: form.contracted_post_date || null,
      actual_post_date: form.actual_post_date || null,
      post_url: form.post_url || null,
      draft_status: form.draft_status,
    };
    // If marking posted and no posted_at yet, set it
    if (form.draft_status === 'Posted' && !deliverable.posted_at) {
      update.posted_at = new Date().toISOString();
    }
    await supabase.from('campaign_deliverables').update(update).eq('id', deliverable.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>EDIT DELIVERABLE</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Platform</label>
              <select className="form-select" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))}>
                <option value="">Select...</option>
                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.deliverable_type_id} onChange={e => setForm(f => ({ ...f, deliverable_type_id: e.target.value }))}>
                <option value="">Select...</option>
                {deliverableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.draft_status} onChange={e => setForm(f => ({ ...f, draft_status: e.target.value }))}>
                {DELIVERABLE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Details / Instructions</label>
            <input className="form-input" value={form.deliverable_details} onChange={e => setForm(f => ({ ...f, deliverable_details: e.target.value }))} placeholder="Specific instructions for this deliverable..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contracted Post Date</label>
              <input className="form-input" type="date" value={form.contracted_post_date} onChange={e => setForm(f => ({ ...f, contracted_post_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Actual Post Date</label>
              <input className="form-input" type="date" value={form.actual_post_date} onChange={e => setForm(f => ({ ...f, actual_post_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Post URL</label>
            <input className="form-input" value={form.post_url} onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))} placeholder="https://www.tiktok.com/..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceTab({ campaign, onUpdated }) {
  const inv = campaign.invoices?.[0];
  const fmtDate = (d) => d ? format(parseISO(d), 'MMM d, yyyy') : '—';
  const [form, setForm] = useState({
    invoice_number: inv?.invoice_number || '',
    invoice_date: inv?.invoice_date || '',
    invoice_amount: inv?.invoice_amount || campaign.contracted_rate || '',
    payment_status: inv?.payment_status || 'Not Invoiced',
    payment_received_date: inv?.payment_received_date || '',
    payment_method: inv?.payment_method || '',
    payment_notes: inv?.payment_notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    if (inv) {
      await supabase.from('invoices').update({
        ...form,
        invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
      }).eq('id', inv.id);
    } else {
      await supabase.from('invoices').insert({
        campaign_id: campaign.id,
        ...form,
        invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
      });
    }
    setSaving(false);
    onUpdated();
  }

  return (
    <div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Invoice #</label>
          <input className="form-input" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-001" />
        </div>
        <div className="form-group">
          <label className="form-label">Invoice Date</label>
          <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Invoice Amount ($)</label>
          <input className="form-input" type="number" value={form.invoice_amount} onChange={e => setForm(f => ({ ...f, invoice_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Status</label>
          <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Payment Received Date</label>
          <input className="form-input" type="date" value={form.payment_received_date} onChange={e => setForm(f => ({ ...f, payment_received_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <input className="form-input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="PayPal, Wire, Check..." />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Payment Notes</label>
        <textarea className="form-textarea" value={form.payment_notes} onChange={e => setForm(f => ({ ...f, payment_notes: e.target.value }))} style={{ minHeight: 60 }} />
      </div>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Invoice'}</button>
    </div>
  );
}

// ============================================================
// Sub-modals
// ============================================================
function QuickPickModal({ title, options, onPick, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>{title}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(o => (
            <button key={o} className="btn btn-secondary w-full" style={{ justifyContent: 'flex-start' }} onClick={() => onPick(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AddDeliverableModal({ campaignId, platforms, deliverableTypes, onClose, onSaved }) {
  const [form, setForm] = useState({ platform_id: '', deliverable_type_id: '', deliverable_details: '', quantity: 1, contracted_post_date: '' });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from('campaign_deliverables').insert({
      campaign_id: campaignId,
      platform_id: form.platform_id || null,
      deliverable_type_id: form.deliverable_type_id || null,
      deliverable_details: form.deliverable_details || null,
      quantity: form.quantity || 1,
      contracted_post_date: form.contracted_post_date || null,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>ADD PLATFORM</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Platform</label>
              <select className="form-select" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))}>
                <option value="">Select...</option>
                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.deliverable_type_id} onChange={e => setForm(f => ({ ...f, deliverable_type_id: e.target.value }))}>
                <option value="">Select...</option>
                {deliverableTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contracted Post Date</label>
              <input className="form-input" type="date" value={form.contracted_post_date} onChange={e => setForm(f => ({ ...f, contracted_post_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Details</label>
            <input className="form-input" value={form.deliverable_details} onChange={e => setForm(f => ({ ...f, deliverable_details: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}

export function AddRevisionModal({ deliverable, onClose, onSaved, isAdmin = false }) {
  const nextRound = (deliverable.revision_rounds?.length || 0) + 1;
  const [form, setForm] = useState({
    draft_url: '', draft_notes: '', submitted_at: new Date().toISOString().split('T')[0],
    agency_decision: 'Pending', agency_feedback: '', agency_response_date: '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('revision_rounds').insert({
      deliverable_id: deliverable.id,
      round_number: nextRound,
      submitted_by: user?.id || null,
      submitted_at: form.submitted_at ? new Date(form.submitted_at).toISOString() : new Date().toISOString(),
      draft_url: form.draft_url || null,
      draft_notes: form.draft_notes || null,
      agency_decision: form.agency_decision,
      agency_feedback: form.agency_feedback || null,
      agency_response_date: form.agency_response_date || null,
    });
    // Update deliverable draft status
    const statusMap = { 'Pending': 'Draft Submitted', 'Approved': 'Approved', 'Revisions Requested': 'Revisions Requested' };
    await supabase.from('campaign_deliverables').update({ draft_status: statusMap[form.agency_decision] || 'Draft Submitted' }).eq('id', deliverable.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>ROUND {nextRound} DRAFT</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Draft Submitted Date</label>
            <input className="form-input" type="date" value={form.submitted_at} onChange={e => setForm(f => ({ ...f, submitted_at: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Draft URL (optional)</label>
            <input className="form-input" value={form.draft_url} onChange={e => setForm(f => ({ ...f, draft_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.draft_notes} onChange={e => setForm(f => ({ ...f, draft_notes: e.target.value }))} style={{ minHeight: 60 }} />
          </div>
          {isAdmin && (
            <>
              <div className="form-group">
                <label className="form-label">Agency Decision</label>
                <select className="form-select" value={form.agency_decision} onChange={e => setForm(f => ({ ...f, agency_decision: e.target.value }))}>
                  <option>Pending</option>
                  <option>Approved</option>
                  <option>Revisions Requested</option>
                </select>
              </div>
              {form.agency_decision !== 'Pending' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Agency Response Date</label>
                    <input className="form-input" type="date" value={form.agency_response_date} onChange={e => setForm(f => ({ ...f, agency_response_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Agency Feedback</label>
                    <textarea className="form-textarea" value={form.agency_feedback} onChange={e => setForm(f => ({ ...f, agency_feedback: e.target.value }))} style={{ minHeight: 60 }} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Submit'}</button>
        </div>
      </div>
    </div>
  );
}

export function MarkPostedModal({ deliverable, onClose, onSaved }) {
  const [postUrl, setPostUrl] = useState(deliverable.post_url || '');
  const [postDate, setPostDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('campaign_deliverables').update({
      post_url: postUrl || null,
      actual_post_date: postDate || null,
      draft_status: 'Posted',
      posted_by: user?.id || null,
      posted_at: new Date().toISOString(),
    }).eq('id', deliverable.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>MARK AS POSTED</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Post URL</label>
            <input className="form-input" value={postUrl} onChange={e => setPostUrl(e.target.value)} placeholder="https://www.tiktok.com/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Actual Post Date</label>
            <input className="form-input" type="date" value={postDate} onChange={e => setPostDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Confirm Posted'}</button>
        </div>
      </div>
    </div>
  );
}
