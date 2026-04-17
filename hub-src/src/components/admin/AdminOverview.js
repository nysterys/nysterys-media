import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminOverview({ setActiveView }) {
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    pendingPayments: 0,
    overduePayments: 0,
    totalEarned: 0,
    totalPending: 0,
    recentCampaigns: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    const [campaigns, invoices] = await Promise.all([
      supabase.from('campaigns').select('*, agency:agencies(name), creator:profiles(full_name, creator_name), invoices(payment_status, invoice_amount)').order('created_at', { ascending: false }),
      supabase.from('invoices').select('payment_status, invoice_amount'),
    ]);

    const c = campaigns.data || [];
    const inv = invoices.data || [];

    const totalEarned = inv.filter(i => i.payment_status === 'Paid').reduce((s, i) => s + (i.invoice_amount || 0), 0);
    const totalPending = inv.filter(i => ['Invoiced', 'Pending'].includes(i.payment_status)).reduce((s, i) => s + (i.invoice_amount || 0), 0);

    setStats({
      totalCampaigns: c.length,
      activeCampaigns: c.filter(x => x.status === 'Active').length,
      pendingPayments: inv.filter(i => ['Invoiced', 'Pending'].includes(i.payment_status)).length,
      overduePayments: inv.filter(i => i.payment_status === 'Overdue').length,
      totalEarned,
      totalPending,
      recentCampaigns: c.slice(0, 6),
    });
    setLoading(false);
  }

  function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

  const statusColor = (s) => {
    const map = { 'Negotiating': 'stat-accent', 'Active': 'stat-green', 'Completed': 'stat-green', 'Cancelled': 'stat-red', 'Confirmed': 'stat-accent' };
    return map[s] || '';
  };

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">OVERVIEW</div>
          <div className="page-subtitle">All campaigns across Kym and Mys</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className={`stat-value`}>{stats.totalCampaigns}</div>
          <div className="stat-label">Total Campaigns</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value stat-accent`}>{stats.activeCampaigns}</div>
          <div className="stat-label">Active Now</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value stat-green`}>{fmt(stats.totalEarned)}</div>
          <div className="stat-label">Total Paid</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value stat-orange`}>{fmt(stats.totalPending)}</div>
          <div className="stat-label">Pending Payment</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${stats.overduePayments > 0 ? 'stat-red' : ''}`}>{stats.overduePayments}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-12">
          <div className="card-title">RECENT CAMPAIGNS</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('campaigns')}>View All →</button>
        </div>
        {stats.recentCampaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-title">No campaigns yet</div>
            <div className="empty-state-text">Create your first campaign to get started</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Creator</th>
                  <th>Agency</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCampaigns.map(c => (
                  <tr key={c.id} onClick={() => setActiveView('campaigns')}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.campaign_name}</div>
                      <div className="text-muted text-xs">{c.brand_name}</div>
                    </td>
                    <td>{c.creator?.creator_name || c.creator?.full_name}</td>
                    <td>{c.agency?.name || <span className="text-muted">—</span>}</td>
                    <td>
                      {c.contracted_rate
                        ? <span style={{ color: 'var(--accent)' }}>${c.contracted_rate.toLocaleString()}</span>
                        : <span className="text-muted">TBD</span>
                      }
                    </td>
                    <td>
                      <span className={`badge badge-${c.status?.toLowerCase().replace(' ', '-')}`}>{c.status}</span>
                    </td>
                    <td>
                      {c.invoices?.[0] ? (
                        <span className={`badge badge-${c.invoices[0].payment_status?.toLowerCase().replace(' ', '-')}`}>{c.invoices[0].payment_status}</span>
                      ) : (
                        <span className="text-muted text-xs">No invoice</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
