/**
 * shared/OverviewPage.js
 *
 * Single shared overview — admin and creator see identical content.
 * Admin: isAdmin=true, profileId=null, creatorName=null (all creators, filterable)
 * Creator: isAdmin=false, profileId=<uuid>, creatorName="Mys" (own data only)
 *
 * The only admin-specific differences:
 *  - Creator filter chips visible
 *  - Creator column shown in tables
 *  - Agency payments pending + creator payouts pending sections
 *  - "You Received" / "Paid to Creators" labels vs "Agency Paid" / "Paid to Me"
 *
 * creatorFilter (admin only) applies to ALL content on the page.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from './Badge';
import { fmtDate, fmtMoney, extractMonths } from '../../utils/format';
import { lastMonth, inPeriod, buildPeriodOptions } from '../../utils/period';
import { parseISO, isWithinInterval, addDays } from 'date-fns';

function isInKind(method, agencyStatus) {
  return (method || '').toLowerCase() === 'in kind' ||
         (method == null && (agencyStatus || '').toLowerCase() === 'in kind');
}

// ── Financial summary table ────────────────────────────────────────────────────

function FinancialTable({ summaryRows, rewardRows, period, isAdmin }) {
  const filtSummary = summaryRows.filter(r => {
    const dateRef = r.invoice_date || r.payout_date;
    if (!dateRef) return true;
    return inPeriod(dateRef, period);
  });

  const cashRows    = filtSummary.filter(r => !isInKind(r.payment_method, r.agency_payment_status));
  const contracted  = cashRows.reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const received    = cashRows.filter(r => r.you_received).reduce((s, r) => s + (r.amount_received || r.invoice_amount || 0), 0);
  const pendReceipt = cashRows.filter(r => !r.you_received).reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const paidOut     = cashRows.filter(r => r.payout_status === 'Paid').reduce((s, r) => s + (r.payout_amount || 0), 0);
  const pendPayout  = cashRows.filter(r => r.payout_status !== 'Paid' && r.payout_status !== 'N/A' && r.you_received).reduce((s, r) => s + (r.payout_amount || r.contracted_rate || 0), 0);
  const fees        = cashRows.reduce((s, r) => s + (r.processing_fee || 0), 0);
  const inKind      = filtSummary.filter(r => isInKind(r.payment_method, r.agency_payment_status)).reduce((s, r) => s + (r.invoice_amount ?? r.contracted_rate ?? 0), 0);

  const filtRewards  = rewardRows.filter(e => inPeriod(e.period_month, period));
  const rewardGroups = Object.values(filtRewards.reduce((acc, e) => {
    const key = `${e.platform_name || 'Platform'}||${e.program_name}`;
    if (!acc[key]) acc[key] = { platform: e.platform_name || 'Platform', program: e.program_name, entries: [] };
    acc[key].entries.push(e);
    return acc;
  }, {}));

  const cs  = { padding: '12px 14px', verticalAlign: 'middle' };
  const ns  = (c) => ({ ...cs, fontWeight: 600, color: c || 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' });
  const ds  = { ...cs, color: 'var(--text-muted)', textAlign: 'right' };
  const ls  = { ...cs, fontWeight: 600, fontSize: 13 };
  const sub = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, display: 'block', marginTop: 2, letterSpacing: 0.3 };
  const thS = { padding: '9px 14px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-dim)', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const thL = { ...thS, textAlign: 'left' };

  const Dash = () => <span style={{ color: 'var(--text-dim)' }}>—</span>;
  const Num  = ({ v, color }) =>
    (!v || v === 0) ? <Dash /> :
    <span style={{ color }}>{fmtMoney(v)}</span>;

  function RewardGroupRow({ g, i, isLast }) {
    const gross   = g.entries.reduce((s, e) => s + (e.gross_amount || 0), 0);
    const recvd   = g.entries.filter(e => e.you_received).reduce((s, e) => s + (e.amount_received || e.invoice_amount || 0), 0);
    const pndRcpt = g.entries.filter(e => !e.you_received).reduce((s, e) => s + (e.gross_amount || 0), 0);
    const paid    = g.entries.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
    const pend    = g.entries.filter(e => e.payout_status !== 'Paid' && e.you_received).reduce((s, e) => s + (e.payout_amount || e.gross_amount || 0), 0);
    const rgFees  = g.entries.reduce((s, e) => s + (e.processing_fee || 0), 0);
    return (
      <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
        <td style={ls}>{g.platform}<span style={sub}>{g.program}</span></td>
        <td style={ns()}><Num v={gross} color="var(--text)" /></td>
        <td style={ns('var(--green)')}><Num v={recvd} color="var(--green)" /></td>
        <td style={ns('var(--orange)')}><Num v={pndRcpt} color="var(--orange)" /></td>
        <td style={ns('var(--accent)')}><Num v={paid} color="var(--accent)" /></td>
        <td style={ns('var(--orange)')}><Num v={pend} color="var(--orange)" /></td>
        <td style={ns('var(--red)')}><Num v={rgFees} color="var(--red)" /></td>
        <td style={ds}><Dash /></td>
      </tr>
    );
  }

  const tGross   = contracted + rewardGroups.reduce((s, g) => s + g.entries.reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
  const tRecvd   = received   + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.you_received).reduce((ss, e) => ss + (e.amount_received || e.invoice_amount || 0), 0), 0);
  const tPndRcpt = pendReceipt + rewardGroups.reduce((s, g) => s + g.entries.filter(e => !e.you_received).reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
  const tPaid    = paidOut    + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.payout_status === 'Paid').reduce((ss, e) => ss + (e.payout_amount || 0), 0), 0);
  const tPend    = pendPayout + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.payout_status !== 'Paid' && e.you_received).reduce((ss, e) => ss + (e.payout_amount || e.gross_amount || 0), 0), 0);
  const tFees    = fees       + rewardGroups.reduce((s, g) => s + g.entries.reduce((ss, e) => ss + (e.processing_fee || 0), 0), 0);

  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={thL}>Source</th>
            <th style={thS}>Contracted / Gross</th>
            <th style={thS}>{isAdmin ? 'You Received' : 'Agency Paid'}</th>
            <th style={thS}>Pending Receipt</th>
            <th style={thS}>{isAdmin ? 'Paid to Creators' : 'Paid to Me'}</th>
            <th style={thS}>Pending Payout</th>
            <th style={thS}>Fees</th>
            <th style={thS}>In-Kind FMV</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: rewardGroups.length > 0 ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
            <td style={ls}>Campaign Payments<span style={sub}>Brand deals</span></td>
            <td style={ns()}><Num v={contracted} color="var(--text)" /></td>
            <td style={ns('var(--green)')}><Num v={received} color="var(--green)" /></td>
            <td style={ns('var(--orange)')}><Num v={pendReceipt} color="var(--orange)" /></td>
            <td style={ns('var(--accent)')}><Num v={paidOut} color="var(--accent)" /></td>
            <td style={ns('var(--orange)')}><Num v={pendPayout} color="var(--orange)" /></td>
            <td style={ns('var(--red)')}><Num v={fees} color="var(--red)" /></td>
            <td style={ds}><Num v={inKind} color="var(--text-muted)" /></td>
          </tr>
          {rewardGroups.map((g, i) => (
            <RewardGroupRow key={`${g.platform}-${g.program}`} g={g} i={i} isLast={i === rewardGroups.length - 1} />
          ))}
          {rewardGroups.length > 0 && (
            <tr style={{ borderTop: '2px solid var(--border2)', background: 'var(--surface2)' }}>
              <td style={{ ...ls, color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Total</td>
              <td style={ns()}><Num v={tGross} color="var(--text)" /></td>
              <td style={ns('var(--green)')}><Num v={tRecvd} color="var(--green)" /></td>
              <td style={ns('var(--orange)')}><Num v={tPndRcpt} color="var(--orange)" /></td>
              <td style={ns('var(--accent)')}><Num v={tPaid} color="var(--accent)" /></td>
              <td style={ns('var(--orange)')}><Num v={tPend} color="var(--orange)" /></td>
              <td style={ns('var(--red)')}><Num v={tFees} color="var(--red)" /></td>
              <td style={ds}><Num v={inKind} color="var(--text-muted)" /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main shared component ──────────────────────────────────────────────────────

export default function OverviewPage({ isAdmin, profileId, creatorName, setActiveView, navigateToCampaign, refreshKey }) {
  const [campaigns, setCampaigns]         = useState([]);
  const [summaryRows, setSummaryRows]     = useState([]);
  const [rewardRows, setRewardRows]       = useState([]);
  const [creators, setCreators]           = useState([]);
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [loading, setLoading]             = useState(true);
  const [period, setPeriod]               = useState(lastMonth());

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (refreshKey > 0) fetchAll(); }, [refreshKey]);

  async function fetchAll() {
    let campaignQuery = supabase.from('campaigns').select(`
      id, campaign_name, brand_name, contracted_rate, status, creator_profile_id,
      campaign_start_date, campaign_end_date, deal_signed_date,
      agency:agencies(name),
      creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
      campaign_deliverables(id, draft_status, contracted_post_date,
        platform:platforms(name), deliverable_type:deliverable_types(name)),
      invoices(payment_status),
      creator_payouts(payout_status, payout_amount)
    `).order('created_at', { ascending: false });

    let summaryQuery = supabase.from('campaign_payout_summary').select(
      'campaign_id, creator_profile_id, contracted_rate, payment_method, agency_payment_status, invoice_date, ' +
      'invoice_amount, amount_received, processing_fee, you_received, you_received_date, ' +
      'payout_status, payout_amount, payout_date'
    );

    let rewardQuery = supabase.from('reward_payout_summary').select(
      'entry_id, profile_id, platform_name, program_name, period_month, gross_amount, ' +
      'amount_received, invoice_amount, processing_fee, you_received, ' +
      'payout_status, payout_amount'
    ).order('period_month', { ascending: false });

    if (!isAdmin && profileId) {
      campaignQuery = campaignQuery.eq('creator_profile_id', profileId);
      summaryQuery  = summaryQuery.eq('creator_profile_id', profileId);
      rewardQuery   = rewardQuery.eq('profile_id', profileId);
    }

    const creatorsQuery = isAdmin
      ? supabase.from('profiles').select('id, full_name, creator_name').eq('role', 'creator')
      : Promise.resolve({ data: [] });

    const [cRes, sRes, rRes, crRes] = await Promise.all([campaignQuery, summaryQuery, rewardQuery, creatorsQuery]);

    setCampaigns(cRes.data   || []);
    setSummaryRows(sRes.data || []);
    setRewardRows(rRes.data  || []);
    setCreators(crRes.data   || []);
    setLoading(false);
  }

  // ── Apply creatorFilter to ALL data ─────────────────────────────────────────
  // This is the single filter that drives everything on the page when admin selects a creator.
  const viewCampaigns   = (isAdmin && creatorFilter !== 'all')
    ? campaigns.filter(c => c.creator_profile_id === creatorFilter)
    : campaigns;
  const viewSummaryRows = (isAdmin && creatorFilter !== 'all')
    ? summaryRows.filter(r => r.creator_profile_id === creatorFilter)
    : summaryRows;
  const viewRewardRows  = (isAdmin && creatorFilter !== 'all')
    ? rewardRows.filter(r => r.profile_id === creatorFilter)
    : rewardRows;

  // ── Derived activity data (all from viewCampaigns) ──────────────────────────
  const active   = viewCampaigns.filter(c => c.status === 'Active');
  const upcoming = viewCampaigns.filter(c => c.status === 'Confirmed');

  const needsAttentionGrouped = Object.values(
    viewCampaigns
      .filter(c => ['Active', 'Confirmed'].includes(c.status))
      .flatMap(c =>
        (c.campaign_deliverables || [])
          .filter(d => ['Not Started', 'Revisions Requested'].includes(d.draft_status))
          .map(d => ({ ...d, campaign: c }))
      )
      .reduce((acc, d) => {
        if (!acc[d.campaign.id]) acc[d.campaign.id] = { campaign: d.campaign, items: [] };
        acc[d.campaign.id].items.push(d);
        return acc;
      }, {})
  );

  // 14-day upcoming deadlines — shown on both admin and creator
  const soon = viewCampaigns.flatMap(c =>
    (c.campaign_deliverables || [])
      .filter(d => {
        if (!d.contracted_post_date || d.draft_status === 'Posted') return false;
        try { return isWithinInterval(parseISO(d.contracted_post_date), { start: new Date(), end: addDays(new Date(), 14) }); }
        catch { return false; }
      })
      .map(d => ({ ...d, campaign: c }))
  ).sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1);

  // Admin-only pending sections
  const agencyPending = isAdmin ? viewCampaigns.filter(c => {
    const inv = c.invoices?.[0];
    if (!inv || isInKind(inv.payment_method)) return false;
    return ['Not Invoiced', 'Invoiced', 'Pending'].includes(inv.payment_status) && c.status !== 'Cancelled';
  }) : [];

  const payoutsPending = isAdmin ? viewCampaigns.filter(c => {
    const inv    = c.invoices?.[0];
    if (isInKind(inv?.payment_method)) return false;
    const payout = c.creator_payouts?.[0];
    return inv && ['Invoiced', 'Pending', 'Paid'].includes(inv.payment_status) &&
           c.status !== 'Cancelled' && (!payout || payout.payout_status !== 'Paid');
  }) : [];

  // Period dropdown — from both summary and reward data
  const campaignMonths = extractMonths(viewSummaryRows, 'invoice_date');
  const rewardMonths   = extractMonths(viewRewardRows, 'period_month');
  const allMonths      = [...new Set([...campaignMonths, ...rewardMonths])].sort().reverse();

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  function navigateCampaign(id) {
    if (navigateToCampaign) navigateToCampaign(id);
    else if (setActiveView) setActiveView('campaigns');
  }

  const selectedCreatorName = creatorFilter !== 'all'
    ? (creators.find(c => c.id === creatorFilter)?.creator_name || creators.find(c => c.id === creatorFilter)?.full_name || '')
    : null;

  const pageTitle    = isAdmin ? 'OVERVIEW' : `HEY, ${(creatorName || '').toUpperCase()}`;
  const pageSubtitle = isAdmin
    ? (selectedCreatorName ? `${selectedCreatorName}'s campaigns` : 'All campaigns across Kym and Mys')
    : "Here's what needs your attention";

  const allClear = needsAttentionGrouped.length === 0 && active.length === 0 &&
                   soon.length === 0 && upcoming.length === 0 &&
                   agencyPending.length === 0 && payoutsPending.length === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{pageTitle}</div>
          <div className="page-subtitle">{pageSubtitle}</div>
        </div>
        <div className="flex items-center gap-8">
          {isAdmin && creators.length > 0 && (
            <div className="flex gap-6">
              <button className={`filter-chip ${creatorFilter === 'all' ? 'active' : ''}`} onClick={() => setCreatorFilter('all')}>All</button>
              {creators.map(c => (
                <button key={c.id} className={`filter-chip ${creatorFilter === c.id ? 'active' : ''}`} onClick={() => setCreatorFilter(c.id)}>
                  {c.creator_name || c.full_name}
                </button>
              ))}
            </div>
          )}
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
            value={period} onChange={e => setPeriod(e.target.value)}>
            {buildPeriodOptions(allMonths).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Count tiles — both admin and creator */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-value stat-accent">{active.length}</div><div className="stat-label">Active Campaigns</div></div>
        <div className="stat-card"><div className="stat-value">{upcoming.length}</div><div className="stat-label">Confirmed Upcoming</div></div>
        <div className="stat-card"><div className="stat-value stat-orange">{needsAttentionGrouped.length}</div><div className="stat-label">Need Action</div></div>
      </div>

      {/* Financial summary table */}
      <FinancialTable summaryRows={viewSummaryRows} rewardRows={viewRewardRows} period={period} isAdmin={isAdmin} />

      {/* Needs attention */}
      {needsAttentionGrouped.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'rgba(255,156,58,0.3)' }}>
          <div className="flex items-center justify-between mb-12">
            <div className="card-title" style={{ color: 'var(--orange)' }}>⚠ NEEDS ATTENTION</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('campaigns')}>Go to Campaigns →</button>
          </div>
          {needsAttentionGrouped.map(({ campaign, items }) => (
            <div key={campaign.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, cursor: 'pointer' }} onClick={() => navigateCampaign(campaign.id)}>
                {campaign.campaign_name}
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                  {isAdmin && (campaign.creator?.creator_name || campaign.creator?.full_name) && `${campaign.creator?.creator_name || campaign.creator?.full_name} · `}
                  {campaign.brand_name}
                </span>
                {!isAdmin && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--orange)' }}>→</span>}
              </div>
              {items.map(d => (
                <div key={d.id} className="flex items-center justify-between" style={{ padding: '5px 0 5px 12px', borderLeft: '2px solid rgba(255,156,58,0.3)' }}>
                  <span className="text-muted text-sm">{d.platform?.name}{d.deliverable_type?.name ? ` · ${d.deliverable_type.name}` : ''}</span>
                  <div className="flex items-center gap-12">
                    <Badge status={d.draft_status} />
                    {d.contracted_post_date && <span className="text-sm text-muted">Due {fmtDate(d.contracted_post_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Posting in 14 days — both admin and creator */}
      {soon.length > 0 && (
        <div className="card mb-16">
          <div className="card-title" style={{ marginBottom: 12 }}>POSTING IN THE NEXT 14 DAYS</div>
          {soon.map(d => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{d.campaign.campaign_name}</div>
                <div className="text-muted text-sm">
                  {isAdmin && (d.campaign.creator?.creator_name || d.campaign.creator?.full_name) && `${d.campaign.creator?.creator_name || d.campaign.creator?.full_name} · `}
                  {d.platform?.name} · {d.deliverable_type?.name}
                </div>
              </div>
              <div className="flex items-center gap-12">
                <Badge status={d.draft_status} />
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmtDate(d.contracted_post_date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active campaigns table */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-10">
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)' }}>ACTIVE CAMPAIGNS</div>
            {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('campaigns')}>View All →</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  {isAdmin && <th>Creator</th>}
                  <th>Agency</th>
                  <th>Posts</th>
                  <th>Next Deadline</th>
                  <th>Progress</th>
                  <th>Agency Status</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {active.map(c => {
                  const dels   = c.campaign_deliverables || [];
                  const posted = dels.filter(d => d.draft_status === 'Posted').length;
                  const total  = dels.length;
                  const next   = dels.filter(d => d.contracted_post_date && d.draft_status !== 'Posted')
                                     .sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1)[0];
                  const inv    = c.invoices?.[0];
                  const payout = c.creator_payouts?.[0];
                  const ik     = isInKind(inv?.payment_method);
                  return (
                    <tr key={c.id} onClick={() => navigateCampaign(c.id)} style={{ cursor: 'pointer' }}>
                      <td><div style={{ fontWeight: 500 }}>{c.campaign_name}</div><div className="text-muted text-xs">{c.brand_name}</div></td>
                      {isAdmin && <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>}
                      <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                      <td style={{ fontWeight: 500, textAlign: 'center' }}>
                        {total > 0 ? <span style={{ color: posted === total ? 'var(--green)' : 'var(--text)' }}>{posted}/{total}</span> : <span className="text-muted">—</span>}
                      </td>
                      <td>{next ? <span style={{ fontWeight: 500 }}>{fmtDate(next.contracted_post_date)}</span> : <span className="text-muted">—</span>}</td>
                      <td>
                        {total > 0 ? (
                          <div className="flex items-center gap-8">
                            <div style={{ width: 60, height: 4, background: 'var(--surface3)', borderRadius: 2 }}>
                              <div style={{ width: `${(posted/total)*100}%`, height: '100%', background: posted === total ? 'var(--green)' : 'var(--orange)', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round((posted/total)*100)}%</span>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td>{ik ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>In Kind</span> : inv ? <Badge status={inv.payment_status} /> : <span className="text-muted text-xs">No invoice</span>}</td>
                      <td>{ik ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>N/A</span> : payout ? <Badge status={payout.payout_status} /> : <span className="text-muted text-xs">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmed upcoming — both admin and creator */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>CONFIRMED UPCOMING</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  {isAdmin && <th>Creator</th>}
                  <th>Brand</th>
                  <th>Agency</th>
                  <th>Posts</th>
                  <th>Starts</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(c => (
                  <tr key={c.id} onClick={() => navigateCampaign(c.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{c.campaign_name}</td>
                    {isAdmin && <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>}
                    <td>{c.brand_name}</td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td>{c.campaign_deliverables?.length || <span className="text-muted">—</span>}</td>
                    <td>{fmtDate(c.campaign_start_date) || <span className="text-muted">—</span>}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {isInKind(c.invoices?.[0]?.payment_method) ? <span style={{ color: 'var(--text-muted)' }}>In Kind</span> : fmtMoney(c.contracted_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agency payments pending — admin only */}
      {isAdmin && agencyPending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-10">
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)' }}>AGENCY PAYMENTS PENDING</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('payments')}>Go to Payments →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Campaign</th><th>Creator</th><th>Agency</th><th>Rate</th><th>Invoice Status</th></tr></thead>
              <tbody>
                {agencyPending.map(c => (
                  <tr key={c.id} onClick={() => setActiveView('payments')} style={{ cursor: 'pointer' }}>
                    <td><div style={{ fontWeight: 500 }}>{c.campaign_name}</div><div className="text-muted text-xs">{c.brand_name}</div></td>
                    <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtMoney(c.contracted_rate)}</td>
                    <td><Badge status={c.invoices?.[0]?.payment_status || 'Not Invoiced'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creator payouts pending — admin only */}
      {isAdmin && payoutsPending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-10">
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)' }}>CREATOR PAYOUTS PENDING</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('payments')}>Go to Payments →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Campaign</th><th>Creator</th><th>Agency Status</th><th>Contracted Rate</th><th>Payout Status</th></tr></thead>
              <tbody>
                {payoutsPending.map(c => {
                  const inv    = c.invoices?.[0];
                  const payout = c.creator_payouts?.[0];
                  return (
                    <tr key={c.id} onClick={() => setActiveView('payments')} style={{ cursor: 'pointer' }}>
                      <td><div style={{ fontWeight: 500 }}>{c.campaign_name}</div><div className="text-muted text-xs">{c.brand_name}</div></td>
                      <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>
                      <td><Badge status={inv?.payment_status || 'Not Invoiced'} /></td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtMoney(c.contracted_rate)}</td>
                      <td>{payout ? <Badge status={payout.payout_status} /> : <span className="text-muted text-xs">Not created</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allClear && (
        <div className="card">
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">{isAdmin ? 'All clear' : 'All caught up'}</div>
            <div className="empty-state-text">{isAdmin ? 'No active campaigns or pending payments' : 'No immediate action needed'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
