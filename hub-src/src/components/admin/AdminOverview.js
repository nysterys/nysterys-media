import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney, fmtMonth } from '../../utils/format';

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}

function lastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentQuarterStart() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3, 1);
}

function lastQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const startMonth = q === 0 ? 9 : (q - 1) * 3;
  const startYear  = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const start = new Date(startYear, startMonth, 1);
  const end   = new Date(startYear, startMonth + 3, 0);
  return { start, end };
}

function inPeriod(dateStr, period) {
  if (!dateStr) return period === 'all';
  if (period === 'all') return true;
  const d = dateStr.slice(0, 10);
  if (period === 'ytd') return d >= `${new Date().getFullYear()}-01-01`;
  if (period === 'lastyear') return d.startsWith(String(new Date().getFullYear() - 1));
  if (period === 'qtd') return d >= currentQuarterStart().toISOString().slice(0, 10);
  if (period === 'lastq') {
    const { start, end } = lastQuarterRange();
    return d >= start.toISOString().slice(0, 10) && d <= end.toISOString().slice(0, 10);
  }
  return d.startsWith(period);
}

function buildPeriodOptions(months) {
  return [
    { value: 'all',      label: 'All time' },
    { value: 'ytd',      label: 'Year to date' },
    { value: 'qtd',      label: 'Quarter to date' },
    { value: 'lastq',    label: 'Last quarter' },
    { value: 'lastyear', label: 'Last year' },
    ...months.map(m => ({ value: m, label: fmtMonth(m) })),
  ];
}

// ── Financial summary table ────────────────────────────────────────────────
function FinancialTable({ invoices, payouts, campaigns, rewards, period, isAdmin }) {
  // Best date for a campaign: use invoice date, payout date, or campaign dates as fallback
  function campaignDateRef(c) {
    const inv = c.invoices?.[0];
    const p   = c.creator_payouts?.[0];
    return inv?.invoice_date || inv?.you_received_date || p?.payout_date ||
           c.campaign_end_date || c.deal_signed_date || null;
  }

  const activeCampaigns = (campaigns || []).filter(c => c.status !== 'Cancelled');

  // Period-filtered campaigns — no date = include only for 'all'
  const filtCampaigns = activeCampaigns.filter(c => {
    const dateRef = campaignDateRef(c);
    if (!dateRef) return period === 'all';
    return inPeriod(dateRef, period);
  });

  // Also filter the flat invoices/payouts arrays for cross-referencing
  const filtInv = invoices.filter(i => {
    const dateRef = i.invoice_date || i.you_received_date;
    if (!dateRef) return period === 'all';
    return inPeriod(dateRef, period);
  });
  const filtPay = payouts.filter(p => {
    const inv = invoices.find(i => i.campaign_id === p.campaign_id);
    const dateRef = inv?.invoice_date || inv?.you_received_date;
    if (!dateRef) return period === 'all';
    return inPeriod(dateRef, period);
  });

  const cashCampaigns = filtCampaigns.filter(c => !isInKind(c.invoices?.[0]?.payment_method));

  // Contracted = all cash campaigns in period
  const contracted  = cashCampaigns.reduce((s, c) => s + (c.contracted_rate || 0), 0);

  // Received = invoices paid
  const received    = filtInv.filter(i => !isInKind(i.payment_method) && i.payment_status === 'Paid').reduce((s, i) => s + (i.invoice_amount || 0), 0);

  // Pending receipt = no invoice OR invoice not yet paid
  const pendReceipt = cashCampaigns.filter(c => {
    const status = c.invoices?.[0]?.payment_status;
    return !status || ['Not Invoiced','Invoiced','Pending'].includes(status);
  }).reduce((s, c) => s + (c.contracted_rate || 0), 0);

  // Paid out / pending payout from flat payouts array
  const paidOut     = filtPay.filter(p => p.payout_status === 'Paid').reduce((s, p) => s + (p.payout_amount || 0), 0);
  const pendPayout  = filtPay.filter(p => p.payout_status !== 'Paid').reduce((s, p) => s + (p.payout_amount || 0), 0);

  // Fees from invoices
  const fees        = filtInv.filter(i => !isInKind(i.payment_method)).reduce((s, i) => s + (i.processing_fee || 0), 0);

  // In-kind = in-kind campaigns in period
  const inKind      = filtCampaigns.filter(c => isInKind(c.invoices?.[0]?.payment_method)).reduce((s, c) => s + (c.invoices?.[0]?.invoice_amount ?? c.contracted_rate ?? 0), 0);

  // Rewards grouped by platform+program
  const filtRewards = rewards.filter(e => inPeriod(e.period_month, period));
  const rewardGroups = Object.values(filtRewards.reduce((groups, e) => {
    const key = `${e.platform_name || 'Platform'}||${e.program_name}`;
    if (!groups[key]) groups[key] = { platform: e.platform_name || 'Platform', program: e.program_name, entries: [] };
    groups[key].entries.push(e);
    return groups;
  }, {}));

  const cellStyle = { padding: '12px 14px', verticalAlign: 'middle' };
  const numStyle  = (color) => ({ ...cellStyle, fontWeight: 600, color: color || 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' });
  const dimStyle  = { ...cellStyle, color: 'var(--text-muted)', textAlign: 'right' };
  const labelStyle = { ...cellStyle, fontWeight: 600, fontSize: 13 };
  const subStyle  = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, display: 'block', marginTop: 2, letterSpacing: 0.3 };

  function Money({ v, color, dim }) {
    if (!v || v === 0) return <span style={{ color: 'var(--text-dim)' }}>—</span>;
    return <span style={{ color: color || (dim ? 'var(--text-muted)' : 'var(--text)') }}>{fmtMoney(v)}</span>;
  }

  const thStyle = {
    padding: '9px 14px',
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'var(--text-dim)',
    textAlign: 'right',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };
  const thFirst = { ...thStyle, textAlign: 'left' };

  return (
    <div style={{ border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={thFirst}>Source</th>
            <th style={thStyle}>Contracted / Gross</th>
            <th style={thStyle}>{isAdmin ? 'You Received' : 'Agency Paid'}</th>
            <th style={thStyle}>Pending Receipt</th>
            <th style={thStyle}>Paid to {isAdmin ? 'Creators' : 'Me'}</th>
            <th style={thStyle}>Pending Payout</th>
            <th style={thStyle}>Fees</th>
            <th style={thStyle}>In-Kind FMV</th>
          </tr>
        </thead>
        <tbody>
          {/* Campaign row */}
          <tr style={{ borderBottom: rewardGroups.length > 0 ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
            <td style={labelStyle}>
              Campaign Payments
              <span style={subStyle}>Brand deals across all creators</span>
            </td>
            <td style={numStyle()}><Money v={contracted} /></td>
            <td style={numStyle('var(--green)')}><Money v={received} color="var(--green)" /></td>
            <td style={numStyle('var(--orange)')}><Money v={pendReceipt} color="var(--orange)" /></td>
            <td style={numStyle('var(--accent)')}><Money v={paidOut} color="var(--accent)" /></td>
            <td style={numStyle('var(--orange)')}><Money v={pendPayout} color="var(--orange)" /></td>
            <td style={numStyle('var(--red)')}><Money v={fees} color="var(--red)" /></td>
            <td style={{ ...dimStyle, fontStyle: 'italic' }}><Money v={inKind} dim /></td>
          </tr>

          {/* Reward program rows */}
          {rewardGroups.map((g, i) => {
            const gross     = g.entries.reduce((s, e) => s + (e.gross_amount || 0), 0);
            const recvd     = g.entries.filter(e => e.you_received).reduce((s, e) => s + Math.max(0, (e.amount_received || e.invoice_amount || 0) - (e.processing_fee || 0)), 0);
            const pendRcpt  = g.entries.filter(e => !e.you_received).reduce((s, e) => s + (e.gross_amount || 0), 0);
            const paid      = g.entries.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
            const pend      = g.entries.filter(e => e.payout_status !== 'Paid').reduce((s, e) => s + (e.gross_amount || 0), 0);
            const rgFees    = g.entries.reduce((s, e) => s + (e.processing_fee || 0), 0);
            const isLast    = i === rewardGroups.length - 1;
            return (
              <tr key={`${g.platform}-${g.program}`} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                <td style={labelStyle}>
                  {g.platform}
                  <span style={subStyle}>{g.program}</span>
                </td>
                <td style={numStyle()}><Money v={gross} /></td>
                <td style={numStyle('var(--green)')}><Money v={recvd} color="var(--green)" /></td>
                <td style={numStyle('var(--orange)')}><Money v={pendRcpt} color="var(--orange)" /></td>
                <td style={numStyle('var(--accent)')}><Money v={paid} color="var(--accent)" /></td>
                <td style={numStyle('var(--orange)')}><Money v={pend} color="var(--orange)" /></td>
                <td style={numStyle('var(--red)')}><Money v={rgFees} color="var(--red)" /></td>
                <td style={dimStyle}>—</td>
              </tr>
            );
          })}

          {/* Totals row */}
          {rewardGroups.length > 0 && (() => {
            const tGross    = contracted + rewardGroups.reduce((s, g) => s + g.entries.reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
            const tRecvd    = received   + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.you_received).reduce((ss, e) => ss + Math.max(0, (e.amount_received || e.invoice_amount || 0) - (e.processing_fee || 0)), 0), 0);
            const tPendRcpt = pendReceipt+ rewardGroups.reduce((s, g) => s + g.entries.filter(e => !e.you_received).reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
            const tPaid     = paidOut    + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.payout_status === 'Paid').reduce((ss, e) => ss + (e.payout_amount || 0), 0), 0);
            const tPend     = pendPayout + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.payout_status !== 'Paid').reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
            const tFees     = fees       + rewardGroups.reduce((s, g) => s + g.entries.reduce((ss, e) => ss + (e.processing_fee || 0), 0), 0);
            return (
              <tr style={{ borderTop: '2px solid var(--border2)', background: 'var(--surface2)' }}>
                <td style={{ ...labelStyle, color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Total</td>
                <td style={numStyle()}><Money v={tGross} /></td>
                <td style={numStyle('var(--green)')}><Money v={tRecvd} color="var(--green)" /></td>
                <td style={numStyle('var(--orange)')}><Money v={tPendRcpt} color="var(--orange)" /></td>
                <td style={numStyle('var(--accent)')}><Money v={tPaid} color="var(--accent)" /></td>
                <td style={numStyle('var(--orange)')}><Money v={tPend} color="var(--orange)" /></td>
                <td style={numStyle('var(--red)')}><Money v={tFees} color="var(--red)" /></td>
                <td style={{ ...dimStyle, fontStyle: 'italic' }}><Money v={inKind} dim /></td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminOverview({ setActiveView }) {
  const [data, setData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(lastMonth());

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [campaignsRes, invoicesRes, payoutsRes, rewardsRes] = await Promise.all([
      supabase.from('campaigns').select(`
        *, agency:agencies(name),
        creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
        campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name)),
        invoices(payment_status, invoice_amount, payment_method, you_received_date, invoice_date, processing_fee),
        creator_payouts(payout_status, payout_amount)
      `).order('created_at', { ascending: false }),
      supabase.from('invoices').select('payment_status, invoice_amount, payment_method, you_received_date, invoice_date, processing_fee, campaign_id').not('campaign_id', 'is', null),
      supabase.from('creator_payouts').select('payout_status, payout_amount, campaign_id').not('campaign_id', 'is', null),
      supabase.from('reward_payout_summary').select('*').order('period_month', { ascending: false }),
    ]);

    const campaigns  = campaignsRes.data || [];
    const invoices   = invoicesRes.data  || [];
    const payouts    = payoutsRes.data   || [];
    const rewardRows = rewardsRes.data   || [];

    const active = campaigns.filter(c => c.status === 'Active');

    const needsAttention = campaigns
      .filter(c => c.status === 'Active' || c.status === 'Confirmed')
      .flatMap(c =>
        (c.campaign_deliverables || [])
          .filter(d => ['Not Started', 'Revisions Requested'].includes(d.draft_status))
          .map(d => ({ ...d, campaign: c }))
      );

    const needsAttentionGrouped = Object.values(
      needsAttention.reduce((groups, d) => {
        const key = d.campaign.id;
        if (!groups[key]) groups[key] = { campaign: d.campaign, items: [] };
        groups[key].items.push(d);
        return groups;
      }, {})
    );

    const agencyPending = campaigns.filter(c => {
      const inv = c.invoices?.[0];
      if (!inv || isInKind(inv.payment_method)) return false;
      return ['Not Invoiced', 'Invoiced', 'Pending'].includes(inv.payment_status) && c.status !== 'Cancelled';
    });

    const payoutsPending = campaigns.filter(c => {
      const inv = c.invoices?.[0];
      if (isInKind(inv?.payment_method)) return false;
      const payout = c.creator_payouts?.[0];
      return !payout || payout.payout_status !== 'Paid';
    }).filter(c => {
      const inv = c.invoices?.[0];
      return inv && ['Invoiced', 'Pending', 'Paid'].includes(inv.payment_status) && c.status !== 'Cancelled';
    });

    setData({ campaigns, invoices, payouts, active, needsAttentionGrouped, agencyPending, payoutsPending });
    setRewards(rewardRows);
    setLoading(false);
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  const { campaigns, invoices, payouts, active, needsAttentionGrouped, agencyPending, payoutsPending } = data;

  const campaignMonths = [...new Set(invoices.map(i => (i.invoice_date || i.you_received_date)?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const rewardMonths   = [...new Set(rewards.map(e => e.period_month?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const allMonths      = [...new Set([...campaignMonths, ...rewardMonths])].sort().reverse();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">OVERVIEW</div>
          <div className="page-subtitle">All campaigns across Kym and Mys</div>
        </div>
        <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={period} onChange={e => setPeriod(e.target.value)}>
          {buildPeriodOptions(allMonths).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Financial summary table */}
      <FinancialTable invoices={invoices} payouts={payouts} campaigns={campaigns} rewards={rewards} period={period} isAdmin={true} />

      {/* Needs attention */}
      {needsAttentionGrouped.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'rgba(255,156,58,0.3)' }}>
          <div className="flex items-center justify-between mb-12">
            <div className="card-title" style={{ color: 'var(--orange)' }}>⚠ NEEDS ATTENTION</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('campaigns')}>Go to Campaigns →</button>
          </div>
          {needsAttentionGrouped.map(({ campaign, items }) => (
            <div key={campaign.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, cursor: 'pointer' }} onClick={() => setActiveView('campaigns')}>
                {campaign.campaign_name}
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                  {campaign.creator?.creator_name || campaign.creator?.full_name} · {campaign.brand_name}
                </span>
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

      {/* Active campaigns table */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-10">
            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)' }}>ACTIVE CAMPAIGNS</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('campaigns')}>View All →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th><th>Creator</th><th>Brand</th><th>Posts</th><th>Next Deadline</th><th>Progress</th><th>Agency Status</th><th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {active.map(c => {
                  const deliverables = c.campaign_deliverables || [];
                  const posted = deliverables.filter(d => d.draft_status === 'Posted').length;
                  const total  = deliverables.length;
                  const next   = deliverables.filter(d => d.contracted_post_date && d.draft_status !== 'Posted').sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1)[0];
                  const inv    = c.invoices?.[0];
                  const payout = c.creator_payouts?.[0];
                  return (
                    <tr key={c.id} onClick={() => setActiveView('campaigns')} style={{ cursor: 'pointer' }}>
                      <td><div style={{ fontWeight: 500 }}>{c.campaign_name}</div><div className="text-muted text-xs">{c.brand_name}</div></td>
                      <td>{c.creator?.creator_name || c.creator?.full_name || '—'}</td>
                      <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                      <td style={{ fontWeight: 500, textAlign: 'center' }}>
                        {total > 0 ? <span style={{ color: posted === total ? 'var(--green)' : 'var(--text)' }}>{posted}/{total}</span> : <span className="text-muted">—</span>}
                      </td>
                      <td>{next ? <span style={{ fontWeight: 500 }}>{fmtDate(next.contracted_post_date)}</span> : <span className="text-muted">—</span>}</td>
                      <td>
                        {total > 0 ? (
                          <div className="flex items-center gap-8">
                            <div style={{ width: 60, height: 4, background: 'var(--surface3)', borderRadius: 2 }}>
                              <div style={{ width: `${(posted / total) * 100}%`, height: '100%', background: posted === total ? 'var(--green)' : 'var(--orange)', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round((posted / total) * 100)}%</span>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td>{isInKind(inv?.payment_method) ? <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>In Kind</span> : inv ? <Badge status={inv.payment_status} /> : <span className="text-muted text-xs">No invoice</span>}</td>
                      <td>{isInKind(inv?.payment_method) ? <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>N/A</span> : payout ? <Badge status={payout.payout_status} /> : <span className="text-muted text-xs">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agency payments pending */}
      {agencyPending.length > 0 && (
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

      {/* Creator payouts pending */}
      {payoutsPending.length > 0 && (
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

      {needsAttentionGrouped.length === 0 && active.length === 0 && agencyPending.length === 0 && payoutsPending.length === 0 && (
        <div className="card">
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">All clear</div>
            <div className="empty-state-text">No active campaigns or pending payments</div>
          </div>
        </div>
      )}
    </div>
  );
}
