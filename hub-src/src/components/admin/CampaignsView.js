import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import Comments from '../shared/Comments';
import { format, parseISO } from 'date-fns';
import { fmtDate as safeFmtDate, isValidDateString, isValidNumber, isValidUrl } from '../../utils/format';

const CAMPAIGN_STATUSES = ['Negotiating', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
const PAYMENT_STATUSES = ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed', 'In Kind'];

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

// Lightweight markdown → HTML (no external dependency)
function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Unordered lists
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Paragraphs: double newline → paragraph break
    .replace(/\n\n/g, '</p><p>')
    // Single newline → <br>
    .replace(/\n/g, '<br/>');
  // Wrap in paragraph
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs and wrap <li> in <ul>
  html = html.replace(/<p>(<li>.*?<\/li>(<br\/>)?)+<\/p>/gs, m =>
    '<ul>' + m.replace(/<p>|<\/p>|<br\/>/g, '') + '</ul>'
  );
  return html;
}

// Full-screen markdown editor modal
function MarkdownEditorModal({ value, onChange, onClose }) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState(false);

  function save() { onChange(draft); onClose(); }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 1100, height: '90vh',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1 }}>BRIEF / INSTRUCTIONS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreview(p => !p)}>
              {preview ? 'Edit' : 'Preview'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Editor */}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              flex: preview ? '0 0 50%' : 1,
              resize: 'none', border: 'none', outline: 'none',
              background: '#0d0d0d', color: 'var(--text)',
              fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7,
              padding: 20, borderRight: preview ? '1px solid var(--border)' : 'none',
            }}
            placeholder="Write the campaign brief in Markdown...&#10;&#10;Use **bold**, *italic*, # headers, - lists, [links](url)"
          />
          {/* Preview */}
          {preview && (
            <div
              style={{ flex: '0 0 50%', padding: 20, overflowY: 'auto', fontSize: 13, lineHeight: 1.7 }}
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) || '<p style="color:var(--text-muted)">Nothing to preview yet.</p>' }}
            />
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
          Markdown supported: **bold** · *italic* · # Heading · - list item · [link](url) · `code`
        </div>
      </div>
    </div>
  );
}

// Brief field with expand button + inline markdown preview
function BriefField({ value, onChange, placeholder }) {
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label className="form-label" style={{ marginBottom: 0 }}>Brief / Instructions</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => setShowPreview(p => !p)}>
              {showPreview ? 'Hide preview' : 'Preview'}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '2px 10px' }}
            onClick={() => setShowEditor(true)}>
            ⤢ Expand
          </button>
        </div>
      </div>
      <textarea
        className="form-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Campaign brief, talking points, requirements... (Markdown supported)'}
        style={{ minHeight: 80, fontFamily: 'monospace', fontSize: 12 }}
      />
      {showPreview && value && (
        <div
          className="markdown-preview"
          style={{ marginTop: 8, padding: '12px 14px', background: '#0d0d0d', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      )}
      {showEditor && (
        <MarkdownEditorModal
          value={value}
          onChange={onChange}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [creators, setCreators] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [deliverableTypes, setDeliverableTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [detailTab, setDetailTab] = useState('deliverables');

  // Sorting
  const [sortCol, setSortCol] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Column filters
  const [colFilters, setColFilters] = useState({ agency: '', platform: '', payment: '' });
  const [openColFilter, setOpenColFilter] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [c, a, cr, p, dt, inv] = await Promise.all([
      supabase.from('campaigns').select(`
        *, agency:agencies(name), creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
        campaign_deliverables:campaign_deliverables_with_stats(*, platform:platforms(name), deliverable_type:deliverable_types(name),
          revision_rounds(* , submitted_by_profile:profiles!revision_rounds_submitted_by_fkey(full_name)))
      `).order('created_at', { ascending: false }),
      supabase.from('agencies').select('*').eq('is_active', true),
      supabase.from('profiles').select('*').eq('role', 'creator'),
      supabase.from('platforms').select('*').eq('is_active', true),
      supabase.from('deliverable_types').select('*').eq('is_active', true),
      supabase.from('invoices').select('*'),
    ]);
    // Merge invoices onto campaigns manually — avoids Supabase join issues through views
    const invoiceMap = {};
    for (const i of (inv.data || [])) {
      if (!invoiceMap[i.campaign_id]) invoiceMap[i.campaign_id] = [];
      invoiceMap[i.campaign_id].push(i);
    }
    const merged = (c.data || []).map(camp => ({
      ...camp,
      invoices: invoiceMap[camp.id] || [],
    }));
    setCampaigns(merged);
    setAgencies(a.data || []);
    setCreators(cr.data || []);
    setPlatforms(p.data || []);
    setDeliverableTypes(dt.data || []);
    setLoading(false);
    // Keep the detail panel in sync — replace selectedCampaign with the fresh version
    setSelectedCampaign(prev => {
      if (!prev) return null;
      return merged.find(camp => camp.id === prev.id) || prev;
    });
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>;
    return <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  // Derive unique values for column filters
  const agencyOptions = [...new Set(campaigns.map(c => c.agency?.name).filter(Boolean))].sort();
  const platformOptions = [...new Set(campaigns.flatMap(c => c.campaign_deliverables?.map(d => d.platform?.name) || []).filter(Boolean))].sort();
  const paymentOptions = [...new Set(campaigns.map(c => c.invoices?.[0]?.payment_status).filter(Boolean))].sort();

  // Derive months from campaign start dates
  const months = [...new Set(campaigns.map(c => {
    const d = c.campaign_start_date || c.created_at;
    return d ? d.slice(0, 7) : null;
  }).filter(Boolean))].sort().reverse();

  // Filter + sort pipeline
  let displayCampaigns = campaigns.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (creatorFilter !== 'all' && c.creator_profile_id !== creatorFilter) return false;
    if (colFilters.agency && c.agency?.name !== colFilters.agency) return false;
    if (colFilters.platform && !c.campaign_deliverables?.some(d => d.platform?.name === colFilters.platform)) return false;
    if (colFilters.payment) {
      const ps = c.invoices?.[0]?.payment_status || 'Not Invoiced';
      if (ps !== colFilters.payment) return false;
    }
    if (monthFilter !== 'all') {
      const d = c.campaign_start_date || c.created_at || '';
      if (!d.startsWith(monthFilter)) return false;
    }
    return true;
  });

  displayCampaigns = [...displayCampaigns].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'campaign_name': av = a.campaign_name?.toLowerCase(); bv = b.campaign_name?.toLowerCase(); break;
      case 'creator': av = (a.creator?.creator_name || a.creator?.full_name || '').toLowerCase(); bv = (b.creator?.creator_name || b.creator?.full_name || '').toLowerCase(); break;
      case 'agency': av = (a.agency?.name || '').toLowerCase(); bv = (b.agency?.name || '').toLowerCase(); break;
      case 'post_date': {
        const getMin = c => c.campaign_deliverables?.reduce((min, d) => (!d.contracted_post_date ? min : (!min || d.contracted_post_date < min ? d.contracted_post_date : min)), null);
        av = getMin(a) || ''; bv = getMin(b) || ''; break;
      }
      case 'rate': av = Number(a.contracted_rate) || 0; bv = Number(b.contracted_rate) || 0; break;
      case 'status': av = a.status; bv = b.status; break;
      case 'payment': av = a.invoices?.[0]?.payment_status || ''; bv = b.invoices?.[0]?.payment_status || ''; break;
      default: av = a.created_at; bv = b.created_at;
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  async function openDetail(c) { setSelectedCampaign(c); setDetailTab('deliverables'); }
  function closeDetail() { setSelectedCampaign(null); }

  const fmtDate = safeFmtDate;
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

  // Close column filter dropdowns on outside click
  useEffect(() => {
    if (!openColFilter) return;
    const handler = () => setOpenColFilter(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openColFilter]);

  function ColFilterBtn({ col, options, label }) {
    const active = !!colFilters[col];
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          className={`btn btn-ghost btn-sm`}
          style={{ fontSize: 10, padding: '1px 4px', marginLeft: 4, color: active ? 'var(--accent)' : 'var(--text-muted)', border: active ? '1px solid var(--accent)' : 'none' }}
          onClick={e => { e.stopPropagation(); setOpenColFilter(openColFilter === col ? null : col); }}
        >▾</button>
        {openColFilter === col && (
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, minWidth: 140, padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
          }}>
            <div
              style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: active ? 'var(--text)' : 'var(--accent)' }}
              onClick={() => { setColFilters(f => ({ ...f, [col]: '' })); setOpenColFilter(null); }}
            >All {label}</div>
            {options.map(o => (
              <div key={o}
                style={{ padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: colFilters[col] === o ? 'var(--accent)' : 'var(--text)', background: colFilters[col] === o ? 'rgba(255,92,0,0.08)' : 'transparent' }}
                onClick={() => { setColFilters(f => ({ ...f, [col]: o })); setOpenColFilter(null); }}
              >{o}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CAMPAIGNS</div>
          <div className="page-subtitle">{displayCampaigns.length} of {campaigns.length} deals</div>
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
        {(colFilters.agency || colFilters.platform || colFilters.payment) && (
          <button className="filter-chip" style={{ color: 'var(--accent)', marginLeft: 8 }}
            onClick={() => setColFilters({ agency: '', platform: '', payment: '' })}>
            Clear column filters ✕
          </button>
        )}
        {months.length > 0 && (
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, marginLeft: 8 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>)}
          </select>
        )}
      </div>

      {displayCampaigns.length === 0 ? (
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
                <th onClick={() => toggleSort('campaign_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>Campaign<SortIcon col="campaign_name" /></th>
                <th onClick={() => toggleSort('creator')} style={{ cursor: 'pointer', userSelect: 'none' }}>Creator<SortIcon col="creator" /></th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <span onClick={() => toggleSort('agency')}>Agency<SortIcon col="agency" /></span>
                  <ColFilterBtn col="agency" options={agencyOptions} label="Agencies" />
                </th>
                <th>
                  Platforms
                  <ColFilterBtn col="platform" options={platformOptions} label="Platforms" />
                </th>
                <th onClick={() => toggleSort('post_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>Post Date<SortIcon col="post_date" /></th>
                <th onClick={() => toggleSort('rate')} style={{ cursor: 'pointer', userSelect: 'none' }}>Rate<SortIcon col="rate" /></th>
                <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Status<SortIcon col="status" /></th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <span onClick={() => toggleSort('payment')}>Payment<SortIcon col="payment" /></span>
                  <ColFilterBtn col="payment" options={paymentOptions} label="Payment" />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayCampaigns.map(c => {
                const earliestPost = c.campaign_deliverables?.reduce((min, d) => {
                  if (!d.contracted_post_date) return min;
                  return !min || d.contracted_post_date < min ? d.contracted_post_date : min;
                }, null);
                const paymentStatus = c.invoices?.[0]?.payment_status;
                const inKindValue = c.invoices?.[0]?.in_kind_value;
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
                        {(() => {
                          const counts = {};
                          (c.campaign_deliverables || []).forEach(d => {
                            const name = d.platform?.name || '?';
                            counts[name] = (counts[name] || 0) + 1;
                          });
                          const entries = Object.entries(counts);
                          if (entries.length === 0) return <span className="text-muted">—</span>;
                          return entries.map(([name, count]) => (
                            <span key={name} className="badge badge-confirmed">
                              {name}{count > 1 ? ` ×${count}` : ''}
                            </span>
                          ));
                        })()}
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
                      {paymentStatus
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Badge status={paymentStatus} />
                            {paymentStatus === 'In Kind' && inKindValue
                              ? <span style={{ fontSize: 10, color: 'var(--purple, #9b59ff)' }}>{fmtMoney(inKindValue)} value</span>
                              : null}
                          </div>
                        : <span className="text-muted text-xs">No invoice</span>
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
    const errors = [];
    if (!form.campaign_name.trim() || !form.brand_name.trim()) errors.push('Campaign name and brand name are required.');
    if (form.deal_signed_date && !isValidDateString(form.deal_signed_date)) errors.push('Deal signed date is not a valid date.');
    if (form.campaign_start_date && !isValidDateString(form.campaign_start_date)) errors.push('Campaign start date is not a valid date.');
    if (form.campaign_end_date && !isValidDateString(form.campaign_end_date)) errors.push('Campaign end date is not a valid date.');
    if (form.contracted_rate && !isValidNumber(form.contracted_rate)) errors.push('Contracted rate must be a number.');
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true);
    setError('');

    const { data: camp, error: campErr } = await supabase.from('campaigns').insert({
      ...form,
      contracted_rate: form.contracted_rate ? parseFloat(form.contracted_rate) : null,
      rush_premium: form.rush_premium ? parseFloat(form.rush_premium) : 0,
      agency_id: form.agency_id || null,
      creator_profile_id: form.creator_profile_id || null,
      deal_signed_date: form.deal_signed_date || null,
      campaign_start_date: form.campaign_start_date || null,
      campaign_end_date: form.campaign_end_date || null,
    }).select().single();

    if (campErr) { setError(campErr.message); setSaving(false); return; }

    if (deliverables.length > 0) {
      // Expand quantity > 1 into individual rows so each post is independently tracked
      const rows = [];
      deliverables.forEach(d => {
        const qty = parseInt(d.quantity) || 1;
        for (let i = 0; i < qty; i++) {
          rows.push({
            campaign_id: camp.id,
            platform_id: d.platform_id || null,
            deliverable_type_id: d.deliverable_type_id || null,
            deliverable_details: d.deliverable_details || null,
            quantity: 1,
            contracted_post_date: d.contracted_post_date || null,
          });
        }
      });
      await supabase.from('campaign_deliverables').insert(rows);
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
            <BriefField value={form.brief} onChange={v => setF('brief', v)} />
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

  const fmtDate = safeFmtDate;
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

  async function updateCampaignStatus(status) {
    if (status === 'Completed') {
      const deliverables = c.campaign_deliverables || [];
      const totalSlots = deliverables.reduce((sum, d) => sum + (d.quantity || 1), 0);
      const postedSlots = deliverables.filter(d => d.draft_status === 'Posted').reduce((sum, d) => sum + (d.quantity || 1), 0);
      if (totalSlots === 0 || postedSlots < totalSlots) {
        const remaining = totalSlots - postedSlots;
        alert(`Cannot mark as Completed — ${remaining} post${remaining !== 1 ? 's' : ''} still not Posted.`);
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
        {['deliverables', 'details', 'invoice', 'files', 'comments'].map(t => (
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

        {tab === 'files' && (
          <FilesTab campaign={c} />
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
    const errors = [];
    if (!form.campaign_name.trim() || !form.brand_name.trim()) errors.push('Campaign name and brand name are required.');
    if (form.deal_signed_date && !isValidDateString(form.deal_signed_date)) errors.push('Deal signed date is not a valid date.');
    if (form.campaign_start_date && !isValidDateString(form.campaign_start_date)) errors.push('Campaign start is not a valid date.');
    if (form.campaign_end_date && !isValidDateString(form.campaign_end_date)) errors.push('Campaign end is not a valid date.');
    if (form.contracted_rate !== '' && !isValidNumber(form.contracted_rate)) errors.push('Contracted rate must be a number.');
    if (form.rush_premium !== '' && !isValidNumber(form.rush_premium)) errors.push('Rush premium must be a number.');
    if (errors.length) { setError(errors.join(' ')); return; }
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
        <BriefField value={form.brief} onChange={v => setF('brief', v)} />
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
    const errors = [];
    if (!form.campaign_name.trim() || !form.brand_name.trim()) errors.push('Campaign name and brand name are required.');
    if (form.deal_signed_date && !isValidDateString(form.deal_signed_date)) errors.push('Deal signed date is not a valid date.');
    if (form.campaign_start_date && !isValidDateString(form.campaign_start_date)) errors.push('Campaign start is not a valid date.');
    if (form.campaign_end_date && !isValidDateString(form.campaign_end_date)) errors.push('Campaign end is not a valid date.');
    if (form.contracted_rate !== '' && !isValidNumber(form.contracted_rate)) errors.push('Contracted rate must be a number.');
    if (form.rush_premium !== '' && !isValidNumber(form.rush_premium)) errors.push('Rush premium must be a number.');
    if (errors.length) { setError(errors.join(' ')); return; }
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
            <BriefField value={form.brief} onChange={v => setF('brief', v)} />
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
  const [expanding, setExpanding] = useState(null);

  const fmtDate = safeFmtDate;

  const deliverables = campaign.campaign_deliverables || [];
  const totalSlots = deliverables.reduce((sum, d) => sum + (d.quantity || 1), 0);
  const postedSlots = deliverables.filter(d => d.draft_status === 'Posted').reduce((sum, d) => sum + (d.quantity || 1), 0);
  const allPosted = totalSlots > 0 && postedSlots === totalSlots;

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

  async function expandDeliverable(d) {
    if (!window.confirm(`Expand "Bundle × ${d.quantity}" into ${d.quantity} individually tracked posts? The original row will be replaced. This cannot be undone.`)) return;
    setExpanding(d.id);
    const rows = Array.from({ length: d.quantity }, (_, i) => ({
      campaign_id: d.campaign_id,
      platform_id: d.platform_id,
      deliverable_type_id: d.deliverable_type_id,
      deliverable_details: d.deliverable_details ? `${d.deliverable_details} (Post ${i + 1})` : `Post ${i + 1} of ${d.quantity}`,
      quantity: 1,
      contracted_post_date: d.contracted_post_date,
      draft_status: 'Not Started',
    }));
    await supabase.from('campaign_deliverables').insert(rows);
    await supabase.from('campaign_deliverables').delete().eq('id', d.id);
    setExpanding(null);
    onUpdated();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-12">
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
          {postedSlots}/{totalSlots} Posted
          {totalSlots > 0 && !allPosted && (
            <span style={{ color: 'var(--orange)', marginLeft: 8 }}>· Campaign cannot be Completed until all are posted</span>
          )}
          {allPosted && totalSlots > 0 && (
            <span style={{ color: 'var(--green)', marginLeft: 8 }}>· All posted ✓</span>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddDeliverable(true)}>+ Add Deliverable</button>
      </div>

      {deliverables.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">◻</div>
          <div className="empty-state-title">No deliverables yet</div>
          <div className="empty-state-text">Add platforms covered under this deal</div>
        </div>
      )}

      {deliverables.map(d => (
        <div key={d.id} className="deliverable-card">
          <div className="deliverable-card-header">
            <div>
              <span className="deliverable-platform">{d.platform?.name || 'Unknown Platform'}</span>
              {d.deliverable_type && <span className="text-muted text-sm" style={{ marginLeft: 8 }}>· {d.deliverable_type.name}</span>}
              {d.quantity > 1 && (
                <span className="text-muted text-sm" style={{ marginLeft: 6 }}>
                  × {d.quantity}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 10, padding: '1px 6px', marginLeft: 6, color: 'var(--orange)', border: '1px solid var(--orange)' }}
                    onClick={() => expandDeliverable(d)}
                    disabled={expanding === d.id}
                    title={`Split into ${d.quantity} individually tracked posts`}
                  >{expanding === d.id ? '...' : 'Expand'}</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-8">
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setEditingDeliverable(d)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--red, #e74c3c)' }} onClick={() => deleteDeliverable(d)}>Delete</button>
              <Badge status={d.draft_status} />
            </div>
          </div>

          {d.quantity > 1 && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginBottom: 8, padding: '4px 8px', background: 'rgba(255,92,0,0.08)', borderRadius: 4 }}>
              ⚠ Bundle of {d.quantity} posts tracked as one row — click <strong>Expand</strong> to split into {d.quantity} individually trackable posts.
            </div>
          )}

          {d.deliverable_details && (
            <div className="text-muted text-sm mb-8">{d.deliverable_details}</div>
          )}

          {d.music_url && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
              <span style={{ fontSize: 14 }}>🎵</span>
              <span className="text-muted">Music:</span>
              <span className="link" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); openPopup(d.music_url); }}>
                {d.music_url.length > 50 ? d.music_url.slice(0, 50) + '…' : d.music_url}
              </span>
            </div>
          )}

          {/* TikTok video preview */}
          {d.cover_image_url && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <div onClick={e => { e.stopPropagation(); openPopup(d.post_url); }}
                style={{ flexShrink: 0, display: 'block', width: 72, height: 96, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}>
                <img src={d.cover_image_url} alt="video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
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
              <span className="link text-sm" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); openPopup(d.post_url); }}>View Post ↗</span>
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
                {r.draft_url && <span className="link text-sm" style={{ cursor: "pointer" }} onClick={() => openPopup(r.draft_url)}>View Draft ↗</span>}
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

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddDeliverable(true)}>+ Add Platform</button>
      </div>

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
          campaign={campaign}
          onClose={() => setShowMarkPosted(null)}
          onSaved={() => { setShowMarkPosted(null); onUpdated(); }}
        />
      )}

      {editingDeliverable && (
        <EditDeliverableModal
          deliverable={editingDeliverable}
          campaign={campaign}
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
    const errors = [];
    if (form.submitted_at && !isValidDateString(form.submitted_at)) errors.push('Submitted date is not a valid date.');
    if (form.agency_response_date && !isValidDateString(form.agency_response_date)) errors.push('Agency response date is not a valid date.');
    if (form.draft_url && !isValidUrl(form.draft_url)) errors.push('Draft URL is not a valid URL.');
    if (errors.length) { alert(errors.join('\n')); return; }
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

// ============================================================
// Video Picker — loads available TikTok videos for a campaign's creator,
// filtered to the campaign date window, excluding already-assigned videos
// ============================================================
function VideoPickerSelect({ campaign, currentPostUrl, onSelect }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    setLoading(true);

    // 1. Find the creator's tiktok_username
    const creatorId = campaign.creator_profile_id;
    if (!creatorId) { setLoading(false); return; }

    const { data: acct } = await supabase
      .from('tiktok_accounts')
      .select('tiktok_username')
      .eq('profile_id', creatorId)
      .eq('is_active', true)
      .single();

    if (!acct?.tiktok_username) { setLoading(false); return; }

    // 2. Fetch all videos for this creator
    let query = supabase
      .from('tiktok_video_insights_view')
      .select('video_id, video_title, create_time, share_url')
      .eq('tiktok_username', acct.tiktok_username)
      .order('create_time', { ascending: false });

    // Filter to campaign date window if dates are set
    if (campaign.campaign_start_date) {
      query = query.gte('create_time', campaign.campaign_start_date);
    }
    if (campaign.campaign_end_date) {
      // Add one day so end date is inclusive
      const end = new Date(campaign.campaign_end_date);
      end.setDate(end.getDate() + 1);
      query = query.lte('create_time', end.toISOString().split('T')[0]);
    }

    const { data: allVideos } = await query;

    // 3. Get all post_urls already assigned to other deliverables (excluding this campaign's own deliverables with no URL)
    const { data: usedRows } = await supabase
      .from('campaign_deliverables')
      .select('post_url')
      .neq('campaign_id', campaign.id)
      .not('post_url', 'is', null);

    const usedUrls = new Set((usedRows || []).map(r => r.post_url));

    // 4. Filter out already-used videos (match by video_id in URL)
    const available = (allVideos || []).filter(v => {
      // Keep the currently selected video even if it's already "used" (it's this deliverable's own)
      if (currentPostUrl && currentPostUrl.includes(v.video_id)) return true;
      // Exclude if any used URL contains this video_id
      return ![...usedUrls].some(url => url && url.includes(v.video_id));
    });

    setVideos(available);
    setLoading(false);
  }

  const fmtDate = (d) => {
    if (!d) return '';
    try { return format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'MMM d'); }
    catch { return d; }
  };

  // Find current selection
  const currentVideoId = videos.find(v => currentPostUrl?.includes(v.video_id))?.video_id || '';

  function handleChange(e) {
    const videoId = e.target.value;
    if (!videoId) { onSelect('', ''); return; }
    const video = videos.find(v => v.video_id === videoId);
    if (!video) return;
    const url = video.share_url || `https://www.tiktok.com/video/${video.video_id}`;
    const postDate = video.create_time
      ? (video.create_time.includes('T') ? video.create_time.split('T')[0] : video.create_time)
      : '';
    onSelect(url, postDate);
  }

  if (loading) return <div className="text-muted text-sm" style={{ padding: '8px 0' }}>Loading videos...</div>;
  if (videos.length === 0) return (
    <div className="text-muted text-sm" style={{ padding: '8px 0' }}>
      No unassigned videos found within the campaign date window.
      {!campaign.campaign_start_date && !campaign.campaign_end_date && ' (No campaign dates set — showing all videos.)'}
    </div>
  );

  return (
    <select className="form-select" value={currentVideoId} onChange={handleChange}>
      <option value="">— Select a video —</option>
      {videos.map(v => (
        <option key={v.video_id} value={v.video_id}>
          {fmtDate(v.create_time)} · {v.video_title ? (v.video_title.length > 60 ? v.video_title.slice(0, 60) + '…' : v.video_title) : v.video_id}
        </option>
      ))}
    </select>
  );
}

function EditDeliverableModal({ deliverable, campaign, platforms, deliverableTypes, onClose, onSaved }) {
  const [form, setForm] = useState({
    platform_id: deliverable.platform_id || '',
    deliverable_type_id: deliverable.deliverable_type_id || '',
    deliverable_details: deliverable.deliverable_details || '',
    quantity: deliverable.quantity || 1,
    contracted_post_date: deliverable.contracted_post_date || '',
    actual_post_date: deliverable.actual_post_date || '',
    post_url: deliverable.post_url || '',
    draft_status: deliverable.draft_status || 'Not Started',
    music_url: deliverable.music_url || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const errors = [];
    if (form.contracted_post_date && !isValidDateString(form.contracted_post_date)) errors.push('Contracted post date is not a valid date.');
    if (form.actual_post_date && !isValidDateString(form.actual_post_date)) errors.push('Actual post date is not a valid date.');
    if (form.post_url && !isValidUrl(form.post_url)) errors.push('Post URL is not a valid URL.');
    if (form.music_url && !isValidUrl(form.music_url)) errors.push('Music URL is not a valid URL.');
    if (errors.length) { alert(errors.join('\n')); return; }
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
      music_url: form.music_url || null,
    };
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
            <label className="form-label">TikTok Post</label>
            <VideoPickerSelect
              campaign={campaign}
              currentPostUrl={form.post_url}
              onSelect={(url, postDate) => setForm(f => ({
                ...f,
                post_url: url,
                actual_post_date: postDate || f.actual_post_date,
                draft_status: url ? 'Posted' : f.draft_status,
              }))}
            />
            {form.post_url && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="link" style={{ cursor: "pointer" }} onClick={() => openPopup(form.post_url)}>View post ↗</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', color: 'var(--red, #e74c3c)' }}
                  onClick={() => setForm(f => ({ ...f, post_url: '', actual_post_date: '' }))}>Clear</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">
              Music / Sound URL <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>optional</span>
            </label>
            <input
              className="form-input"
              value={form.music_url}
              onChange={e => setForm(f => ({ ...f, music_url: e.target.value }))}
              placeholder="https://www.tiktok.com/music/..."
            />
            {form.music_url && (
              <div style={{ marginTop: 6, fontSize: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="link" style={{ cursor: 'pointer' }} onClick={() => openPopup(form.music_url)}>Open ↗</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', color: 'var(--red, #e74c3c)' }}
                  onClick={() => setForm(f => ({ ...f, music_url: '' }))}>Clear</button>
              </div>
            )}
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

// ============================================================
// File helpers
// ============================================================
function fileIcon(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼';
  if (type === 'application/pdf') return '📋';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('zip') || type.includes('rar')) return '🗜';
  return '📄';
}

function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function getDownloadUrl(bucket, path) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  return data?.signedUrl || null;
}

function InvoiceTab({ campaign, onUpdated }) {
  const inv = campaign.invoices?.[0];
  const fmtDate = safeFmtDate;
  const [form, setForm] = useState({
    invoice_number: inv?.invoice_number || '',
    invoice_date: inv?.invoice_date || '',
    invoice_amount: inv?.invoice_amount || campaign.contracted_rate || '',
    payment_status: inv?.payment_status || 'Not Invoiced',
    payment_received_date: inv?.payment_received_date || '',
    payment_method: inv?.payment_method || '',
    payment_notes: inv?.payment_notes || '',
    is_in_kind: inv?.is_in_kind || false,
    in_kind_value: inv?.in_kind_value || '',
    in_kind_description: inv?.in_kind_description || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState(inv?.receipt_path || null);
  const [receiptName, setReceiptName] = useState(inv?.receipt_name || null);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); setSaved(false); }

  async function save() {
    const errors = [];
    if (form.invoice_date && !isValidDateString(form.invoice_date)) errors.push('Invoice date is not a valid date.');
    if (form.payment_received_date && !isValidDateString(form.payment_received_date)) errors.push('Payment received date is not a valid date.');
    if (form.invoice_amount && !isValidNumber(form.invoice_amount)) errors.push('Invoice amount must be a number.');
    if (form.in_kind_value && !isValidNumber(form.in_kind_value)) errors.push('In-kind value must be a number.');
    if (errors.length) { setSaved(false); alert(errors.join('\n')); return; }
    setSaving(true);
    const payload = {
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
      payment_status: form.payment_status,
      payment_received_date: form.payment_received_date || null,
      payment_method: form.payment_method || null,
      payment_notes: form.payment_notes || null,
      is_in_kind: form.is_in_kind,
      in_kind_value: form.in_kind_value ? parseFloat(form.in_kind_value) : null,
      in_kind_description: form.in_kind_description || null,
    };
    if (inv) {
      await supabase.from('invoices').update(payload).eq('id', inv.id);
    } else {
      await supabase.from('invoices').insert({ campaign_id: campaign.id, ...payload });
    }
    setSaving(false);
    setSaved(true);
    onUpdated();
  }

  async function uploadReceipt(file) {
    if (!file) return;
    // Ensure invoice exists first
    let invoiceId = inv?.id;
    if (!invoiceId) {
      const { data: newInv } = await supabase.from('invoices').insert({
        campaign_id: campaign.id,
        payment_status: form.payment_status || 'Not Invoiced',
      }).select().single();
      invoiceId = newInv?.id;
      if (!invoiceId) return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `receipts/${invoiceId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('payment-receipts').upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from('invoices').update({ receipt_path: path, receipt_name: file.name }).eq('id', invoiceId);
      setReceiptPath(path);
      setReceiptName(file.name);
      onUpdated();
    }
    setUploading(false);
  }

  async function viewReceipt() {
    const url = await getDownloadUrl('payment-receipts', receiptPath);
    if (url) openPopup(url);
  }

  async function downloadReceipt() {
    const url = await getDownloadUrl('payment-receipts', receiptPath);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = receiptName || 'receipt';
    a.click();
  }

  async function deleteReceipt() {
    if (!window.confirm('Remove this receipt?')) return;
    await supabase.storage.from('payment-receipts').remove([receiptPath]);
    await supabase.from('invoices').update({ receipt_path: null, receipt_name: null }).eq('id', inv.id);
    setReceiptPath(null);
    setReceiptName(null);
    onUpdated();
  }

  const isInKind = form.is_in_kind || form.payment_status === 'In Kind';

  return (
    <div>
      {/* In Kind toggle */}
      <div style={{ marginBottom: 16, padding: '10px 14px', background: isInKind ? 'rgba(155,89,255,0.08)' : 'var(--surface)', border: `1px solid ${isInKind ? 'var(--purple, #9b59ff)' : 'var(--border)'}`, borderRadius: 6 }}>
        <label className="checkbox-row" style={{ marginBottom: 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_in_kind} onChange={e => {
            const checked = e.target.checked;
            setF('is_in_kind', checked);
            if (checked) setF('payment_status', 'In Kind');
            else if (form.payment_status === 'In Kind') setF('payment_status', 'Not Invoiced');
          }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>In Kind compensation</span>
          <span className="text-muted text-xs" style={{ marginLeft: 8 }}>No cash — free goods, tickets, products, etc.</span>
        </label>
      </div>

      {isInKind ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--purple, #9b59ff)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>In Kind Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fair Market Value ($) *</label>
              <input className="form-input" type="number" value={form.in_kind_value} onChange={e => setF('in_kind_value', e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Received Date</label>
              <input className="form-input" type="date" value={form.payment_received_date} onChange={e => setF('payment_received_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description of goods / compensation</label>
            <textarea className="form-textarea" value={form.in_kind_description} onChange={e => setF('in_kind_description', e.target.value)} placeholder="e.g. 4× concert tickets (face value $85 each), 1× artist meet & greet pass..." style={{ minHeight: 80 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.payment_notes} onChange={e => setF('payment_notes', e.target.value)} style={{ minHeight: 50 }} />
          </div>
        </>
      ) : (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice #</label>
              <input className="form-input" value={form.invoice_number} onChange={e => setF('invoice_number', e.target.value)} placeholder="INV-001" />
            </div>
            <div className="form-group">
              <label className="form-label">Invoice Date</label>
              <input className="form-input" type="date" value={form.invoice_date} onChange={e => setF('invoice_date', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Amount ($)</label>
              <input className="form-input" type="number" value={form.invoice_amount} onChange={e => setF('invoice_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status</label>
              <select className="form-select" value={form.payment_status} onChange={e => setF('payment_status', e.target.value)}>
                {PAYMENT_STATUSES.filter(s => s !== 'In Kind').map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Payment Received Date</label>
              <input className="form-input" type="date" value={form.payment_received_date} onChange={e => setF('payment_received_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <input className="form-input" value={form.payment_method} onChange={e => setF('payment_method', e.target.value)} placeholder="PayPal, Wire, Check..." />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Notes</label>
            <textarea className="form-textarea" value={form.payment_notes} onChange={e => setF('payment_notes', e.target.value)} style={{ minHeight: 60 }} />
          </div>
        </>
      )}

      <div className="flex items-center gap-12" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Saved ✓</span>}
      </div>

      {/* Receipt upload */}
      <div className="divider" style={{ marginBottom: 16 }} />
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 10 }}>Payment Receipt</div>
      {receiptPath ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receiptName || 'Receipt'}</span>
          <button className="btn btn-ghost btn-sm" onClick={viewReceipt}>View</button>
          <button className="btn btn-ghost btn-sm" onClick={downloadReceipt}>↓</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red, #e74c3c)' }} onClick={deleteReceipt}>✕</button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 18 }}>📎</span>
          <span className="text-muted text-sm">{uploading ? 'Uploading...' : 'Click to upload receipt (PDF, JPG, PNG)'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploading}
            onChange={e => { if (e.target.files[0]) uploadReceipt(e.target.files[0]); }} />
        </label>
      )}
    </div>
  );
}

// ============================================================
// Files Tab — campaign documents (briefs, emails, media, etc.)
// ============================================================
function FilesTab({ campaign }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchFiles(); }, [campaign.id]);

  async function fetchFiles() {
    const { data } = await supabase
      .from('campaign_files')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }

  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const file of Array.from(fileList)) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;
      const path = `${campaign.id}/${safeName}`;
      const { error } = await supabase.storage.from('campaign-files').upload(path, file);
      if (!error) {
        await supabase.from('campaign_files').insert({
          campaign_id: campaign.id,
          uploaded_by: user?.id || null,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          file_type: file.type || null,
        });
      }
    }
    setUploading(false);
    fetchFiles();
  }

  async function viewFile(f) {
    const url = await getDownloadUrl('campaign-files', f.file_path);
    if (url) openPopup(url);
  }

  async function downloadFile(f) {
    const url = await getDownloadUrl('campaign-files', f.file_path);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = f.file_name;
    a.click();
  }

  async function deleteFile(f) {
    if (!window.confirm(`Delete "${f.file_name}"? This cannot be undone.`)) return;
    await supabase.storage.from('campaign-files').remove([f.file_path]);
    await supabase.from('campaign_files').delete().eq('id', f.id);
    fetchFiles();
  }

  // Drag and drop
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      {/* Drop zone */}
      <label
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px', marginBottom: 16,
          background: dragging ? 'rgba(255,92,0,0.06)' : 'var(--surface)',
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
      >
        <span style={{ fontSize: 28, marginBottom: 6 }}>📁</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
        </span>
        <span className="text-muted text-xs" style={{ marginTop: 4 }}>
          Word, PDF, email, images, video, audio — any file type
        </span>
        <input type="file" multiple style={{ display: 'none' }} disabled={uploading}
          onChange={e => uploadFiles(e.target.files)} />
      </label>

      {loading && <div className="text-muted text-sm">Loading files...</div>}

      {!loading && files.length === 0 && (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="empty-state-icon">📂</div>
          <div className="empty-state-title">No files yet</div>
          <div className="empty-state-text">Upload briefs, emails, contracts, or any campaign documents</div>
        </div>
      )}

      {files.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(f.file_type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
            <div className="text-muted text-xs">{fmtBytes(f.file_size)}{f.file_type ? ` · ${f.file_type.split('/')[1]?.toUpperCase() || f.file_type}` : ''}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => viewFile(f)}>View</button>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => downloadFile(f)}>↓</button>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0, color: 'var(--red, #e74c3c)' }} onClick={() => deleteFile(f)}>✕</button>
        </div>
      ))}
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
  const [form, setForm] = useState({ platform_id: '', deliverable_type_id: '', deliverable_details: '', quantity: 1, contracted_post_date: '', music_url: '' });
  const [saving, setSaving] = useState(false);

  async function save() {
    const errors = [];
    if (form.contracted_post_date && !isValidDateString(form.contracted_post_date)) errors.push('Contracted post date is not a valid date.');
    if (form.music_url && !isValidUrl(form.music_url)) errors.push('Music URL is not a valid URL.');
    if (errors.length) { alert(errors.join('\n')); return; }
    setSaving(true);
    const qty = parseInt(form.quantity) || 1;
    const rows = Array.from({ length: qty }, () => ({
      campaign_id: campaignId,
      platform_id: form.platform_id || null,
      deliverable_type_id: form.deliverable_type_id || null,
      deliverable_details: form.deliverable_details || null,
      quantity: 1,
      contracted_post_date: form.contracted_post_date || null,
      music_url: form.music_url || null,
    }));
    await supabase.from('campaign_deliverables').insert(rows);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>ADD DELIVERABLE</div>
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
          <div className="form-group">
            <label className="form-label">
              Music / Sound URL <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>optional</span>
            </label>
            <input className="form-input" value={form.music_url} onChange={e => setForm(f => ({ ...f, music_url: e.target.value }))} placeholder="https://www.tiktok.com/music/..." />
            {form.music_url && (
              <div style={{ marginTop: 6, fontSize: 11, display: 'flex', gap: 8 }}>
                <span className="link" style={{ cursor: 'pointer' }} onClick={() => openPopup(form.music_url)}>Open ↗</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', color: 'var(--red, #e74c3c)' }}
                  onClick={() => setForm(f => ({ ...f, music_url: '' }))}>Clear</button>
              </div>
            )}
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
    const errors = [];
    if (form.submitted_at && !isValidDateString(form.submitted_at)) errors.push('Submitted date is not a valid date.');
    if (form.agency_response_date && !isValidDateString(form.agency_response_date)) errors.push('Agency response date is not a valid date.');
    if (form.draft_url && !isValidUrl(form.draft_url)) errors.push('Draft URL is not a valid URL.');
    if (errors.length) { alert(errors.join('\n')); return; }
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

export function MarkPostedModal({ deliverable, campaign, onClose, onSaved }) {
  const [postUrl, setPostUrl] = useState(deliverable.post_url || '');
  const [postDate, setPostDate] = useState(deliverable.actual_post_date || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const errors = [];
    if (postDate && !isValidDateString(postDate)) errors.push('Post date is not a valid date.');
    if (postUrl && !isValidUrl(postUrl)) errors.push('Post URL is not a valid URL.');
    if (errors.length) { alert(errors.join('\n')); return; }
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
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>MARK AS POSTED</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Select TikTok Post</label>
            <VideoPickerSelect
              campaign={campaign}
              currentPostUrl={postUrl}
              onSelect={(url, date) => {
                setPostUrl(url);
                if (date) setPostDate(date);
              }}
            />
            {postUrl && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                <span className="link" style={{ cursor: "pointer" }} onClick={() => openPopup(postUrl)}>View post ↗</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', color: 'var(--red, #e74c3c)' }}
                  onClick={() => { setPostUrl(''); }}>Clear</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Actual Post Date</label>
            <input className="form-input" type="date" value={postDate} onChange={e => setPostDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !postUrl}>{saving ? 'Saving...' : 'Confirm Posted'}</button>
        </div>
      </div>
    </div>
  );
}
