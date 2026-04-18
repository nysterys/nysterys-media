import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import { fmtDate } from '../../utils/format';
import { format, parseISO, isPast, isWithinInterval, addDays } from 'date-fns';

export default function CreatorOverview({ setActiveView }) {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    const { data } = await supabase
      .from('campaigns')
      .select(`
        *, agency:agencies(name),
        campaign_deliverables(*, platform:platforms(name), deliverable_type:deliverable_types(name), revision_rounds(*)),
        invoices(payment_status, invoice_amount)
      `)
      .eq('creator_profile_id', profile.id)
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  }

  

  const active = campaigns.filter(c => c.status === 'Active');
  const upcoming = campaigns.filter(c => c.status === 'Confirmed');
  const totalEarned = campaigns
    .filter(c => c.invoices?.[0]?.payment_status === 'Paid')
    .reduce((s, c) => s + (c.invoices[0].invoice_amount || 0), 0);

  // Deliverables needing action: draft not submitted or revisions requested
  const needsAction = campaigns.flatMap(c =>
    (c.campaign_deliverables || [])
      .filter(d => ['Not Started', 'Revisions Requested'].includes(d.draft_status) && c.status !== 'Cancelled' && c.status !== 'Completed')
      .map(d => ({ ...d, campaign: c }))
  );

  // Upcoming post deadlines in next 14 days
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

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">HEY, {(profile?.creator_name || profile?.full_name || '').toUpperCase()}</div>
          <div className="page-subtitle">Here's what needs your attention</div>
        </div>
      </div>

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
          <div className="stat-value stat-green">${totalEarned.toLocaleString()}</div>
          <div className="stat-label">Total Paid to You</div>
        </div>
      </div>

      {needsAction.length > 0 && (
        <div className="card mb-16" style={{ borderColor: 'rgba(255,156,58,0.3)' }}>
          <div className="card-title" style={{ color: 'var(--orange)' }}>⚠ NEEDS YOUR ATTENTION</div>
          {needsAction.map(d => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{d.campaign.campaign_name}</div>
                <div className="text-muted text-sm">{d.platform?.name} · {d.campaign.brand_name}</div>
              </div>
              <div className="flex items-center gap-12">
                <Badge status={d.draft_status} />
                {d.contracted_post_date && (
                  <span className="text-sm text-muted">Due {fmtDate(d.contracted_post_date)}</span>
                )}
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm mt-12" onClick={() => setActiveView('campaigns')}>Go to Campaigns →</button>
        </div>
      )}

      {soon.length > 0 && (
        <div className="card mb-16">
          <div className="card-title">POSTING IN THE NEXT 14 DAYS</div>
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

      {needsAction.length === 0 && soon.length === 0 && (
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
