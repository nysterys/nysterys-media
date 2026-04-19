import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import Comments from '../shared/Comments';
import { fmtDate, fmtMoney, extractMonths } from '../../utils/format';
import { inPeriod, PeriodSelect } from '../../utils/period';
import { format, parseISO } from 'date-fns';

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

export default function CreatorCampaigns({ pendingCampaignId, onCampaignOpened, onCampaignStatusChanged }) {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('deliverables');
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { fetch(); }, []);

  // Open campaign when pendingCampaignId is set — campaigns may already be loaded
  useEffect(() => {
    if (!pendingCampaignId || campaigns.length === 0) return;
    const target = campaigns.find(c => c.id === pendingCampaignId);
    if (target) {
      setSelected(target);
      setTab('deliverables');
    }
  }, [pendingCampaignId, campaigns]);

  async function fetch() {
    const { data } = await supabase
      .from('campaigns')
      .select(`
        *, agency:agencies(name),
        campaign_deliverables(
          *, platform:platforms(name), deliverable_type:deliverable_types(name),
          revision_rounds(*, submitted_by_profile:profiles!revision_rounds_submitted_by_fkey(full_name))
        ),
        invoices(payment_status, invoice_amount, invoice_date, payment_received_date, payment_method, amount_received, processing_fee, you_received, you_received_date),
        creator_payouts(payout_status, payout_amount, payout_date, payout_notes, payout_splits(split_status, amount, destination:payment_destinations(name, account_type, account_last4, institution), sent_date, cleared_date, reference))
      `)
      .eq('creator_profile_id', profile.id)
      .order('created_at', { ascending: false });

    const freshCampaigns = data || [];

    // Fetch TikTok stats for all deliverables and merge by id
    const allDeliverableIds = freshCampaigns.flatMap(c => (c.campaign_deliverables || []).map(d => d.id));
    let statsById = {};
    if (allDeliverableIds.length > 0) {
      const { data: statsRows } = await supabase
        .from('campaign_deliverables_with_stats')
        .select('id, cover_image_url, video_title, views, likes, comments, shares, engagement_rate, average_time_watched, full_video_watched_rate')
        .in('id', allDeliverableIds);
      (statsRows || []).forEach(s => { statsById[s.id] = s; });
    }

    // Merge stats into deliverables
    freshCampaigns.forEach(c => {
      (c.campaign_deliverables || []).forEach(d => {
        if (statsById[d.id]) Object.assign(d, statsById[d.id]);
      });
    });

    setCampaigns(freshCampaigns);
    // Keep detail panel in sync with fresh data
    setSelected(prev => prev ? (freshCampaigns.find(c => c.id === prev.id) || prev) : null);
    setLoading(false);
  }

  
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';

  const STATUSES = ['Negotiating', 'Confirmed', 'Active', 'Completed', 'Cancelled'];

  const campaignDates = campaigns.map(c => ({ date_ref: c.campaign_start_date || c.created_at?.slice(0, 10) }));
  const months = extractMonths(campaignDates, 'date_ref');

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function SortTh({ col, children }) {
    const active = sortBy === col;
    return (
      <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(col)}>
        {children}
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 9 }}>{active && sortDir === 'desc' ? '▼' : '▲'}</span>
      </th>
    );
  }

  const filtered = campaigns
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => inPeriod(c.campaign_start_date || c.created_at, monthFilter))
    .sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'campaign':  av = a.campaign_name || ''; bv = b.campaign_name || ''; break;
        case 'agency':    av = (a.agency?.name || '').toLowerCase(); bv = (b.agency?.name || '').toLowerCase(); break;
        case 'rate':      av = a.contracted_rate || 0; bv = b.contracted_rate || 0; break;
        case 'posts': {
          av = (a.campaign_deliverables || []).filter(d => d.draft_status === 'Posted').length;
          bv = (b.campaign_deliverables || []).filter(d => d.draft_status === 'Posted').length;
          break;
        }
        case 'deadline': {
          av = (a.campaign_deliverables || []).filter(d => d.contracted_post_date && d.draft_status !== 'Posted').sort((x,y) => x.contracted_post_date > y.contracted_post_date ? 1 : -1)[0]?.contracted_post_date || '';
          bv = (b.campaign_deliverables || []).filter(d => d.contracted_post_date && d.draft_status !== 'Posted').sort((x,y) => x.contracted_post_date > y.contracted_post_date ? 1 : -1)[0]?.contracted_post_date || '';
          break;
        }
        case 'status':    av = a.status || ''; bv = b.status || ''; break;
        case 'payment': {
          av = a.creator_payouts?.[0]?.payout_status || a.invoices?.[0]?.payment_status || '';
          bv = b.creator_payouts?.[0]?.payout_status || b.invoices?.[0]?.payment_status || '';
          break;
        }
        default: av = a.created_at || ''; bv = b.created_at || '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  function openCampaign(c) {
    setSelected(c);
    setTab('deliverables');
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MY CAMPAIGNS</div>
          <div className="page-subtitle">{campaigns.length} total deals</div>
        </div>
      </div>

      <div className="filters-row">
        {['all', ...STATUSES].map(s => (
          <button key={s} className={`filter-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <PeriodSelect period={monthFilter} onChange={setMonthFilter} months={months} style={{ marginLeft: 8 }} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◎</div>
          <div className="empty-state-title">No campaigns here</div>
          <div className="empty-state-text">Your manager will add campaigns as deals are confirmed</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh col="campaign">Campaign</SortTh>
                <SortTh col="agency">Agency</SortTh>
                <th>Platforms</th>
                <SortTh col="rate">Rate</SortTh>
                <SortTh col="posts">Posts</SortTh>
                <SortTh col="deadline">Next Deadline</SortTh>
                <SortTh col="status">Status</SortTh>
                <SortTh col="payment">Payment</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const deliverables = c.campaign_deliverables || [];
                const posted = deliverables.filter(d => d.draft_status === 'Posted').length;
                const total = deliverables.length;
                const nextDeadline = deliverables
                  .filter(d => d.contracted_post_date && d.draft_status !== 'Posted')
                  .sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1)[0];
                const inv = c.invoices?.[0];
                const payout = c.creator_payouts?.[0];
                const platformCounts = {};
                deliverables.forEach(d => {
                  const name = d.platform?.name || '?';
                  platformCounts[name] = (platformCounts[name] || 0) + 1;
                });
                return (
                  <tr key={c.id} onClick={() => openCampaign(c)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.campaign_name}</div>
                      <div className="text-muted text-xs">{c.brand_name}</div>
                    </td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td>
                      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                        {Object.entries(platformCounts).length === 0
                          ? <span className="text-muted">—</span>
                          : Object.entries(platformCounts).map(([name, count]) => (
                              <span key={name} className="badge badge-confirmed">
                                {name}{count > 1 ? ` ×${count}` : ''}
                              </span>
                            ))}
                      </div>
                    </td>
                    <td>
                      {isInKind(inv?.payment_method)
                        ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>In Kind</span>
                        : c.contracted_rate
                          ? <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmtMoney(c.contracted_rate)}</span>
                          : <span className="text-muted">TBD</span>}
                    </td>
                    <td>
                      {total > 0 ? (
                        <div className="flex items-center gap-8">
                          <span style={{ fontSize: 12 }}>{posted}/{total}</span>
                          <div style={{ width: 40, height: 3, background: 'var(--surface3)', borderRadius: 2 }}>
                            <div style={{ width: `${(posted / total) * 100}%`, height: '100%', background: posted === total ? 'var(--green)' : 'var(--orange)', borderRadius: 2 }} />
                          </div>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {nextDeadline
                        ? <span style={{ fontWeight: 500 }}>{fmtDate(nextDeadline.contracted_post_date)}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td><Badge status={c.status} /></td>
                    <td>
                      {(() => {
                        if (isInKind(inv?.payment_method)) return <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>In Kind</span>;
                        if (payout?.payout_status) return <Badge status={payout.payout_status} />;
                        if (inv?.payment_status) return <Badge status={inv.payment_status} />;
                        return <span className="text-muted text-xs">—</span>;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CreatorCampaignDetail
          campaign={selected}
          tab={tab}
          setTab={setTab}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            fetch();
            if (onCampaignStatusChanged) onCampaignStatusChanged();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Creator Campaign Detail Panel
// ============================================================
function CreatorCampaignDetail({ campaign, tab, setTab, onClose, onUpdated }) {
  const c = campaign;
  
  const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString()}` : '—';
  const inv = c.invoices?.[0];
  const payout = c.creator_payouts?.[0];
  const inKind = isInKind(inv?.payment_method);

  const deliverables = c.campaign_deliverables || [];
  const allPosted = deliverables.length > 0 && deliverables.every(d => d.draft_status === 'Posted');
  const canMarkComplete = allPosted && c.status === 'Active';

  async function markComplete() {
    if (!window.confirm('Mark this campaign as Completed?')) return;
    const { error } = await supabase.from('campaigns').update({ status: 'Completed' }).eq('id', c.id);
    if (error) { alert('Could not mark complete: ' + error.message); return; }
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
        {c.contracted_rate && (
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: 8 }}>
            {fmtMoney(c.contracted_rate)}
            {c.is_rush && c.rush_premium > 0 && <span className="text-muted" style={{ fontWeight: 400 }}> + {fmtMoney(c.rush_premium)} rush</span>}
          </div>
        )}
        {canMarkComplete && (
          <button className="btn btn-primary btn-sm mt-8" style={{ marginTop: 10 }} onClick={markComplete}>
            ✓ Mark Campaign Complete
          </button>
        )}
      </div>

      <div className="tabs" style={{ padding: '0 24px' }}>
        {['deliverables', 'brief', 'payment', 'comments'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      <div className="detail-body">

        {tab === 'deliverables' && (
          <CreatorDeliverablesTab campaign={c} onUpdated={onUpdated} />
        )}

        {tab === 'brief' && (
          <div>
            <div className="detail-section">
              <div className="detail-section-title">Campaign Details</div>
              <div className="detail-grid">
                <div><div className="detail-item-label">Start Date</div><div className="detail-item-value">{fmtDate(c.campaign_start_date)}</div></div>
                <div><div className="detail-item-label">End Date</div><div className="detail-item-value">{fmtDate(c.campaign_end_date)}</div></div>
                {c.usage_rights_notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div className="detail-item-label">Usage Rights</div>
                    <div className="detail-item-value">{c.usage_rights_notes}</div>
                  </div>
                )}
              </div>
            </div>

            {c.brief ? (
              <div className="detail-section">
                <div className="detail-section-title">Brief & Instructions</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{c.brief}</div>
              </div>
            ) : (
              <div className="text-muted text-sm">No brief added yet. Check with your manager.</div>
            )}

            {c.admin_notes && (
              <div className="detail-section">
                <div className="detail-section-title">Notes from Manager</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{c.admin_notes}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'payment' && (
          <div>
            {inKind ? (
              <div>
                <div className="detail-section-title">COMPENSATION</div>
                <div style={{ padding: '12px 14px', borderRadius: 6, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Compensation</div>
                  This campaign was compensated in kind (fair value: {fmtMoney(inv?.invoice_amount || c.contracted_rate)}). No cash payout applies.
                </div>
              </div>
            ) : (
              <>
                <div className="detail-section">
                  <div className="detail-section-title">Agency Payment</div>
                  <div className="detail-grid">
                    <div>
                      <div className="detail-item-label">Contracted Rate</div>
                      <div className="detail-item-value" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtMoney(c.contracted_rate)}</div>
                    </div>
                    <div>
                      <div className="detail-item-label">Agency Status</div>
                      <div className="detail-item-value">{inv ? <Badge status={inv.payment_status} /> : '—'}</div>
                    </div>
                    {inv?.invoice_date && (
                      <div>
                        <div className="detail-item-label">Invoice Date</div>
                        <div className="detail-item-value">{fmtDate(inv.invoice_date)}</div>
                      </div>
                    )}
                    {inv?.payment_received_date && (
                      <div>
                        <div className="detail-item-label">Agency Paid Date</div>
                        <div className="detail-item-value" style={{ color: 'var(--green)' }}>{fmtDate(inv.payment_received_date)}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="detail-section-title">Your Payout</div>
                  {!payout ? (
                    <div className="text-muted text-sm">Payout not yet created by your manager.</div>
                  ) : (
                    <>
                      <div className="detail-grid" style={{ marginBottom: 16 }}>
                        <div>
                          <div className="detail-item-label">Payout Amount</div>
                          <div className="detail-item-value" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>{fmtMoney(payout.payout_amount)}</div>
                        </div>
                        <div>
                          <div className="detail-item-label">Payout Status</div>
                          <div className="detail-item-value"><Badge status={payout.payout_status || 'Pending'} /></div>
                        </div>
                        {payout.payout_date && (
                          <div>
                            <div className="detail-item-label">Payout Date</div>
                            <div className="detail-item-value">{fmtDate(payout.payout_date)}</div>
                          </div>
                        )}
                        {payout.payout_notes && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <div className="detail-item-label">Notes</div>
                            <div className="detail-item-value text-muted">{payout.payout_notes}</div>
                          </div>
                        )}
                      </div>

                      {payout.payout_splits?.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>
                            Destination Breakdown
                          </div>
                          {payout.payout_splits.map((s, i) => {
                            const dest = s.destination;
                            const statusColor = s.split_status === 'Cleared' ? 'var(--green)' : s.split_status === 'Sent' ? 'var(--accent)' : s.split_status === 'Failed' ? 'var(--red)' : 'var(--text-muted)';
                            return (
                              <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 8 }}>
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{dest?.name || 'Unknown destination'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                      {dest?.account_type}{dest?.account_last4 ? ` ···${dest.account_last4}` : ''}{dest?.institution ? ` · ${dest.institution}` : ''}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.split_status}</span>
                                </div>
                                <div className="detail-grid">
                                  <div>
                                    <div className="detail-item-label">Amount</div>
                                    <div className="detail-item-value" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{fmtMoney(s.amount)}</div>
                                  </div>
                                  {s.sent_date && (
                                    <div>
                                      <div className="detail-item-label">Sent</div>
                                      <div className="detail-item-value">{fmtDate(s.sent_date)}</div>
                                    </div>
                                  )}
                                  {s.cleared_date && (
                                    <div>
                                      <div className="detail-item-label">Cleared</div>
                                      <div className="detail-item-value" style={{ color: 'var(--green)' }}>✓ {fmtDate(s.cleared_date)}</div>
                                    </div>
                                  )}
                                  {s.reference && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <div className="detail-item-label">Reference</div>
                                      <div className="detail-item-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.reference}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'comments' && (
          <Comments campaignId={c.id} />
        )}

      </div>
    </div>
  );
}

// ============================================================
// Creator Deliverables Tab - primary action area
// ============================================================
function CreatorDeliverablesTab({ campaign, onUpdated }) {
  const [showSubmitDraft, setShowSubmitDraft] = useState(null);
  const [showMarkPosted, setShowMarkPosted] = useState(null);
  const [showLinkVideo, setShowLinkVideo] = useState(null);
  

  return (
    <div>
      <div className="text-muted text-xs mb-12" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
        {campaign.campaign_deliverables?.length || 0} platform(s) in this deal
      </div>

      {(!campaign.campaign_deliverables || campaign.campaign_deliverables.length === 0) && (
        <div className="empty-state">
          <div className="empty-state-icon">◻</div>
          <div className="empty-state-title">No platforms yet</div>
          <div className="empty-state-text">Your manager will add the platforms covered under this deal</div>
        </div>
      )}

      {campaign.campaign_deliverables?.map(d => {
        const canSubmitDraft = d.draft_status !== 'Posted' && d.draft_status !== 'Approved';

        return (
          <div key={d.id} className="deliverable-card">
            <div className="deliverable-card-header">
              <div>
                <span className="deliverable-platform">{d.platform?.name || 'Platform'}</span>
                {d.deliverable_type && <span className="text-muted text-sm" style={{ marginLeft: 8 }}>· {d.deliverable_type.name}</span>}
                {d.quantity > 1 && <span className="text-muted text-sm"> × {d.quantity}</span>}
              </div>
              <Badge status={d.draft_status} />
            </div>

            {d.deliverable_details && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 10px', background: 'var(--surface3)', borderRadius: 4 }}>
                {d.deliverable_details}
              </div>
            )}

            {d.music_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontSize: 14 }}>🎵</span>
                <span className="text-muted">Music:</span>
                <span className="link" style={{ cursor: 'pointer' }} onClick={() => openPopup(d.music_url)}>
                  {d.music_url.length > 50 ? d.music_url.slice(0, 50) + '…' : d.music_url}
                </span>
              </div>
            )}

            {/* TikTok video thumbnail + stats */}
            {d.cover_image_url && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <div onClick={() => openPopup(d.post_url)}
                  style={{ flexShrink: 0, width: 72, height: 96, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <img src={d.cover_image_url} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {d.video_title && (
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, marginBottom: 4, wordBreak: 'break-word' }}>
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
              <div><span className="text-muted">Due: </span><span style={{ fontWeight: 500 }}>{fmtDate(d.contracted_post_date)}</span></div>
              {d.actual_post_date && (
                <div><span className="text-muted">Posted: </span><span style={{ color: 'var(--green)' }}>{fmtDate(d.actual_post_date)}</span></div>
              )}
              {d.post_url && (
                <span className="link text-sm" style={{ cursor: 'pointer' }} onClick={() => openPopup(d.post_url)}>View Post ↗</span>
              )}
            </div>

            {/* Revision rounds */}
            <div style={{ marginBottom: 10 }}>
              <div className="detail-section-title" style={{ marginBottom: 8 }}>REVISION ROUNDS</div>
              {(!d.revision_rounds || d.revision_rounds.length === 0) && (
                <div className="text-muted text-sm">No drafts submitted yet.</div>
              )}
              {d.revision_rounds?.sort((a, b) => a.round_number - b.round_number).map(r => (
                <div key={r.id} className="revision-round">
                  <div className="revision-round-header">
                    <span className="round-number">Round {r.round_number}</span>
                    <Badge status={r.agency_decision} />
                  </div>
                  {r.submitted_at && <div className="text-sm text-muted">Submitted {fmtDate(r.submitted_at?.split('T')[0])}</div>}
                  {r.draft_url && (
                    <a href={r.draft_url} target="_blank" rel="noreferrer" className="link text-sm">View Draft ↗</a>
                  )}
                  {r.draft_notes && <div className="text-sm mt-4">{r.draft_notes}</div>}
                  {r.agency_decision === 'Revisions Requested' && r.agency_feedback && (
                    <div className="mt-8" style={{ background: 'rgba(255,156,58,0.08)', border: '1px solid rgba(255,156,58,0.2)', padding: '8px 10px', borderRadius: 4, fontSize: 12 }}>
                      <div style={{ color: 'var(--orange)', fontWeight: 600, marginBottom: 4 }}>Feedback from agency:</div>
                      {r.agency_feedback}
                    </div>
                  )}
                  {r.agency_decision === 'Approved' && (
                    <div className="mt-8" style={{ background: 'rgba(200,245,100,0.08)', border: '1px solid rgba(200,245,100,0.2)', padding: '8px 10px', borderRadius: 4, fontSize: 12, color: 'var(--accent)' }}>
                      ✓ Approved{r.agency_response_date ? ` on ${fmtDate(r.agency_response_date)}` : ''}
                      {r.agency_feedback && <div style={{ color: 'var(--text)', marginTop: 4 }}>{r.agency_feedback}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-8">
              {canSubmitDraft && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitDraft(d)}>Submit Draft</button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkVideo(d)}>
                {d.post_url ? 'Change Video' : 'Link Posted Video'}
              </button>
              {(d.draft_status === 'Approved' || d.draft_status === 'Posted') && !d.post_url && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowMarkPosted(d)}>Add Post URL</button>
              )}
              {d.draft_status === 'Posted' && d.post_url && (
                <span className="text-sm" style={{ color: 'var(--green)', padding: '5px 0' }}>✓ Posted</span>
              )}
            </div>
          </div>
        );
      })}

      {showSubmitDraft && (
        <CreatorSubmitDraftModal
          deliverable={showSubmitDraft}
          onClose={() => setShowSubmitDraft(null)}
          onSaved={() => { setShowSubmitDraft(null); onUpdated(); }}
        />
      )}

      {showMarkPosted && (
        <CreatorMarkPostedModal
          deliverable={showMarkPosted}
          onClose={() => setShowMarkPosted(null)}
          onSaved={() => { setShowMarkPosted(null); onUpdated(); }}
        />
      )}

      {showLinkVideo && (
        <CreatorLinkVideoModal
          deliverable={showLinkVideo}
          campaign={campaign}
          onClose={() => setShowLinkVideo(null)}
          onSaved={() => { setShowLinkVideo(null); onUpdated(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Creator Submit Draft Modal
// ============================================================
function CreatorSubmitDraftModal({ deliverable, onClose, onSaved }) {
  const nextRound = (deliverable.revision_rounds?.length || 0) + 1;
  const [draftUrl, setDraftUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submittedAt, setSubmittedAt] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('revision_rounds').insert({
      deliverable_id: deliverable.id,
      round_number: nextRound,
      submitted_by: user?.id || null,
      submitted_at: new Date(submittedAt).toISOString(),
      draft_url: draftUrl || null,
      draft_notes: notes || null,
      agency_decision: 'Pending',
    });
    await supabase.from('campaign_deliverables')
      .update({ draft_status: 'Draft Submitted' })
      .eq('id', deliverable.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 18 }}>SUBMIT DRAFT — ROUND {nextRound}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)' }}>{deliverable.platform?.name}</strong> · {deliverable.deliverable_type?.name || 'Content'}
          </div>
          <div className="form-group">
            <label className="form-label">Submission Date</label>
            <input className="form-input" type="date" value={submittedAt} onChange={e => setSubmittedAt(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Draft URL (link to your draft)</label>
            <input
              className="form-input"
              value={draftUrl}
              onChange={e => setDraftUrl(e.target.value)}
              placeholder="https://drive.google.com/... or any link"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes for the agency (optional)</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context, questions, or notes..."
              style={{ minHeight: 72 }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Creator Mark Posted Modal
// ============================================================
function CreatorMarkPostedModal({ deliverable, onClose, onSaved }) {
  const [postUrl, setPostUrl] = useState(deliverable.post_url || '');
  const [postDate, setPostDate] = useState(
    deliverable.actual_post_date || new Date().toISOString().split('T')[0]
  );
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
          <div className="modal-title" style={{ fontSize: 18 }}>ADD POST URL</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)' }}>{deliverable.platform?.name}</strong> · {deliverable.deliverable_type?.name || 'Content'}
          </div>
          <div className="form-group">
            <label className="form-label">Post URL *</label>
            <input
              className="form-input"
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@..."
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date Posted</label>
            <input
              className="form-input"
              type="date"
              value={postDate}
              onChange={e => setPostDate(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !postUrl}>
            {saving ? 'Saving...' : 'Save Post URL'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Video Picker — same logic as admin, scoped to creator's account
// ============================================================
function VideoPickerSelect({ campaign, currentPostUrl, onSelect }) {
  const { profile } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadVideos(); }, []);

  async function loadVideos() {
    setLoading(true);
    const { data: acct } = await supabase
      .from('tiktok_accounts')
      .select('tiktok_username')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .single();

    if (!acct?.tiktok_username) { setLoading(false); return; }

    let query = supabase
      .from('tiktok_video_insights_view')
      .select('video_id, video_title, create_time, share_url')
      .eq('tiktok_username', acct.tiktok_username)
      .order('create_time', { ascending: false });

    if (campaign.campaign_start_date) query = query.gte('create_time', campaign.campaign_start_date);
    if (campaign.campaign_end_date) {
      const end = new Date(campaign.campaign_end_date);
      end.setDate(end.getDate() + 1);
      query = query.lte('create_time', end.toISOString().split('T')[0]);
    }

    const { data: allVideos } = await query;

    const { data: usedRows } = await supabase
      .from('campaign_deliverables')
      .select('post_url')
      .neq('campaign_id', campaign.id)
      .not('post_url', 'is', null);

    const usedUrls = new Set((usedRows || []).map(r => r.post_url));

    const available = (allVideos || []).filter(v => {
      if (currentPostUrl && currentPostUrl.includes(v.video_id)) return true;
      return ![...usedUrls].some(url => url && url.includes(v.video_id));
    });

    setVideos(available);
    setLoading(false);
  }

  const fmtD = (d) => {
    if (!d) return '';
    try { return format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'MMM d'); }
    catch { return d; }
  };

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

  if (loading) return <div className="text-muted text-sm" style={{ padding: '8px 0' }}>Loading your videos...</div>;
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
          {fmtD(v.create_time)} · {v.video_title ? (v.video_title.length > 60 ? v.video_title.slice(0, 60) + '…' : v.video_title) : v.video_id}
        </option>
      ))}
    </select>
  );
}

// ============================================================
// Creator Link Video Modal
// ============================================================
function CreatorLinkVideoModal({ deliverable, campaign, onClose, onSaved }) {
  const [postUrl, setPostUrl] = useState(deliverable.post_url || '');
  const [postDate, setPostDate] = useState(deliverable.actual_post_date || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!postUrl) return;
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
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 16 }}>LINK POSTED VIDEO</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            <strong style={{ color: 'var(--text)' }}>{deliverable.platform?.name}</strong>
            {deliverable.deliverable_type?.name ? ` · ${deliverable.deliverable_type.name}` : ''}
            {deliverable.deliverable_details && (
              <div style={{ marginTop: 4, fontSize: 12 }}>{deliverable.deliverable_details}</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Select from your TikTok videos</label>
            <VideoPickerSelect
              campaign={campaign}
              currentPostUrl={postUrl}
              onSelect={(url, date) => {
                setPostUrl(url);
                if (date) setPostDate(date);
              }}
            />
          </div>
          {postUrl && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postUrl}</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--red, #e74c3c)' }}
                onClick={() => { setPostUrl(''); setPostDate(''); }}>Clear</button>
            </div>
          )}
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Post Date</label>
            <input className="form-input" type="date" value={postDate} onChange={e => setPostDate(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !postUrl}>
            {saving ? 'Saving...' : 'Link Video & Mark Posted'}
          </button>
        </div>
      </div>
    </div>
  );
}
