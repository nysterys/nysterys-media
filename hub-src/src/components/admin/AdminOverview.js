import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney } from '../../utils/format';

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}

export default function AdminOverview({ setActiveView }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [campaignsRes, invoicesRes, payoutsRes] = await Promise.all([
      supabase.from('campaigns').select(`
        *, agency:agencies(name),
        creator:profiles!campaigns_creator_profile_id_fkey(full_name, creator_name),
        campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name)),
        invoices(payment_status, invoice_amount, payment_method),
        creator_payouts(payout_status, payout_amount)
      `).order('created_at', { ascending: false }),
      supabase.from('invoices').select('payment_status, invoice_amount, payment_method, campaign_id'),
      supabase.from('creator_payouts').select('payout_status, payout_amount, campaign_id'),
    ]);

    const campaigns = campaignsRes.data || [];
    const invoices  = invoicesRes.data || [];
    const payouts   = payoutsRes.data || [];

    // KPI stats
    const totalContracted = campaigns.filter(c => !isInKind(c.invoices?.[0]?.payment_method)).reduce((s, c) => s + (c.contracted_rate || 0), 0);
    const totalReceived   = invoices.filter(i => !isInKind(i.payment_method) && i.payment_status === 'Paid').reduce((s, i) => s + (i.invoice_amount || 0), 0);
    const totalPaidOut    = payouts.filter(p => p.payout_status === 'Paid').reduce((s, p) => s + (p.payout_amount || 0), 0);
    const totalPending    = invoices.filter(i => !isInKind(i.payment_method) && ['Not Invoiced', 'Invoiced', 'Pending'].includes(i.payment_status)).reduce((s, i) => s + (i.invoice_amount || 0), 0);
    const totalInKind = campaigns
      .filter(c => isInKind(c.invoices?.[0]?.payment_method))
      .reduce((s, c) => {
        const fmv = c.invoices?.[0]?.invoice_amount ?? c.contracted_rate ?? 0;
        return s + fmv;
      }, 0);

    // Active campaigns
    const active = campaigns.filter(c => c.status === 'Active');

    // Needs attention: deliverables in active campaigns that are Not Started or Revisions Requested
    const needsAttention = campaigns
      .filter(c => c.status === 'Active' || c.status === 'Confirmed')
      .flatMap(c =>
        (c.campaign_deliverables || [])
          .filter(d => ['Not Started', 'Revisions Requested'].includes(d.draft_status))
          .map(d => ({ ...d, campaign: c }))
      );

    // Group by campaign
    const needsAttentionGrouped = Object.values(
      needsAttention.reduce((groups, d) => {
        const key = d.campaign.id;
        if (!groups[key]) groups[key] = { campaign: d.campaign, items: [] };
        groups[key].items.push(d);
        return groups;
      }, {})
    );

    // Agency payments pending (not in-kind, not paid)
    const agencyPending = campaigns.filter(c => {
      const inv = c.invoices?.[0];
      if (!inv || isInKind(inv.payment_method)) return false;
      return ['Not Invoiced', 'Invoiced', 'Pending'].includes(inv.payment_status) && c.status !== 'Cancelled';
    });

    // Creator payouts pending
    const payoutsPending = campaigns.filter(c => {
      const inv = c.invoices?.[0];
      if (isInKind(inv?.payment_method)) return false;
      const payout = c.creator_payouts?.[0];
      return !payout || (payout.payout_status !== 'Paid');
    }).filter(c => {
      // Only show if agency has at least invoiced (some money is coming)
      const inv = c.invoices?.[0];
      return inv && ['Invoiced', 'Pending', 'Paid'].includes(inv.payment_status) && c.status !== 'Cancelled';
    });

    setData({
      totalCampaigns: campaigns.length,
      activeCampaigns: active.length,
      totalContracted, totalReceived, totalPaidOut, totalPending, totalInKind,
      active,
      needsAttentionGrouped,
      agencyPending,
      payoutsPending,
    });
    setLoading(false);
  }

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  const { totalCampaigns, activeCampaigns, totalContracted, totalReceived, totalPaidOut, totalPending, totalInKind,
          active, needsAttentionGrouped, agencyPending, payoutsPending } = data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">OVERVIEW</div>
          <div className="page-subtitle">All campaigns across Kym and Mys</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{fmtMoney(totalContracted)}</div><div className="stat-label">Total Contracted</div></div>
        <div className="stat-card"><div className="stat-value stat-green">{fmtMoney(totalReceived)}</div><div className="stat-label">Total Received</div></div>
        <div className="stat-card"><div className="stat-value stat-accent">{fmtMoney(totalPaidOut)}</div><div className="stat-label">Paid to Creators</div></div>
        <div className="stat-card"><div className="stat-value stat-orange">{fmtMoney(totalPending)}</div><div className="stat-label">Pending from Agencies</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{fmtMoney(totalInKind)}</div><div className="stat-label">In-Kind FMV</div></div>
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
              <thead>
                <tr><th>Campaign</th><th>Creator</th><th>Agency</th><th>Rate</th><th>Invoice Status</th></tr>
              </thead>
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
              <thead>
                <tr><th>Campaign</th><th>Creator</th><th>Agency Status</th><th>Contracted Rate</th><th>Payout Status</th></tr>
              </thead>
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

      {/* All clear */}
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
