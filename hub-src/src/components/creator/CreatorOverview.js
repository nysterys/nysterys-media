import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney, fmtMonth } from '../../utils/format';
import { parseISO, isWithinInterval, addDays } from 'date-fns';

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

function CreatorFinancialTable({ campaigns, rewards, period }) {
  // For period filtering: use the best available date for each campaign.
  // Cancelled campaigns excluded. Non-cancelled campaigns with no date are included for 'all'.
  function campaignDateRef(c) {
    const p   = c.creator_payouts?.[0];
    const inv = c.invoices?.[0];
    return p?.payout_date || inv?.you_received_date || inv?.invoice_date ||
           c.campaign_end_date || c.deal_signed_date || null;
  }

  const activeCampaigns = campaigns.filter(c => c.status !== 'Cancelled');

  // Period filter: include if dateRef matches period OR if no date and period is 'all'
  const filtCampaigns = activeCampaigns.filter(c => {
    const dateRef = campaignDateRef(c);
    if (!dateRef) return period === 'all';
    return inPeriod(dateRef, period);
  });

  const cashCampaigns = filtCampaigns.filter(c => !isInKind(c.invoices?.[0]?.payment_method));

  // Contracted = all cash campaigns in period (invoice or not)
  const contracted  = cashCampaigns.reduce((s, c) => s + (c.contracted_rate || 0), 0);

  // Agency paid = invoice paid
  const agencyPaid  = cashCampaigns
    .filter(c => c.invoices?.[0]?.payment_status === 'Paid')
    .reduce((s, c) => s + (c.invoices?.[0]?.invoice_amount || c.contracted_rate || 0), 0);

  // Pending receipt = not yet paid by agency (includes no invoice at all)
  const pendReceipt = cashCampaigns
    .filter(c => {
      const status = c.invoices?.[0]?.payment_status;
      // No invoice OR invoice not yet paid
      return !status || ['Not Invoiced','Invoiced','Pending'].includes(status);
    })
    .reduce((s, c) => s + (c.contracted_rate || 0), 0);

  // Paid to me = creator payout cleared
  const paidToMe    = cashCampaigns
    .filter(c => c.creator_payouts?.[0]?.payout_status === 'Paid')
    .reduce((s, c) => s + (c.creator_payouts?.[0]?.payout_amount || 0), 0);

  // Pending payout = payout exists but not paid
  const pendPayout  = cashCampaigns
    .filter(c => c.creator_payouts?.[0] && c.creator_payouts[0].payout_status !== 'Paid')
    .reduce((s, c) => s + (c.creator_payouts?.[0]?.payout_amount || 0), 0);

  // Fees = sum of processing fees on invoices
  const fees        = cashCampaigns.reduce((s, c) => s + (c.invoices?.[0]?.processing_fee || 0), 0);

  // In-kind = all in-kind campaigns in period
  const inKind      = filtCampaigns
    .filter(c => isInKind(c.invoices?.[0]?.payment_method))
    .reduce((s, c) => s + (c.invoices?.[0]?.invoice_amount ?? c.contracted_rate ?? 0), 0);

  // Rewards grouped by platform+program
  const filtRewards = rewards.filter(e => inPeriod(e.period_month, period));
  const rewardGroups = Object.values(filtRewards.reduce((groups, e) => {
    const key = `${e.platform_name || 'Platform'}||${e.program_name}`;
    if (!groups[key]) groups[key] = { platform: e.platform_name || 'Platform', program: e.program_name, entries: [] };
    groups[key].entries.push(e);
    return groups;
  }, {}));

  const cellStyle  = { padding: '12px 14px', verticalAlign: 'middle' };
  const numStyle   = (color) => ({ ...cellStyle, fontWeight: 600, color: color || 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' });
  const dimStyle   = { ...cellStyle, color: 'var(--text-muted)', textAlign: 'right' };
  const labelStyle = { ...cellStyle, fontWeight: 600, fontSize: 13 };
  const subStyle   = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, display: 'block', marginTop: 2, letterSpacing: 0.3 };

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
            <th style={thStyle}>Agency Paid</th>
            <th style={thStyle}>Pending Receipt</th>
            <th style={thStyle}>Paid to Me</th>
            <th style={thStyle}>Pending Payout</th>
            <th style={thStyle}>Fees</th>
            <th style={thStyle}>In-Kind FMV</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: rewardGroups.length > 0 ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
            <td style={labelStyle}>
              Campaign Payments
              <span style={subStyle}>Brand deals</span>
            </td>
            <td style={numStyle()}><Money v={contracted} /></td>
            <td style={numStyle('var(--green)')}><Money v={agencyPaid} color="var(--green)" /></td>
            <td style={numStyle('var(--orange)')}><Money v={pendReceipt} color="var(--orange)" /></td>
            <td style={numStyle('var(--accent)')}><Money v={paidToMe} color="var(--accent)" /></td>
            <td style={numStyle('var(--orange)')}><Money v={pendPayout} color="var(--orange)" /></td>
            <td style={numStyle('var(--red)')}><Money v={fees} color="var(--red)" /></td>
            <td style={{ ...dimStyle, fontStyle: 'italic' }}><Money v={inKind} dim /></td>
          </tr>

          {rewardGroups.map((g, i) => {
            const gross    = g.entries.reduce((s, e) => s + (e.gross_amount || 0), 0);
            const recvd    = g.entries.filter(e => e.you_received).reduce((s, e) => s + Math.max(0, (e.amount_received || e.invoice_amount || 0) - (e.processing_fee || 0)), 0);
            const pendRcpt = g.entries.filter(e => !e.you_received).reduce((s, e) => s + (e.gross_amount || 0), 0);
            const paid     = g.entries.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
            const pend     = g.entries.filter(e => e.payout_status !== 'Paid').reduce((s, e) => s + (e.gross_amount || 0), 0);
            const rgFees   = g.entries.reduce((s, e) => s + (e.processing_fee || 0), 0);
            const isLast   = i === rewardGroups.length - 1;
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

          {rewardGroups.length > 0 && (() => {
            const tGross    = contracted + rewardGroups.reduce((s, g) => s + g.entries.reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
            const tRecvd    = agencyPaid + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.you_received).reduce((ss, e) => ss + Math.max(0, (e.amount_received || e.invoice_amount || 0) - (e.processing_fee || 0)), 0), 0);
            const tPendRcpt = pendReceipt + rewardGroups.reduce((s, g) => s + g.entries.filter(e => !e.you_received).reduce((ss, e) => ss + (e.gross_amount || 0), 0), 0);
            const tPaid     = paidToMe   + rewardGroups.reduce((s, g) => s + g.entries.filter(e => e.payout_status === 'Paid').reduce((ss, e) => ss + (e.payout_amount || 0), 0), 0);
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

export default function CreatorOverview({ setActiveView, navigateToCampaign, refreshKey }) {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [allRewards, setAllRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(lastMonth());

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (refreshKey > 0) fetchData(); }, [refreshKey]);

  async function fetchData() {
    const [{ data }, rewardsRes] = await Promise.all([
      supabase
        .from('campaigns')
        .select(`
          *, agency:agencies(name),
          campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name), revision_rounds(*)),
          invoices(payment_status, invoice_amount, payment_method, you_received_date, invoice_date, processing_fee),
          creator_payouts(payout_status, payout_amount, payout_date)
        `)
        .eq('creator_profile_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('reward_payout_summary').select('*').eq('profile_id', profile.id),
    ]);
    setCampaigns(data || []);
    setAllRewards(rewardsRes.data || []);
    setLoading(false);
  }

  const active   = campaigns.filter(c => c.status === 'Active');
  const upcoming = campaigns.filter(c => c.status === 'Confirmed');

  const needsAction = campaigns.flatMap(c =>
    (c.campaign_deliverables || [])
      .filter(d =>
        ['Not Started', 'Revisions Requested'].includes(d.draft_status) &&
        c.status !== 'Cancelled' && c.status !== 'Completed'
      )
      .map(d => ({ ...d, campaign: c }))
  );

  const soon = campaigns.flatMap(c =>
    (c.campaign_deliverables || [])
      .filter(d => {
        if (!d.contracted_post_date || d.draft_status === 'Posted') return false;
        try {
          const dt = parseISO(d.contracted_post_date);
          return isWithinInterval(dt, { start: new Date(), end: addDays(new Date(), 14) });
        } catch { return false; }
      })
      .map(d => ({ ...d, campaign: c }))
  ).sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1);

  const campaignMonths = [...new Set(campaigns.flatMap(c => c.creator_payouts || []).map(p => p.payout_date?.slice(0,7)).filter(Boolean))].sort().reverse();
  const rewardMonths   = [...new Set(allRewards.map(e => e.period_month?.slice(0,7)).filter(Boolean))].sort().reverse();
  const allMonths      = [...new Set([...campaignMonths, ...rewardMonths])].sort().reverse();

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">HEY, {(profile?.creator_name || profile?.full_name || '').toUpperCase()}</div>
          <div className="page-subtitle">Here's what needs your attention</div>
        </div>
        <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={period} onChange={e => setPeriod(e.target.value)}>
          {buildPeriodOptions(allMonths).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* KPI tiles — keep count tiles, drop money tiles */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-value stat-accent">{active.length}</div>
          <div className="stat-label">Active Campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{upcoming.length}</div>
          <div className="stat-label">Confirmed Upcoming</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-orange">{needsAction.length}</div>
          <div className="stat-label">Need Action</div>
        </div>
      </div>

      {/* Financial summary table */}
      <CreatorFinancialTable campaigns={campaigns} rewards={allRewards} period={period} />

      {/* Needs action */}
      {needsAction.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'rgba(255,156,58,0.3)' }}>
          <div className="card-title" style={{ color: 'var(--orange)', marginBottom: 12 }}>⚠ NEEDS YOUR ATTENTION</div>
          {Object.values(
            needsAction.reduce((groups, d) => {
              const key = d.campaign.id;
              if (!groups[key]) groups[key] = { campaign: d.campaign, items: [] };
              groups[key].items.push(d);
              return groups;
            }, {})
          ).map(({ campaign, items }) => (
            <div key={campaign.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, cursor: 'pointer' }} onClick={() => navigateToCampaign(campaign.id)}>
                {campaign.campaign_name}
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{campaign.brand_name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--orange)' }}>→</span>
              </div>
              {items.map(d => (
                <div key={d.id} className="flex items-center justify-between" style={{ padding: '6px 0 6px 12px', borderLeft: '2px solid rgba(255,156,58,0.3)' }}>
                  <div className="text-muted text-sm">{d.platform?.name}{d.deliverable_type?.name ? ` · ${d.deliverable_type.name}` : ''}</div>
                  <div className="flex items-center gap-12">
                    <Badge status={d.draft_status} />
                    {d.contracted_post_date && <span className="text-sm text-muted">Due {fmtDate(d.contracted_post_date)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <button className="btn btn-secondary btn-sm mt-4" onClick={() => setActiveView('campaigns')}>Go to Campaigns →</button>
        </div>
      )}

      {/* Upcoming deadlines */}
      {soon.length > 0 && (
        <div className="card mb-16">
          <div className="card-title" style={{ marginBottom: 12 }}>POSTING IN THE NEXT 14 DAYS</div>
          {soon.map(d => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{d.campaign.campaign_name}</div>
                <div className="text-muted text-sm">{d.platform?.name} · {d.deliverable_type?.name}</div>
              </div>
              <div className="flex items-center gap-12">
                <Badge status={d.draft_status} />
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmtDate(d.contracted_post_date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active campaigns */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>ACTIVE CAMPAIGNS</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th><th>Brand</th><th>Agency</th><th>Posts</th><th>Next Deadline</th><th>Progress</th><th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {active.map(c => {
                  const deliverables = c.campaign_deliverables || [];
                  const posted = deliverables.filter(d => d.draft_status === 'Posted').length;
                  const total  = deliverables.length;
                  const nextDeadline = deliverables.filter(d => d.contracted_post_date && d.draft_status !== 'Posted').sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1)[0];
                  const inv    = c.invoices?.[0];
                  const payout = c.creator_payouts?.[0];
                  const inKind = isInKind(inv?.payment_method);
                  return (
                    <tr key={c.id} onClick={() => navigateToCampaign(c.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500 }}>{c.campaign_name}</td>
                      <td>{c.brand_name}</td>
                      <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                      <td style={{ fontWeight: 500, textAlign: 'center' }}>
                        {total > 0 ? <span style={{ color: posted === total ? 'var(--green)' : 'var(--text)' }}>{posted}/{total}</span> : <span className="text-muted">—</span>}
                      </td>
                      <td>{nextDeadline ? <span style={{ fontWeight: 500 }}>{fmtDate(nextDeadline.contracted_post_date)}</span> : <span className="text-muted">—</span>}</td>
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
                      <td>
                        {inKind ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>In Kind</span>
                          : payout?.payout_status ? <Badge status={payout.payout_status} />
                          : inv?.payment_status ? <Badge status={inv.payment_status} />
                          : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming confirmed */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>CONFIRMED UPCOMING</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Campaign</th><th>Brand</th><th>Agency</th><th>Posts</th><th>Starts</th><th>Rate</th></tr></thead>
              <tbody>
                {upcoming.map(c => (
                  <tr key={c.id} onClick={() => navigateToCampaign(c.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{c.campaign_name}</td>
                    <td>{c.brand_name}</td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td>{c.campaign_deliverables?.length || <span className="text-muted">—</span>}</td>
                    <td>{fmtDate(c.campaign_start_date) || <span className="text-muted">—</span>}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {isInKind(c.invoices?.[0]?.payment_method)
                        ? <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>In Kind</span>
                        : fmtMoney(c.contracted_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {needsAction.length === 0 && soon.length === 0 && active.length === 0 && upcoming.length === 0 && (
        <div className="card">
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">All caught up</div>
            <div className="empty-state-text">No immediate action needed</div>
          </div>
        </div>
      )}
    </div>
  );
}
