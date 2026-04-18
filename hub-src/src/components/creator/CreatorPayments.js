import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney, fmtMonth, extractMonths } from '../../utils/format';

function PayoutBadge({ status }) {
  const map = { 'Pending': 'badge-not-invoiced', 'Partial': 'badge-pending', 'Paid': 'badge-paid', 'On Hold': 'badge-overdue', 'N/A': 'badge-not-invoiced' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status || 'Pending'}</span>;
}

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}

function SplitStatusBadge({ status }) {
  const map = { 'Pending': 'badge-not-invoiced', 'Sent': 'badge-invoiced', 'Cleared': 'badge-paid', 'Failed': 'badge-overdue' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status}</span>;
}

export default function CreatorPayments() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data } = await supabase
      .from('campaign_payout_summary')
      .select('*')
      .eq('creator_profile_id', profile.id)
      .order('invoice_date', { ascending: false, nullsFirst: false });
    setRows(data || []);
    setLoading(false);
  }

  const months = extractMonths(rows, 'invoice_date');

  const filtered = rows.filter(r => {
    if (payoutFilter !== 'all' && (r.payout_status || 'Pending') !== payoutFilter) return false;
    if (monthFilter !== 'all' && r.invoice_date && !r.invoice_date.startsWith(monthFilter)) return false;
    return true;
  });

  // Monthly summary for selected month or all time
  const monthRows = monthFilter !== 'all' ? rows.filter(r => r.invoice_date?.startsWith(monthFilter)) : rows;
  const monthContracted = monthRows.reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const monthPaidOut = monthRows.filter(r => r.payout_status === 'Paid' && !isInKind(r.payment_method)).reduce((s, r) => s + (r.payout_amount || 0), 0);
  const monthPending = monthRows.filter(r => r.payout_status !== 'Paid' && r.payout_status !== 'N/A' && !isInKind(r.payment_method)).reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const monthCleared = monthRows.reduce((s, r) => s + (r.splits_cleared > 0 ? 1 : 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MY PAYMENTS</div>
          <div className="page-subtitle">Earnings and payout details per campaign</div>
        </div>
        <div className="flex gap-8 items-center">
          {months.length > 0 && (
            <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
              <option value="all">All time</option>
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 22 }}>{fmtMoney(monthContracted)}</div>
          <div className="stat-label">{monthFilter !== 'all' ? fmtMonth(monthFilter).split(' ')[0] : 'All Time'} Contracted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-green" style={{ fontSize: 22 }}>{fmtMoney(monthPaidOut)}</div>
          <div className="stat-label">Paid to Me</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-orange" style={{ fontSize: 22 }}>{fmtMoney(monthPending)}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>

      {/* Payout filter */}
      <div className="filters-row">
        {['all', 'Pending', 'Partial', 'Paid', 'On Hold', 'N/A'].map(s => (
          <button key={s} className={`filter-chip ${payoutFilter === s ? 'active' : ''}`} onClick={() => setPayoutFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No payments to show</div>
          <div className="empty-state-text">Payments will appear here once your manager sets them up</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Contracted</th>
                <th>Agency Paid</th>
                <th>My Payout</th>
                <th>Payout Status</th>
                <th>Destinations</th>
                <th>Payout Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.campaign_id} onClick={() => setSelected(r)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                    <div className="text-muted text-xs">{r.brand_name} · {r.agency_name || '—'}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtMoney(r.contracted_rate)}</td>
                  <td>
                    <Badge status={r.agency_payment_status || 'Not Invoiced'} />
                  </td>
                  <td>
                    {isInKind(r.payment_method)
                      ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>{fmtMoney(r.invoice_amount || r.contracted_rate)} (in kind)</span>
                      : r.payout_amount != null
                        ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(r.payout_amount)}</span>
                        : <span className="text-muted">—</span>}
                  </td>
                  <td><PayoutBadge status={isInKind(r.payment_method) ? 'N/A' : (r.payout_status || 'Pending')} /></td>
                  <td>
                    {isInKind(r.payment_method)
                      ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>N/A</span>
                      : r.split_count > 0
                        ? <span className="text-sm" style={{ color: r.splits_cleared === r.split_count ? 'var(--green)' : 'var(--text-muted)' }}>
                            {r.splits_cleared}/{r.split_count} cleared
                          </span>
                        : <span className="text-muted text-xs">—</span>}
                  </td>
                  <td>{fmtDate(r.payout_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CreatorPaymentDetail
          row={selected}
          profileId={profile.id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Creator Payment Detail Panel - read-only, full detail
// ============================================================
function CreatorPaymentDetail({ row, profileId, onClose }) {
  const [payout, setPayout] = useState(null);
  const [splits, setSplits] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDetail(); }, [row.campaign_id]);

  async function fetchDetail() {
    setLoading(true);
    const [payoutRes, invRes] = await Promise.all([
      supabase
        .from('creator_payouts')
        .select('*, payout_splits(*, destination:payment_destinations(name, account_type, account_last4, institution))')
        .eq('campaign_id', row.campaign_id)
        .maybeSingle(),
      supabase.from('invoices').select('payment_status, invoice_date, invoice_amount, amount_received, processing_fee, you_received, you_received_date, payment_method').eq('campaign_id', row.campaign_id).maybeSingle(),
    ]);
    setPayout(payoutRes.data || null);
    setSplits(payoutRes.data?.payout_splits || []);
    setInvoice(invRes.data || null);
    setLoading(false);
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="flex items-center justify-between mb-8">
          <span className="text-muted text-xs">{row.agency_name || 'No agency'}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 1 }}>{row.campaign_name}</div>
        <div className="text-muted mt-4">{row.brand_name}</div>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 20, marginTop: 8 }}>{fmtMoney(row.contracted_rate)}</div>
        <div className="mt-8">
          <Badge status={row.agency_payment_status || 'Not Invoiced'} />
        </div>
      </div>

      <div className="detail-body">
        {loading ? <div className="text-muted">Loading...</div> : (
          <>
            {/* Agency payment status */}
            <div className="detail-section">
              <div className="detail-section-title">AGENCY PAYMENT</div>
              <div className="detail-grid">
                <div>
                  <div className="detail-item-label">Status</div>
                  <div className="detail-item-value"><Badge status={invoice?.payment_status || 'Not Invoiced'} /></div>
                </div>
                <div>
                  <div className="detail-item-label">
                    {isInKind(invoice?.payment_method) ? 'Fair Value (In Kind)' : 'Invoice Amount'}
                  </div>
                  <div className="detail-item-value" style={{ fontWeight: 600 }}>{fmtMoney(invoice?.invoice_amount)}</div>
                </div>
                {isInKind(invoice?.payment_method) ? (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
                      In-kind compensation. Fair value tracked for tax purposes. No cash received.
                    </div>
                  </div>
                ) : invoice?.you_received ? (
                  <>
                    <div>
                      <div className="detail-item-label">Received by Manager</div>
                      <div className="detail-item-value" style={{ color: 'var(--green)' }}>✓ {fmtDate(invoice.you_received_date)}</div>
                    </div>
                    <div>
                      <div className="detail-item-label">Amount Received</div>
                      <div className="detail-item-value">{fmtMoney(invoice.amount_received)}</div>
                    </div>
                    {invoice.processing_fee > 0 && (
                      <div>
                        <div className="detail-item-label">Processing Fee</div>
                        <div className="detail-item-value" style={{ color: 'var(--orange)' }}>{fmtMoney(invoice.processing_fee)}</div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {/* Payout */}
            <div className="detail-section">
              <div className="detail-section-title">YOUR PAYOUT</div>
              {isInKind(invoice?.payment_method) ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', lineHeight: 1.7,
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Campaign</div>
                  This campaign was compensated in kind. No cash payout applies.
                </div>
              ) : !payout ? (
                <div className="text-muted text-sm">Payout not yet created by your manager.</div>
              ) : (
                <>
                  <div className="detail-grid" style={{ marginBottom: 16 }}>
                    <div>
                      <div className="detail-item-label">Total Payout</div>
                      <div className="detail-item-value" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18 }}>{fmtMoney(payout.payout_amount)}</div>
                    </div>
                    <div>
                      <div className="detail-item-label">Status</div>
                      <div className="detail-item-value"><PayoutBadge status={payout.payout_status} /></div>
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

                  {/* Destination splits */}
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>
                    DESTINATION BREAKDOWN
                  </div>

                  {splits.length === 0 ? (
                    <div className="text-muted text-sm">No splits recorded yet.</div>
                  ) : (
                    splits.map((s, i) => {
                      const dest = s.destination;
                      return (
                        <div key={s.id} style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '14px 16px',
                          marginBottom: 10,
                        }}>
                          <div className="flex items-center justify-between mb-10">
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>
                                {dest?.name || 'Unknown destination'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {dest?.account_type}
                                {dest?.account_last4 ? ` ···${dest.account_last4}` : ''}
                                {dest?.institution ? ` · ${dest.institution}` : ''}
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
                              <div className="detail-item-value" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>
                                {fmtMoney(s.amount)}
                              </div>
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
                    })
                  )}

                  {/* Total verification */}
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
