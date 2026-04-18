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

function periodLabel(p) {
  if (p === 'all') return 'All time';
  if (p === 'ytd') return 'Year to date';
  return fmtMonth(p);
}

function buildPeriodOptions(months) {
  const opts = [
    { value: 'all', label: 'All time' },
    { value: 'ytd', label: 'Year to date' },
  ];
  months.forEach(m => opts.push({ value: m, label: fmtMonth(m) }));
  return opts;
}

function inPeriod(dateStr, period) {
  if (!dateStr) return period === 'all';
  if (period === 'all') return true;
  if (period === 'ytd') return dateStr.startsWith(String(new Date().getFullYear()));
  return dateStr.startsWith(period);
}

export default function AdminOverview({ setActiveView }) {
  const [data, setData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campaignPeriod, setCampaignPeriod] = useState(lastMonth());
  const [rewardPeriod, setRewardPeriod] = useState(lastMonth());

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [campaignsRes, invoicesRes, payoutsRes, rewardsRes] = await Promise.all([
      supabase.from('campaigns').select(`
        *, agency:agencies(name),
        creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
        campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name)),
        invoices(payment_status, invoice_amount, payment_method, you_received_date),
        creator_payouts(payout_status, payout_amount)
      `).order('created_at', { ascending: false }),
      supabase.from('invoices').select('payment_status, invoice_amount, payment_method, you_received_date, processing_fee, campaign_id').not('campaign_id', 'is', null),
      supabase.from('creator_payouts').select('payout_status, payout_amount, campaign_id').not('campaign_id', 'is', null),
      supabase.from('reward_payout_summary').select('*').order('period_month', { ascending: false }),
    ]);

    const campaigns = campaignsRes.data || [];
    const invoices  = invoicesRes.data || [];
    const payouts   = payoutsRes.data || [];
    const rewardRows = rewardsRes.data || [];

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

  // Campaign KPIs filtered by campaignPeriod
  const filtInvoices = invoices.filter(i => inPeriod(i.you_received_date, campaignPeriod));
  const filtPayouts  = payouts.filter(p => {
    const inv = invoices.find(i => i.campaign_id === p.campaign_id);
    return inPeriod(inv?.you_received_date, campaignPeriod);
  });
  const filtCampaigns = campaigns.filter(c => {
    const inv = c.invoices?.[0];
    return inPeriod(inv?.you_received_date, campaignPeriod);
  });

  const totalContracted = campaignPeriod === 'all'
    ? campaigns.filter(c => !isInKind(c.invoices?.[0]?.payment_method)).reduce((s, c) => s + (c.contracted_rate || 0), 0)
    : filtCampaigns.filter(c => !isInKind(c.invoices?.[0]?.payment_method)).reduce((s, c) => s + (c.contracted_rate || 0), 0);
  const totalReceived   = filtInvoices.filter(i => !isInKind(i.payment_method) && i.payment_status === 'Paid').reduce((s, i) => s + (i.invoice_amount || 0), 0);
  const totalPaidOut    = filtPayouts.filter(p => p.payout_status === 'Paid').reduce((s, p) => s + (p.payout_amount || 0), 0);
  const totalPending    = invoices.filter(i => !isInKind(i.payment_method) && ['Not Invoiced', 'Invoiced', 'Pending'].includes(i.payment_status)).reduce((s, i) => s + (i.invoice_amount || 0), 0);
  const totalFeesCampaign = filtInvoices.filter(i => !isInKind(i.payment_method)).reduce((s, i) => s + (i.processing_fee || 0), 0);
  const totalInKind     = campaigns.filter(c => isInKind(c.invoices?.[0]?.payment_method)).reduce((s, c) => s + (c.invoices?.[0]?.invoice_amount ?? c.contracted_rate ?? 0), 0);

  // Reward KPIs filtered by rewardPeriod
  const filtRewards = rewards.filter(e => inPeriod(e.period_month, rewardPeriod));
  const rTotalGross    = filtRewards.reduce((s, e) => s + (e.gross_amount || 0), 0);
  const rTotalReceived = filtRewards.filter(e => e.you_received).reduce((s, e) => s + (e.amount_received || e.invoice_amount || 0), 0);
  const rTotalPaidOut  = filtRewards.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
  const rTotalPending  = filtRewards.filter(e => e.payout_status !== 'Paid').reduce((s, e) => s + (e.gross_amount || 0), 0);
  const rTotalFees     = filtRewards.reduce((s, e) => s + (e.processing_fee || 0), 0);

  // Month lists for dropdowns
  const campaignMonths = [...new Set(invoices.map(i => i.you_received_date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const rewardMonths   = [...new Set(rewards.map(e => e.period_month?.slice(0, 7)).filter(Boolean))].sort().reverse();

  const tileGroupStyle = {
    border: '1px solid var(--border2)',
    borderRadius: 8,
    padding: '14px 14px 2px',
    marginBottom: 20,
  };

  const groupHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  };

  const groupLabelStyle = {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'var(--text-dim)',
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">OVERVIEW</div>
          <div className="page-subtitle">All campaigns across Kym and Mys</div>
        </div>
      </div>

      {/* Campaign payment tiles */}
      <div style={tileGroupStyle}>
        <div style={groupHeaderStyle}>
          <div style={groupLabelStyle}>CAMPAIGN PAYMENTS</div>
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} value={campaignPeriod} onChange={e => setCampaignPeriod(e.target.value)}>
            {buildPeriodOptions(campaignMonths).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 12 }}>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: 18 }}>{fmtMoney(totalContracted)}</div><div className="stat-label">Total Contracted</div></div>
          <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 18 }}>{fmtMoney(totalReceived)}</div><div className="stat-label">Total Received</div></div>
          <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 18 }}>{fmtMoney(totalPaidOut)}</div><div className="stat-label">Paid to Creators</div></div>
          <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 18 }}>{fmtMoney(totalPending)}</div><div className="stat-label">Pending from Agencies</div></div>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: 18, color: totalFeesCampaign > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(totalFeesCampaign)}</div><div className="stat-label">Fees Paid</div></div>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: 18, color: 'var(--text-muted)', fontStyle: 'italic' }}>{fmtMoney(totalInKind)}</div><div className="stat-label">In-Kind FMV</div></div>
        </div>
      </div>

      {/* Rewards tiles */}
      <div style={tileGroupStyle}>
        <div style={groupHeaderStyle}>
          <div style={groupLabelStyle}>PLATFORM REWARDS</div>
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} value={rewardPeriod} onChange={e => setRewardPeriod(e.target.value)}>
            {buildPeriodOptions(rewardMonths).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 12 }}>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: 18 }}>{fmtMoney(rTotalGross)}</div><div className="stat-label">Gross Earned</div></div>
          <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 18 }}>{fmtMoney(rTotalReceived)}</div><div className="stat-label">You Received</div></div>
          <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 18 }}>{fmtMoney(rTotalPaidOut)}</div><div className="stat-label">Paid to Creators</div></div>
          <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 18 }}>{fmtMoney(rTotalPending)}</div><div className="stat-label">Pending Payout</div></div>
          <div className="stat-card"><div className="stat-value" style={{ fontSize: 18, color: rTotalFees > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(rTotalFees)}</div><div className="stat-label">Fees Paid</div></div>
        </div>
      </div>

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
                      <td>{total > 0 ? `${posted}/${total}` : <span className="text-muted">—</span>}</td>
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
