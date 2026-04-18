import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate, fmtMoney } from '../../utils/format';

function SplitStatusBadge({ status }) {
  const map = { 'Pending': 'badge-not-invoiced', 'Sent': 'badge-invoiced', 'Cleared': 'badge-paid', 'Failed': 'badge-overdue' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status}</span>;
}

export default function CreatorRewards() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [splitsByPayoutId, setSplitsByPayoutId] = useState({});
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data: rewardData } = await supabase
      .from('reward_payout_summary')
      .select('*')
      .eq('profile_id', profile.id)
      .order('period_month', { ascending: false });

    const entries = rewardData || [];

    const payoutIds = entries.map(e => e.payout_id).filter(Boolean);
    let splitsByPayoutId = {};
    if (payoutIds.length > 0) {
      const { data: splits } = await supabase
        .from('payout_splits')
        .select('*, destination:payment_destinations(name, account_type, account_last4, institution, memo)')
        .in('payout_id', payoutIds);
      (splits || []).forEach(s => {
        if (!splitsByPayoutId[s.payout_id]) splitsByPayoutId[s.payout_id] = [];
        splitsByPayoutId[s.payout_id].push(s);
      });
    }

    setEntries(entries);
    setSplitsByPayoutId(splitsByPayoutId);
    setLoading(false);
  }

  const months = [...new Set(entries.map(e => e.period_month?.slice(0, 7)).filter(Boolean))].sort().reverse();

  const filtered = monthFilter === 'all'
    ? entries
    : entries.filter(e => e.period_month?.startsWith(monthFilter));

  const totalEarned  = filtered.reduce((s, e) => s + (e.gross_amount || 0), 0);
  const totalPaid    = filtered.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
  const totalPending = filtered.filter(e => e.payout_status !== 'Paid').reduce((s, e) => s + (e.gross_amount || 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MY REWARDS</div>
          <div className="page-subtitle">Platform creator rewards program earnings</div>
        </div>
        {months.length > 0 && (
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="all">All time</option>
            {months.map(m => {
              const [y, mo] = m.split('-');
              return <option key={m} value={m}>{new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>;
            })}
          </select>
        )}
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{fmtMoney(totalEarned)}</div>
          <div className="stat-label">Total Earned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-accent" style={{ fontSize: 22 }}>{fmtMoney(totalPaid)}</div>
          <div className="stat-label">Paid to Me</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-orange" style={{ fontSize: 22 }}>{fmtMoney(totalPending)}</div>
          <div className="stat-label">Pending Payout</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">★</div>
          <div className="empty-state-title">No rewards yet</div>
          <div className="empty-state-text">Platform rewards earnings will appear here once recorded by your manager</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Program</th>
                <th>Period</th>
                <th>Gross Earned</th>
                <th>Destination</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Cleared</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const splits = splitsByPayoutId[e.payout_id] || [];
                const periodLabel = e.period_month
                  ? new Date(e.period_month + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—';

                if (splits.length === 0) {
                  return (
                    <tr key={e.entry_id} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                      <td>{e.platform_name || '—'}</td>
                      <td>{e.program_name}</td>
                      <td style={{ fontWeight: 500 }}>{periodLabel}</td>
                      <td style={{ fontWeight: 600 }}>{fmtMoney(e.gross_amount)}</td>
                      <td className="text-muted text-xs">—</td>
                      <td>{e.payout_amount != null ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(e.payout_amount)}</span> : <span className="text-muted">—</span>}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, color: e.payout_status === 'Paid' ? 'var(--green)' : 'var(--orange)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{e.payout_status || 'Pending'}</span></td>
                      <td className="text-muted">—</td>
                      <td className="text-muted">—</td>
                    </tr>
                  );
                }

                return splits.map((s, i) => {
                  const dest = s.destination;
                  const statusColor = s.split_status === 'Cleared' ? 'var(--green)' : s.split_status === 'Sent' ? 'var(--accent)' : s.split_status === 'Failed' ? 'var(--red)' : 'var(--text-muted)';
                  const destSubline = dest?.account_type === 'Other'
                    ? (s.notes || e.payout_notes || 'Other')
                    : `${dest?.account_type || ''}${dest?.account_last4 ? ` ···${dest.account_last4}` : ''}${dest?.institution ? ` · ${dest.institution}` : ''}`;

                  return (
                    <tr key={`${e.entry_id}-${s.id}`} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                      {i === 0 ? (
                        <>
                          <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14 }}>{e.platform_name || '—'}</td>
                          <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14 }}>{e.program_name}</td>
                          <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14, fontWeight: 500 }}>{periodLabel}</td>
                          <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14, fontWeight: 600 }}>{fmtMoney(e.gross_amount)}</td>
                        </>
                      ) : null}
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 12 }}>{dest?.name || 'Unknown'}</div>
                        <div className="text-muted" style={{ fontSize: 10 }}>{destSubline}</div>
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(s.amount)}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.split_status}</span></td>
                      <td style={{ fontSize: 12 }}>{s.sent_date ? fmtDate(s.sent_date) : <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 12, color: s.cleared_date ? 'var(--green)' : 'var(--text-muted)' }}>
                        {s.cleared_date ? `✓ ${fmtDate(s.cleared_date)}` : '—'}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <RewardDetailPanel entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ============================================================
// Reward Detail Panel — read-only for creator
// ============================================================
function RewardDetailPanel({ entry, onClose }) {
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSplits(); }, [entry.payout_id]);

  async function fetchSplits() {
    setLoading(true);
    if (entry.payout_id) {
      const { data } = await supabase
        .from('payout_splits')
        .select('*, destination:payment_destinations(name, account_type, account_last4, institution, memo)')
        .eq('payout_id', entry.payout_id);
      setSplits(data || []);
    } else {
      setSplits([]);
    }
    setLoading(false);
  }

  const periodLabel = entry.period_month
    ? new Date(entry.period_month + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="flex items-center justify-between mb-8">
          <span className="text-muted text-xs">{entry.platform_name}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 1 }}>{entry.program_name}</div>
        <div className="text-muted mt-4">{periodLabel}</div>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18, marginTop: 8 }}>{fmtMoney(entry.gross_amount)}</div>
      </div>

      <div className="detail-body">
        {loading ? <div className="text-muted">Loading...</div> : (
          <>
            <div className="detail-section">
              <div className="detail-section-title">PLATFORM PAYMENT</div>
              <div className="detail-grid">
                <div>
                  <div className="detail-item-label">Gross Earned</div>
                  <div className="detail-item-value" style={{ fontWeight: 700 }}>{fmtMoney(entry.gross_amount)}</div>
                </div>
                <div>
                  <div className="detail-item-label">Manager Received</div>
                  <div className="detail-item-value">
                    {entry.you_received
                      ? <span style={{ color: 'var(--green)' }}>✓ {fmtDate(entry.you_received_date)}</span>
                      : <span className="text-muted">Not yet</span>}
                  </div>
                </div>
                {entry.amount_received != null && (
                  <div>
                    <div className="detail-item-label">Amount Received</div>
                    <div className="detail-item-value">{fmtMoney(entry.amount_received)}</div>
                  </div>
                )}
                {entry.processing_fee > 0 && (
                  <div>
                    <div className="detail-item-label">Processing Fee</div>
                    <div className="detail-item-value" style={{ color: 'var(--orange)' }}>{fmtMoney(entry.processing_fee)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section-title">YOUR PAYOUT</div>
              {!entry.payout_id ? (
                <div className="text-muted text-sm">Payout not yet created by your manager.</div>
              ) : (
                <>
                  <div className="detail-grid" style={{ marginBottom: 16 }}>
                    <div>
                      <div className="detail-item-label">Total Payout</div>
                      <div className="detail-item-value" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>{fmtMoney(entry.payout_amount)}</div>
                    </div>
                    <div>
                      <div className="detail-item-label">Status</div>
                      <div className="detail-item-value">
                        <span style={{ fontSize: 11, fontWeight: 600, color: entry.payout_status === 'Paid' ? 'var(--green)' : 'var(--orange)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {entry.payout_status || 'Pending'}
                        </span>
                      </div>
                    </div>
                    {entry.payout_date && (
                      <div>
                        <div className="detail-item-label">Payout Date</div>
                        <div className="detail-item-value">{fmtDate(entry.payout_date)}</div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>
                    DESTINATION BREAKDOWN
                  </div>

                  {splits.length === 0 ? (
                    <div className="text-muted text-sm">No splits recorded yet.</div>
                  ) : splits.map(s => {
                    const dest = s.destination;
                    return (
                      <div key={s.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', marginBottom: 10 }}>
                        <div className="flex items-center justify-between mb-10">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{dest?.name || 'Unknown destination'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {dest?.account_type === 'Other'
                                ? s.notes ? s.notes.slice(0, 50) + (s.notes.length > 50 ? '…' : '') : 'Other'
                                : `${dest?.account_type || ''}${dest?.account_last4 ? ` ···${dest.account_last4}` : ''}${dest?.institution ? ` · ${dest.institution}` : ''}`}
                            </div>
                          </div>
                          <SplitStatusBadge status={s.split_status} />
                        </div>
                        <div className="detail-grid">
                          <div>
                            <div className="detail-item-label">Percentage</div>
                            <div className="detail-item-value">{s.percentage}%</div>
                          </div>
                          <div>
                            <div className="detail-item-label">Amount</div>
                            <div className="detail-item-value" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{fmtMoney(s.amount)}</div>
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
                              <div className="detail-item-value font-mono text-sm">{s.reference}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {splits.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 13, color: 'var(--text-muted)', marginTop: 8, gap: 12 }}>
                      <span>Total across {splits.length} destinations:</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                        {fmtMoney(splits.reduce((s, sp) => s + (sp.amount || 0), 0))}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
