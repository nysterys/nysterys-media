import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney } from '../../utils/format';
import { parseISO, isWithinInterval, addDays } from 'date-fns';

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}

function lastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildPeriodOptions(months) {
  return [
    { value: 'all', label: 'All time' },
    { value: 'ytd', label: 'Year to date' },
    { value: 'lastyear', label: 'Last year' },
    ...months.map(m => ({ value: m, label: new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })),
  ];
}

function inPeriod(dateStr, period) {
  if (!dateStr) return period === 'all';
  if (period === 'all') return true;
  if (period === 'ytd') return dateStr.startsWith(String(new Date().getFullYear()));
  if (period === 'lastyear') return dateStr.startsWith(String(new Date().getFullYear() - 1));
  return dateStr.startsWith(period);
}

export default function CreatorOverview({ setActiveView, navigateToCampaign, refreshKey }) {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [allRewards, setAllRewards] = useState([]);
  const [rewardsPaid, setRewardsPaid] = useState(0);
  const [period, setPeriod] = useState(lastMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (refreshKey > 0) fetchData(); }, [refreshKey]);

  async function fetchData() {
    const [{ data }, rewardsRes] = await Promise.all([
      supabase
      .from('campaigns')
      .select(`
        *, agency:agencies(name),
        campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name), revision_rounds(*)),
        invoices(payment_status, invoice_amount, payment_method),
        creator_payouts(payout_status, payout_amount, payout_date)
      `)
      .eq('creator_profile_id', profile.id)
      .order('created_at', { ascending: false }),
      supabase.from('reward_payout_summary').select('payout_status, payout_amount').eq('profile_id', profile.id),
    ]);
    setCampaigns(data || []);
    const rPaid = (rewardsRes.data || []).filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
    setAllRewards(rewardsRes.data || []);
    setRewardsPaid(rPaid);
    setLoading(false);
  }

  const active    = campaigns.filter(c => c.status === 'Active');
  const upcoming  = campaigns.filter(c => c.status === 'Confirmed');

  // Total paid = sum of cleared cash payouts (exclude in-kind)
  const totalEarned = campaigns.reduce((sum, c) => {
    const inv = c.invoices?.[0];
    if (isInKind(inv?.payment_method)) return sum;
    const payout = c.creator_payouts?.[0];
    if (payout?.payout_status === 'Paid') return sum + (payout.payout_amount || 0);
    return sum;
  }, 0);

  // Deliverables needing action
  const needsAction = campaigns.flatMap(c =>
    (c.campaign_deliverables || [])
      .filter(d =>
        ['Not Started', 'Revisions Requested'].includes(d.draft_status) &&
        c.status !== 'Cancelled' && c.status !== 'Completed'
      )
      .map(d => ({ ...d, campaign: c }))
  );

  // Upcoming deadlines in next 14 days
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

  // Campaign months from payout dates
  const campaignMonths = [...new Set(campaigns.flatMap(c => c.creator_payouts || []).map(p => p.payout_date?.slice(0,7)).filter(Boolean))].sort().reverse();
  const rewardMonths = [...new Set(allRewards.map(e => e.period_month?.slice(0,7)).filter(Boolean))].sort().reverse();

  // Period-filtered totals
  const filteredEarned = campaigns.filter(c => {
    const p = c.creator_payouts?.[0];
    return p?.payout_status === 'Paid' && inPeriod(p?.payout_date, period);
  }).reduce((s, c) => {
    const inv = c.invoices?.[0];
    if (isInKind(inv?.payment_method)) return s;
    return s + (c.creator_payouts?.[0]?.payout_amount || 0);
  }, 0);

  const filteredRewardsPaid = allRewards.filter(e =>
    e.payout_status === 'Paid' && inPeriod(e.period_month, period)
  ).reduce((s, e) => s + (e.payout_amount || 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">HEY, {(profile?.creator_name || profile?.full_name || '').toUpperCase()}</div>
          <div className="page-subtitle">Here's what needs your attention</div>
        </div>
        <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={period} onChange={e => setPeriod(e.target.value)}>
          {buildPeriodOptions([...new Set([...campaignMonths, ...rewardMonths])].sort().reverse()).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* KPI tiles */}
      <div className="stats-row">
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
        <div className="stat-card">
          <div className="stat-value stat-green">{fmtMoney(filteredEarned)}</div>
          <div className="stat-label">Campaign Earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-green">{fmtMoney(filteredRewardsPaid)}</div>
          <div className="stat-label">Rewards Paid to Me</div>
        </div>
      </div>

      {/* Needs action — grouped by campaign */}
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
              <div
                style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}
                onClick={() => navigateToCampaign(campaign.id)}
              >
                {campaign.campaign_name}
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{campaign.brand_name}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--orange)' }}>→</span>
              </div>
              {items.map(d => (
                <div key={d.id} className="flex items-center justify-between" style={{ padding: '6px 0 6px 12px', borderLeft: '2px solid rgba(255,156,58,0.3)' }}>
                  <div className="text-muted text-sm">{d.platform?.name}{d.deliverable_type?.name ? ` · ${d.deliverable_type.name}` : ''}</div>
                  <div className="flex items-center gap-12">
                    <Badge status={d.draft_status} />
                    {d.contracted_post_date && (
                      <span className="text-sm text-muted">Due {fmtDate(d.contracted_post_date)}</span>
                    )}
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

      {/* Active campaigns table */}
      {active.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>
            ACTIVE CAMPAIGNS
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Brand</th>
                  <th>Agency</th>
                  <th>Posts</th>
                  <th>Next Deadline</th>
                  <th>Progress</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {active.map(c => {
                  const deliverables = c.campaign_deliverables || [];
                  const posted = deliverables.filter(d => d.draft_status === 'Posted').length;
                  const total = deliverables.length;
                  const nextDeadline = deliverables
                    .filter(d => d.contracted_post_date && d.draft_status !== 'Posted')
                    .sort((a, b) => a.contracted_post_date > b.contracted_post_date ? 1 : -1)[0];
                  const inv = c.invoices?.[0];
                  const payout = c.creator_payouts?.[0];
                  const inKind = isInKind(inv?.payment_method);
                  return (
                    <tr key={c.id} onClick={() => navigateToCampaign(c.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500 }}>{c.campaign_name}</td>
                      <td>{c.brand_name}</td>
                      <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                      <td>{total > 0 ? `${posted}/${total}` : <span className="text-muted">—</span>}</td>
                      <td>
                        {nextDeadline
                          ? <span style={{ fontWeight: 500 }}>{fmtDate(nextDeadline.contracted_post_date)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
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
                        {inKind
                          ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>In Kind</span>
                          : payout?.payout_status
                            ? <Badge status={payout.payout_status} />
                            : inv?.payment_status
                              ? <Badge status={inv.payment_status} />
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

      {/* Upcoming confirmed campaigns */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>
            CONFIRMED UPCOMING
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Brand</th>
                  <th>Agency</th>
                  <th>Posts</th>
                  <th>Starts</th>
                  <th>Rate</th>
                </tr>
              </thead>
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

      {/* All clear */}
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
