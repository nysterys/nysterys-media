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
  const [splitsByPayoutId, setSplitsByPayoutId] = useState({});
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data: summaryData } = await supabase
      .from('campaign_payout_summary')
      .select('*')
      .eq('creator_profile_id', profile.id)
      .order('invoice_date', { ascending: false, nullsFirst: false });

    const rows = summaryData || [];

    const payoutIds = rows.map(r => r.payout_id).filter(Boolean);
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

    setRows(rows);
    setSplitsByPayoutId(splitsByPayoutId);
    setLoading(false);
  }

  const months = extractMonths(rows, 'invoice_date');

  const filtered = rows.filter(r => {
    if (payoutFilter !== 'all' && (r.payout_status || 'Pending') !== payoutFilter) return false;
    if (monthFilter !== 'all' && r.invoice_date && !r.invoice_date.startsWith(monthFilter)) return false;
    return true;
  });

  const totalContracted    = filtered.reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const totalAgencyPaid    = filtered.filter(r => !isInKind(r.payment_method) && r.agency_payment_status === 'Paid').reduce((s, r) => s + (r.invoice_amount || r.contracted_rate || 0), 0);
  const totalPaidToMe      = filtered.filter(r => !isInKind(r.payment_method) && r.payout_status === 'Paid').reduce((s, r) => s + (r.payout_amount || 0), 0);
  const totalAgencyPending = filtered.filter(r => !isInKind(r.payment_method) && ['Not Invoiced', 'Invoiced', 'Pending'].includes(r.agency_payment_status)).reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const totalPayoutPending = filtered.filter(r => !isInKind(r.payment_method) && r.payout_status !== 'Paid' && r.payout_status !== 'N/A').reduce((s, r) => s + (r.payout_amount || r.contracted_rate || 0), 0);
  const totalFees          = filtered.filter(r => !isInKind(r.payment_method)).reduce((s, r) => s + (r.processing_fee || 0), 0);
  const totalInKind        = filtered.filter(r => isInKind(r.payment_method)).reduce((s, r) => s + (r.invoice_amount ?? r.contracted_rate ?? 0), 0);

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

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 18 }}>{fmtMoney(totalContracted)}</div><div className="stat-label">Total Contracted</div></div>
        <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 18 }}>{fmtMoney(totalAgencyPaid)}</div><div className="stat-label">Agency Paid</div></div>
        <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 18 }}>{fmtMoney(totalPaidToMe)}</div><div className="stat-label">Paid to Me</div></div>
        <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 18 }}>{fmtMoney(totalAgencyPending)}</div><div className="stat-label">Agency Pending</div></div>
        <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 18 }}>{fmtMoney(totalPayoutPending)}</div><div className="stat-label">My Payout Pending</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 18, color: totalFees > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(totalFees)}</div><div className="stat-label">Fees Paid</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 18, color: 'var(--text-muted)', fontStyle: 'italic' }}>{fmtMoney(totalInKind)}</div><div className="stat-label">In-Kind FMV</div></div>
      </div>

      <div className="filters-row">
        {['all', 'Pending', 'Partial', 'Paid', 'On Hold', 'N/A'].map(s => (
          <button key={s} className={`filter-chip ${payoutFilter === s ? 'active' : ''}`} onClick={() => setPayoutFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {filtered.filter(r => !isInKind(r.payment_method)).length === 0 && filtered.filter(r => isInKind(r.payment_method)).length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No payments to show</div>
          <div className="empty-state-text">Payments will appear here once your manager sets them up</div>
        </div>
      ) : (
        <>
          {filtered.filter(r => !isInKind(r.payment_method)).length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Contracted</th>
                    <th>Agency Paid</th>
                    <th>Destination</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Cleared</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter(r => !isInKind(r.payment_method)).map(r => {
                    const splits = splitsByPayoutId[r.payout_id] || [];

                    if (splits.length === 0) {
                      return (
                        <tr key={r.campaign_id} onClick={() => setSelected(r)}>
                          <td><div style={{ fontWeight: 500 }}>{r.campaign_name}</div><div className="text-muted text-xs">{r.brand_name} · {r.agency_name || '—'}</div></td>
                          <td style={{ fontWeight: 600 }}>{fmtMoney(r.contracted_rate)}</td>
                          <td><Badge status={r.agency_payment_status || 'Not Invoiced'} /></td>
                          <td className="text-muted text-xs">—</td>
                          <td>{r.payout_amount != null ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmtMoney(r.payout_amount)}</span> : <span className="text-muted">—</span>}</td>
                          <td><PayoutBadge status={r.payout_status || 'Pending'} /></td>
                          <td className="text-muted">—</td>
                          <td className="text-muted">—</td>
                        </tr>
                      );
                    }

                    return splits.map((s, i) => {
                      const dest = s.destination;
                      const statusColor = s.split_status === 'Cleared' ? 'var(--green)' : s.split_status === 'Sent' ? 'var(--accent)' : s.split_status === 'Failed' ? 'var(--red)' : 'var(--text-muted)';
                      return (
                        <tr key={`${r.campaign_id}-${s.id}`} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                          {i === 0 ? (
                            <>
                              <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14 }}>
                                <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                                <div className="text-muted text-xs">{r.brand_name} · {r.agency_name || '—'}</div>
                              </td>
                              <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14, fontWeight: 600 }}>{fmtMoney(r.contracted_rate)}</td>
                              <td rowSpan={splits.length} style={{ verticalAlign: 'top', paddingTop: 14 }}><Badge status={r.agency_payment_status || 'Not Invoiced'} /></td>
                            </>
                          ) : null}
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 12 }}>{dest?.name || 'Unknown'}</div>
                            <div className="text-muted" style={{ fontSize: 10 }}>
                              {dest?.account_type === 'Other'
                                ? (() => {
                                    const note = s.notes || r.payout_notes;
                                    return note ? note.slice(0, 50) + (note.length > 50 ? '…' : '') : 'Other';
                                  })()
                                : `${dest?.account_type || ''}${dest?.account_last4 ? ` ···${dest.account_last4}` : ''}${dest?.institution ? ` · ${dest.institution}` : ''}`}
                            </div>
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

          {filtered.filter(r => isInKind(r.payment_method)).length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>
                IN-KIND COMPENSATION
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Brand</th>
                      <th>Agency</th>
                      <th>Fair Value</th>
                      <th>Agency Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.filter(r => isInKind(r.payment_method)).map(r => (
                      <tr key={r.campaign_id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                        <td><div style={{ fontWeight: 500 }}>{r.campaign_name}</div></td>
                        <td>{r.brand_name}</td>
                        <td>{r.agency_name || <span className="text-muted">—</span>}</td>
                        <td style={{ fontWeight: 600 }}>{fmtMoney(r.invoice_amount ?? r.contracted_rate)}</td>
                        <td><Badge status={r.agency_payment_status || 'Not Invoiced'} /></td>
                        <td><span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No cash payout</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
// Creator Payment Detail Panel - read-only
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
        .select('*, payout_splits(*, destination:payment_destinations(name, account_type, account_last4, institution, memo))')
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
        <div className="mt-8"><Badge status={row.agency_payment_status || 'Not Invoiced'} /></div>
      </div>

      <div className="detail-body">
        {loading ? <div className="text-muted">Loading...</div> : (
          <>
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

            <div className="detail-section">
              <div className="detail-section-title">YOUR PAYOUT</div>
              {isInKind(invoice?.payment_method) ? (
                <div style={{ padding: '12px 14px', borderRadius: 6, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
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

                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>
                    DESTINATION BREAKDOWN
                  </div>

                  {splits.length === 0 ? (
                    <div className="text-muted text-sm">No splits recorded yet.</div>
                  ) : (
                    splits.map(s => {
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
                    })
                  )}

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
