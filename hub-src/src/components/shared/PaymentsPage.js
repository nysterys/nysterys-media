import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from './Badge';
import { fmtDate, fmtMoney, fmtMonth, extractMonths, isValidDateString, isValidNumber } from '../../utils/format';

const AGENCY_STATUSES = ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed'];
const PAYOUT_STATUSES = ['Pending', 'Partial', 'Paid', 'On Hold', 'N/A'];
const SPLIT_STATUSES  = ['Pending', 'Sent', 'Cleared', 'Failed'];

function isInKind(pm) { return (pm || '').toLowerCase() === 'in kind'; }

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  window.open(url, '_blank', `width=${w},height=${h},left=${Math.round(window.screenX+(window.outerWidth-w)/2)},top=${Math.round(window.screenY+(window.outerHeight-h)/2)},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}
async function getSignedUrl(bucket, path) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  return data?.signedUrl || null;
}

function PayoutBadge({ status }) {
  const map = { Pending: 'badge-not-invoiced', Partial: 'badge-pending', Paid: 'badge-paid', 'On Hold': 'badge-overdue' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status || 'Pending'}</span>;
}
function SplitStatusBadge({ status }) {
  const map = { Pending: 'badge-not-invoiced', Sent: 'badge-invoiced', Cleared: 'badge-paid', Failed: 'badge-overdue' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status}</span>;
}

// ── Shared sort helper ────────────────────────────────────────────────────────
function SortTh({ sortBy, sortDir, col, onToggle, children }) {
  const active = sortBy === col;
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => onToggle(col)}>
      {children}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 9 }}>
        {active && sortDir === 'desc' ? '▼' : '▲'}
      </span>
    </th>
  );
}

function useSortState(defaultCol, defaultDir = 'asc') {
  const [sortBy, setSortBy] = useState(defaultCol);
  const [sortDir, setSortDir] = useState(defaultDir);
  function toggle(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }
  function sortRows(rows, getters) {
    return [...rows].sort((a, b) => {
      const av = getters[sortBy] ? getters[sortBy](a) : '';
      const bv = getters[sortBy] ? getters[sortBy](b) : '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return { sortBy, sortDir, toggle, sortRows };
}

// ── Main exported component ───────────────────────────────────────────────────
export default function PaymentsPage({ isAdmin, creatorProfileId }) {
  const [rows, setRows]             = useState([]);
  const [creators, setCreators]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);

  const lastMonth = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [agencyFilter,  setAgencyFilter]  = useState('all');
  const [payoutFilter,  setPayoutFilter]  = useState('all');
  const [monthFilter,   setMonthFilter]   = useState(lastMonth);

  const cashSort = useSortState('invoice_date', 'desc');
  const inkSort  = useSortState('campaign');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [summaryRes, creatorsRes] = await Promise.all([
      isAdmin
        ? supabase.from('campaign_payout_summary').select('*').order('invoice_date', { ascending: false, nullsFirst: false })
        : supabase.from('campaign_payout_summary').select('*').eq('creator_profile_id', creatorProfileId).order('invoice_date', { ascending: false, nullsFirst: false }),
      isAdmin
        ? supabase.from('profiles').select('*').eq('role', 'creator')
        : Promise.resolve({ data: [] }),
    ]);
    setRows(summaryRes.data || []);
    setCreators(creatorsRes.data || []);
    setLoading(false);
  }

  const months = extractMonths(rows, 'invoice_date');

  // All filters apply to both tables
  const filtered = rows.filter(r => {
    if (isAdmin && creatorFilter !== 'all' && r.creator_profile_id !== creatorFilter) return false;
    if (agencyFilter  !== 'all' && r.agency_payment_status !== agencyFilter) return false;
    if (payoutFilter  !== 'all' && (r.payout_status || 'Pending') !== payoutFilter) return false;
    if (monthFilter   !== 'all' && r.invoice_date && !r.invoice_date.startsWith(monthFilter)) return false;
    return true;
  });

  const CASH_GETTERS = {
    campaign:   r => r.campaign_name || '',
    creator:    r => (r.creator_name || r.creator_full_name || '').toLowerCase(),
    contracted: r => r.contracted_rate || 0,
    agency:     r => r.agency_payment_status || '',
    received:   r => r.you_received_date || '',
    cashin:     r => r.amount_received ?? r.invoice_amount ?? 0,
    fee:        r => r.processing_fee || 0,
    payout:     r => r.payout_status || '',
    payoutamt:  r => r.payout_amount || 0,
    splits:     r => r.splits_cleared || 0,
    invoice_date: r => r.invoice_date || '',
  };
  const INK_GETTERS = {
    campaign:      r => r.campaign_name || '',
    creator:       r => (r.creator_name || r.creator_full_name || '').toLowerCase(),
    agency:        r => r.agency_name || '',
    fairvalue:     r => r.invoice_amount ?? r.contracted_rate ?? 0,
    agencystatus:  r => r.agency_payment_status || '',
  };

  const cashRows = cashSort.sortRows(filtered.filter(r => !isInKind(r.payment_method)), CASH_GETTERS);
  const inkRows  = inkSort.sortRows(filtered.filter(r => isInKind(r.payment_method)), INK_GETTERS);

  const totalContracted    = filtered.reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const totalReceived      = filtered.filter(r => r.you_received && !isInKind(r.payment_method)).reduce((s, r) => s + (r.amount_received || r.invoice_amount || 0), 0);
  const totalPaidOut       = filtered.filter(r => r.payout_status === 'Paid' && !isInKind(r.payment_method)).reduce((s, r) => s + (r.payout_amount || 0), 0);
  const totalPendingPayout = filtered.filter(r => r.payout_status !== 'Paid' && r.payout_status !== 'N/A' && !isInKind(r.payment_method) && r.you_received).reduce((s, r) => s + (r.payout_amount || r.contracted_rate || 0), 0);
  const totalFees          = filtered.filter(r => !isInKind(r.payment_method)).reduce((s, r) => s + (r.processing_fee || 0), 0);
  const totalInKind        = filtered.filter(r => isInKind(r.payment_method)).reduce((s, r) => s + (r.invoice_amount ?? r.contracted_rate ?? 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  function CashTh({ col, children }) {
    return <SortTh sortBy={cashSort.sortBy} sortDir={cashSort.sortDir} col={col} onToggle={cashSort.toggle}>{children}</SortTh>;
  }
  function InkTh({ col, children }) {
    return <SortTh sortBy={inkSort.sortBy} sortDir={inkSort.sortDir} col={col} onToggle={inkSort.toggle}>{children}</SortTh>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{isAdmin ? 'PAYMENTS' : 'MY PAYMENTS'}</div>
          <div className="page-subtitle">{isAdmin ? 'Agency invoices and creator payouts — two-stage tracking' : 'Earnings and payout details per campaign'}</div>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22 }}>{fmtMoney(totalContracted)}</div><div className="stat-label">Contracted</div></div>
        <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 22 }}>{fmtMoney(totalReceived)}</div><div className="stat-label">{isAdmin ? 'You Received' : 'Agency Paid'}</div></div>
        <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 22 }}>{fmtMoney(totalPaidOut)}</div><div className="stat-label">{isAdmin ? 'Paid to Creators' : 'Paid to Me'}</div></div>
        <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 22 }}>{fmtMoney(totalPendingPayout)}</div><div className="stat-label">Awaiting Payout</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22, color: totalFees > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(totalFees)}</div><div className="stat-label">Fees</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22, color: 'var(--text-muted)', fontStyle: 'italic' }}>{fmtMoney(totalInKind)}</div><div className="stat-label">In-Kind FMV</div></div>
      </div>

      <div className="filters-row" style={{ flexWrap: 'wrap' }}>
        {isAdmin && (
          <>
            <span className="text-muted text-xs">CREATOR</span>
            <button className={`filter-chip ${creatorFilter === 'all' ? 'active' : ''}`} onClick={() => setCreatorFilter('all')}>All</button>
            {creators.map(c => (
              <button key={c.id} className={`filter-chip ${creatorFilter === c.id ? 'active' : ''}`} onClick={() => setCreatorFilter(c.id)}>
                {c.creator_name || c.full_name}
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px' }} />
          </>
        )}
        <span className="text-muted text-xs">AGENCY</span>
        {['all', 'Paid', 'Pending', 'Overdue', 'Not Invoiced'].map(s => (
          <button key={s} className={`filter-chip ${agencyFilter === s ? 'active' : ''}`} onClick={() => setAgencyFilter(s)}>{s === 'all' ? 'All' : s}</button>
        ))}
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px' }} />
        <span className="text-muted text-xs">PAYOUT</span>
        {['all', ...PAYOUT_STATUSES].map(s => (
          <button key={s} className={`filter-chip ${payoutFilter === s ? 'active' : ''}`} onClick={() => setPayoutFilter(s)}>{s === 'all' ? 'All' : s}</button>
        ))}
        {months.length > 0 && (
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, marginLeft: 8 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="all">All time</option>
            {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </select>
        )}
      </div>

      {cashRows.length === 0 && inkRows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◇</div>
          <div className="empty-state-title">No payments to show</div>
          <div className="empty-state-text">{isAdmin ? 'Payments will appear here once campaigns are set up.' : 'Payments will appear here once your manager sets them up.'}</div>
        </div>
      ) : (
        <>
          {cashRows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <CashTh col="campaign">Campaign</CashTh>
                    {isAdmin && <CashTh col="creator">Creator</CashTh>}
                    <CashTh col="contracted">Contracted</CashTh>
                    <CashTh col="agency">Agency Status</CashTh>
                    <CashTh col="received">{isAdmin ? 'You Received' : 'Agency Cleared'}</CashTh>
                    <CashTh col="cashin">Cash In</CashTh>
                    <CashTh col="fee">Fee</CashTh>
                    <CashTh col="payout">Payout Status</CashTh>
                    <CashTh col="payoutamt">Payout Out</CashTh>
                    <CashTh col="splits">Splits</CashTh>
                  </tr>
                </thead>
                <tbody>
                  {cashRows.map(r => (
                    <tr key={r.campaign_id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                        <div className="text-muted text-xs">{r.brand_name} · {r.agency_name || '—'}</div>
                      </td>
                      {isAdmin && <td>{r.creator_name || r.creator_full_name || '—'}</td>}
                      <td style={{ fontWeight: 600 }}>{fmtMoney(r.contracted_rate)}</td>
                      <td><Badge status={r.agency_payment_status || 'Not Invoiced'} /></td>
                      <td>
                        {r.you_received
                          ? <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>✓ {fmtDate(r.you_received_date)}</span>
                          : <span className="text-muted text-xs">Not yet</span>}
                      </td>
                      <td>
                        {r.amount_received != null
                          ? <span style={{ color: r.amount_received < (r.invoice_amount || r.contracted_rate) ? 'var(--orange)' : 'var(--text)' }}>{fmtMoney(r.amount_received)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>{r.processing_fee > 0 ? <span style={{ color: 'var(--red)', fontSize: 12 }}>{fmtMoney(r.processing_fee)}</span> : <span className="text-muted">—</span>}</td>
                      <td><PayoutBadge status={r.payout_status || 'Pending'} /></td>
                      <td>
                        {r.payout_amount != null
                          ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtMoney(r.payout_amount)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        {r.split_count > 0
                          ? <span className="text-sm" style={{ color: r.splits_cleared === r.split_count ? 'var(--green)' : 'var(--text-muted)' }}>{r.splits_cleared}/{r.split_count} cleared</span>
                          : <span className="text-muted text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inkRows.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>IN-KIND COMPENSATION</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <InkTh col="campaign">Campaign</InkTh>
                      {isAdmin && <InkTh col="creator">Creator</InkTh>}
                      <InkTh col="agency">Agency</InkTh>
                      <InkTh col="fairvalue">Fair Value</InkTh>
                      <InkTh col="agencystatus">Agency Status</InkTh>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inkRows.map(r => (
                      <tr key={r.campaign_id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                          <div className="text-muted text-xs">{r.brand_name}</div>
                        </td>
                        {isAdmin && <td>{r.creator_name || r.creator_full_name || '—'}</td>}
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
        <PaymentDetailPanel
          row={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onUpdated={() => { fetchAll(); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function PaymentDetailPanel({ row, isAdmin, onClose, onUpdated }) {
  const [invoice,      setInvoice]      = useState(null);
  const [payout,       setPayout]       = useState(null);
  const [splits,       setSplits]       = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [tab,          setTab]          = useState('invoice');
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { fetchDetail(); }, [row.campaign_id]);

  async function fetchDetail() {
    setLoading(true);
    const [invRes, payoutRes, destRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('campaign_id', row.campaign_id).maybeSingle(),
      supabase.from('creator_payouts').select('*, payout_splits(*, destination:payment_destinations(*))').eq('campaign_id', row.campaign_id).maybeSingle(),
      isAdmin
        ? supabase.from('payment_destinations').select('*').eq('profile_id', row.creator_profile_id).eq('is_active', true).order('sort_order')
        : Promise.resolve({ data: [] }),
    ]);
    setInvoice(invRes.data || null);
    setPayout(payoutRes.data || null);
    setSplits(payoutRes.data?.payout_splits || []);
    setDestinations(destRes.data || []);
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
        <div className="text-muted mt-4">
          {row.brand_name}{isAdmin && ` · ${row.creator_name || row.creator_full_name || ''}`}
        </div>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18, marginTop: 8 }}>{fmtMoney(row.contracted_rate)}</div>
      </div>

      <div className="tabs" style={{ padding: '0 24px' }}>
        {['invoice', 'payout'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'invoice' ? 'Invoice (Agency → You)' : 'Payout (You → Creator)'}
          </div>
        ))}
      </div>

      <div className="detail-body">
        {loading ? <div className="text-muted">Loading...</div> : (
          tab === 'invoice'
            ? (isAdmin
                ? <InvoiceForm invoice={invoice} row={row} onUpdated={() => { fetchDetail(); onUpdated(); }} />
                : <InvoiceReadOnly invoice={invoice} row={row} />)
            : (isAdmin
                ? <PayoutForm payout={payout} splits={splits} destinations={destinations} row={row} onUpdated={() => { fetchDetail(); onUpdated(); }} />
                : <PayoutReadOnly payout={payout} splits={splits} row={row} />)
        )}
      </div>
    </div>
  );
}

// ── Invoice — read-only (creator view) ────────────────────────────────────────
function InvoiceReadOnly({ invoice, row }) {
  const inKind = isInKind(invoice?.payment_method || row.payment_method);
  return (
    <div>
      <div className="detail-section-title">AGENCY PAYMENT</div>
      <div className="detail-grid">
        <div>
          <div className="detail-item-label">Status</div>
          <div className="detail-item-value"><Badge status={invoice?.payment_status || 'Not Invoiced'} /></div>
        </div>
        <div>
          <div className="detail-item-label">{inKind ? 'Fair Value (In Kind)' : 'Invoice Amount'}</div>
          <div className="detail-item-value" style={{ fontWeight: 600 }}>{fmtMoney(invoice?.invoice_amount ?? row.contracted_rate)}</div>
        </div>
        {invoice?.invoice_number && (
          <div>
            <div className="detail-item-label">Invoice #</div>
            <div className="detail-item-value">{invoice.invoice_number}</div>
          </div>
        )}
        {invoice?.invoice_date && (
          <div>
            <div className="detail-item-label">Invoice Date</div>
            <div className="detail-item-value">{fmtDate(invoice.invoice_date)}</div>
          </div>
        )}
        {invoice?.payment_method && (
          <div>
            <div className="detail-item-label">Payment Method</div>
            <div className="detail-item-value">{invoice.payment_method}</div>
          </div>
        )}
      </div>

      {inKind ? (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 6, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Compensation</div>
          Fair value tracked for tax purposes only. No cash changes hands.
        </div>
      ) : invoice?.you_received ? (
        <>
          <div className="divider" />
          <div className="detail-section-title">RECEIVED BY MANAGER</div>
          <div className="detail-grid">
            <div>
              <div className="detail-item-label">Date Cleared</div>
              <div className="detail-item-value" style={{ color: 'var(--green)' }}>✓ {fmtDate(invoice.you_received_date)}</div>
            </div>
            <div>
              <div className="detail-item-label">Amount Received</div>
              <div className="detail-item-value" style={{ fontWeight: 600 }}>{fmtMoney(invoice.amount_received)}</div>
            </div>
            {invoice.processing_fee > 0 && (
              <div>
                <div className="detail-item-label">Processing Fee</div>
                <div className="detail-item-value" style={{ color: 'var(--orange)' }}>{fmtMoney(invoice.processing_fee)}</div>
              </div>
            )}
            {invoice.you_received_notes && (
              <div style={{ gridColumn: 'span 2' }}>
                <div className="detail-item-label">Notes</div>
                <div className="detail-item-value text-muted">{invoice.you_received_notes}</div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-muted text-sm" style={{ marginTop: 12 }}>Payment not yet received by your manager.</div>
      )}
    </div>
  );
}

// ── Payout — read-only (creator view) ────────────────────────────────────────
function PayoutReadOnly({ payout, splits, row }) {
  const inKind = isInKind(row.payment_method);
  if (inKind) {
    return (
      <div style={{ padding: '16px 18px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Campaign</div>
        This campaign was compensated in kind. No cash payout applies.
      </div>
    );
  }
  if (!payout) {
    return <div className="text-muted text-sm">Payout not yet created by your manager.</div>;
  }
  return (
    <div>
      <div className="detail-section-title">YOUR PAYOUT</div>
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

      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 10 }}>DESTINATION BREAKDOWN</div>
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
                      ? (s.notes ? s.notes.slice(0, 50) + (s.notes.length > 50 ? '…' : '') : 'Other')
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
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtMoney(splits.reduce((s, sp) => s + (sp.amount || 0), 0))}</span>
        </div>
      )}
    </div>
  );
}

// ── Invoice form — editable (admin view) ──────────────────────────────────────
function InvoiceForm({ invoice, row, onUpdated }) {
  const [form, setForm] = useState({
    invoice_number:       invoice?.invoice_number || '',
    invoice_date:         invoice?.invoice_date || '',
    invoice_amount:       invoice?.invoice_amount ?? row.contracted_rate ?? '',
    payment_status:       invoice?.payment_status || 'Not Invoiced',
    payment_received_date: invoice?.payment_received_date || '',
    payment_method:       invoice?.payment_method || '',
    payment_notes:        invoice?.payment_notes || '',
    you_received:         invoice?.you_received ?? false,
    you_received_date:    invoice?.you_received_date || '',
    you_received_notes:   invoice?.you_received_notes || '',
    processing_fee:       invoice?.processing_fee ?? '',
  });
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [receiptPath, setReceiptPath] = useState(invoice?.receipt_path || null);
  const [receiptName, setReceiptName] = useState(invoice?.receipt_name || null);

  const inKind = isInKind(form.payment_method);

  async function save() {
    const errors = [];
    if (form.invoice_date           && !isValidDateString(form.invoice_date))           errors.push('Invoice date is not a valid date.');
    if (form.payment_received_date  && !isValidDateString(form.payment_received_date))  errors.push('Agency paid date is not a valid date.');
    if (!inKind && form.you_received_date && !isValidDateString(form.you_received_date)) errors.push('Date cleared is not a valid date.');
    if (form.invoice_amount !== ''  && !isValidNumber(form.invoice_amount))             errors.push('Invoice amount must be a number.');
    if (!inKind && form.processing_fee !== '' && !isValidNumber(form.processing_fee))   errors.push('Processing fee must be a number.');
    if (errors.length) { alert(errors.join('\n')); return; }
    setSaving(true);
    const payload = {
      invoice_number:       form.invoice_number || null,
      invoice_date:         form.invoice_date || null,
      invoice_amount:       form.invoice_amount !== '' ? parseFloat(form.invoice_amount) : null,
      payment_status:       form.payment_status,
      payment_received_date: form.payment_received_date || null,
      payment_method:       form.payment_method || null,
      payment_notes:        form.payment_notes || null,
      you_received:         inKind ? false : form.you_received,
      you_received_date:    inKind ? null : (form.you_received_date || null),
      you_received_notes:   inKind ? null : (form.you_received_notes || null),
      amount_received:      inKind ? null : (form.invoice_amount !== ''
        ? parseFloat((parseFloat(form.invoice_amount) - (parseFloat(form.processing_fee) || 0)).toFixed(2))
        : null),
      processing_fee:       inKind ? 0 : (form.processing_fee !== '' ? parseFloat(form.processing_fee) : 0),
    };
    if (invoice) {
      await supabase.from('invoices').update(payload).eq('id', invoice.id);
    } else {
      await supabase.from('invoices').insert({ ...payload, campaign_id: row.campaign_id });
    }
    setSaving(false);
    onUpdated();
  }

  async function uploadReceipt(file) {
    if (!file) return;
    let invoiceId = invoice?.id;
    if (!invoiceId) {
      const { data: newInv } = await supabase.from('invoices').insert({ campaign_id: row.campaign_id, payment_status: form.payment_status || 'Not Invoiced' }).select().single();
      invoiceId = newInv?.id;
      if (!invoiceId) return;
    }
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `receipts/${invoiceId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('payment-receipts').upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from('invoices').update({ receipt_path: path, receipt_name: file.name }).eq('id', invoiceId);
      setReceiptPath(path); setReceiptName(file.name); onUpdated();
    }
    setUploading(false);
  }

  return (
    <div>
      <div className="detail-section-title">INVOICE TO AGENCY</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Invoice #</label>
          <input className="form-input" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="INV-001" />
        </div>
        <div className="form-group">
          <label className="form-label">Invoice Date</label>
          <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Invoice Amount ($)</label>
          <input className="form-input" type="number" value={form.invoice_amount} onChange={e => setForm(f => ({ ...f, invoice_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Agency Payment Status</label>
          <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
            {AGENCY_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Agency Paid Date</label>
          <input className="form-input" type="date" value={form.payment_received_date} onChange={e => setForm(f => ({ ...f, payment_received_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
            <option value="">Select...</option>
            {['PayPal','Wire','ACH','Check','Zelle','In Kind'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.payment_notes} onChange={e => setForm(f => ({ ...f, payment_notes: e.target.value }))} style={{ minHeight: 52 }} />
      </div>

      <div className="divider" />

      {inKind ? (
        <div style={{ padding: '12px 14px', borderRadius: 6, marginBottom: 4, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Compensation</div>
          Fair value tracked for tax purposes only. No cash changes hands, so there is nothing to mark as received and no payout to the creator.
        </div>
      ) : (
        <>
          <div className="detail-section-title">RECEIVED BY YOU</div>
          <div className="form-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.you_received} onChange={e => setForm(f => ({ ...f, you_received: e.target.checked }))} />
              Money has cleared my account
            </label>
          </div>
          {form.you_received && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date Cleared</label>
                  <input className="form-input" type="date" value={form.you_received_date} onChange={e => setForm(f => ({ ...f, you_received_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Processing Fee ($)</label>
                  <input className="form-input" type="number" step="0.01" value={form.processing_fee} onChange={e => setForm(f => ({ ...f, processing_fee: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Net Received</label>
                <div className="form-input" style={{ background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'default' }}>
                  {form.invoice_amount !== '' ? fmtMoney(parseFloat(form.invoice_amount) - (parseFloat(form.processing_fee) || 0)) : '—'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.you_received_notes} onChange={e => setForm(f => ({ ...f, you_received_notes: e.target.value }))} placeholder="e.g. PayPal deducted $12 fee" />
              </div>
            </>
          )}
        </>
      )}

      <button className="btn btn-primary w-full mt-12" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
        {saving ? 'Saving...' : 'Save Invoice'}
      </button>

      <div className="divider" style={{ margin: '20px 0 14px' }} />
      <div className="detail-section-title" style={{ marginBottom: 10 }}>PAYMENT RECEIPT</div>
      {receiptPath ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receiptName || 'Receipt'}</span>
          <button className="btn btn-secondary btn-sm" onClick={async () => { const u = await getSignedUrl('payment-receipts', receiptPath); if (u) openPopup(u); }}>View</button>
          <button className="btn btn-secondary btn-sm" onClick={async () => { const u = await getSignedUrl('payment-receipts', receiptPath); if (!u) return; const a = document.createElement('a'); a.href = u; a.download = receiptName || 'receipt'; a.click(); }}>↓</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={async () => {
            if (!window.confirm('Remove this receipt?')) return;
            await supabase.storage.from('payment-receipts').remove([receiptPath]);
            await supabase.from('invoices').update({ receipt_path: null, receipt_name: null }).eq('id', invoice.id);
            setReceiptPath(null); setReceiptName(null);
          }}>✕</button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <span className="text-muted text-sm">{uploading ? 'Uploading...' : 'Click to upload receipt (PDF, JPG, PNG)'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploading} onChange={e => { if (e.target.files[0]) uploadReceipt(e.target.files[0]); }} />
        </label>
      )}
    </div>
  );
}

// ── Payout form — editable (admin view) ──────────────────────────────────────
function PayoutForm({ payout, splits, destinations, row, onUpdated }) {
  const [form, setForm] = useState({
    payout_amount: payout?.payout_amount ?? row.amount_received ?? row.contracted_rate ?? '',
    payout_status: payout?.payout_status || 'Pending',
    payout_date:   payout?.payout_date || '',
    payout_notes:  payout?.payout_notes || '',
  });

  const defaultSplits = () => {
    if (destinations.length >= 2) return [
      { destination_id: destinations[0].id, percentage: '50', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' },
      { destination_id: destinations[1].id, percentage: '50', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' },
    ];
    if (destinations.length === 1) return [{ destination_id: destinations[0].id, percentage: '100', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }];
    return [{ destination_id: '', percentage: '100', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }];
  };

  const [splitForms, setSplitForms] = useState(
    splits.length > 0
      ? splits.map(s => ({ id: s.id, destination_id: s.destination_id || '', percentage: String(s.percentage ?? ''), amount_override: s.amount != null ? String(s.amount) : '', split_status: s.split_status || 'Pending', sent_date: s.sent_date || '', cleared_date: s.cleared_date || '', reference: s.reference || '', notes: s.notes || '' }))
      : defaultSplits()
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const inKind    = isInKind(row.payment_method);
  const totalPct  = splitForms.reduce((s, f) => s + (parseFloat(f.percentage) || 0), 0);
  const payoutAmt = parseFloat(form.payout_amount) || 0;

  function setSF(i, k, v) { setSplitForms(sf => sf.map((s, idx) => idx === i ? { ...s, [k]: v } : s)); }

  async function save() {
    if (Math.abs(totalPct - 100) > 0.01) { setError(`Splits must total 100%. Currently ${totalPct.toFixed(1)}%`); return; }
    if (splitForms.some(s => !s.destination_id)) { setError('All splits need a destination.'); return; }
    setSaving(true); setError('');

    const payoutPayload = {
      campaign_id:       row.campaign_id,
      invoice_id:        row.invoice_id,
      profile_id:        row.creator_profile_id,
      contracted_amount: row.contracted_rate,
      payout_amount:     payoutAmt || null,
      payout_status:     form.payout_status,
      payout_date:       form.payout_date || null,
      payout_notes:      form.payout_notes || null,
    };
    let payoutId = payout?.id;
    if (payout) {
      await supabase.from('creator_payouts').update(payoutPayload).eq('id', payout.id);
    } else {
      const { data: np } = await supabase.from('creator_payouts').insert(payoutPayload).select().single();
      payoutId = np?.id;
    }
    if (!payoutId) { setError('Failed to save payout record.'); setSaving(false); return; }

    const amounts = splitForms.map(sf =>
      sf.amount_override !== undefined && sf.amount_override !== ''
        ? parseFloat(parseFloat(sf.amount_override).toFixed(2))
        : payoutAmt ? parseFloat((payoutAmt * parseFloat(sf.percentage) / 100).toFixed(2)) : null
    );
    if (payoutAmt && amounts.length > 1 && amounts.every(a => a !== null)) {
      const sumRest = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
      amounts[amounts.length - 1] = parseFloat((payoutAmt - sumRest).toFixed(2));
    }
    for (let i = 0; i < splitForms.length; i++) {
      const sf = splitForms[i];
      const sp = { payout_id: payoutId, destination_id: sf.destination_id, percentage: parseFloat(sf.percentage), amount: amounts[i], split_status: sf.split_status, sent_date: sf.sent_date || null, cleared_date: sf.cleared_date || null, reference: sf.reference || null, notes: sf.notes || null };
      if (sf.id) await supabase.from('payout_splits').update(sp).eq('id', sf.id);
      else await supabase.from('payout_splits').insert(sp);
    }
    setSaving(false);
    onUpdated();
  }

  if (inKind) return (
    <div style={{ padding: '16px 18px', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Campaign</div>
      This campaign was compensated in kind. No cash was received and no payout to the creator applies. The fair value is tracked on the Invoice tab for tax purposes only.
    </div>
  );

  return (
    <div>
      {!row.you_received && (
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 12, background: 'rgba(255,156,58,0.08)', border: '1px solid rgba(255,156,58,0.2)', color: 'var(--orange)' }}>
          Mark payment as received on the Invoice tab before recording payout.
        </div>
      )}
      <div className="detail-section-title">PAYOUT TO {(row.creator_name || 'CREATOR').toUpperCase()}</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Payout Amount ($)</label>
          <input className="form-input" type="number" step="0.01" value={form.payout_amount} onChange={e => setForm(f => ({ ...f, payout_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payout Status</label>
          <select className="form-select" value={form.payout_status} onChange={e => setForm(f => ({ ...f, payout_status: e.target.value }))}>
            {PAYOUT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Payout Date</label>
          <input className="form-input" type="date" value={form.payout_date} onChange={e => setForm(f => ({ ...f, payout_date: e.target.value }))} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <input className="form-input" value={form.payout_notes} onChange={e => setForm(f => ({ ...f, payout_notes: e.target.value }))} placeholder="e.g. Deducted $12 processing fee" />
      </div>
      <div className="divider" />
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="detail-section-title" style={{ marginBottom: 2 }}>DESTINATION SPLITS</div>
          <div style={{ fontSize: 11, color: Math.abs(totalPct - 100) < 0.01 ? 'var(--green)' : 'var(--orange)' }}>
            {totalPct.toFixed(1)}% allocated of {fmtMoney(payoutAmt)}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSplitForms(sf => [...sf, { destination_id: '', percentage: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }])}>+ Add Split</button>
      </div>
      {destinations.length === 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 12, background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)', color: 'var(--red)' }}>
          No destinations configured for this creator. Go to Setup → Payment Destinations.
        </div>
      )}
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
      {splitForms.map((sf, i) => (
        <div key={i} className="deliverable-card" style={{ marginBottom: 10 }}>
          <div className="deliverable-card-header">
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Split {i + 1}</span>
            {splitForms.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                if (sf.id) { if (!window.confirm('Remove this split? This cannot be undone.')) return; await supabase.from('payout_splits').delete().eq('id', sf.id); }
                setSplitForms(sf2 => sf2.filter((_, idx) => idx !== i));
              }}>Remove</button>
            )}
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination</label>
              <select className="form-select" value={sf.destination_id} onChange={e => setSF(i, 'destination_id', e.target.value)}>
                <option value="">Select...</option>
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name} — {d.account_type}{d.account_last4 ? ` ···${d.account_last4}` : ''}{d.institution ? ` (${d.institution})` : ''}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Percentage / Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" type="number" min="0" max="100" step="0.01" value={sf.percentage}
                  onChange={e => { const pct = e.target.value; const amt = payoutAmt && pct !== '' ? (payoutAmt * parseFloat(pct) / 100).toFixed(2) : ''; setSF(i, 'percentage', pct); setSF(i, 'amount_override', amt); }}
                  style={{ width: 72 }} placeholder="%" />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>%  =</span>
                <input className="form-input" type="number" min="0" step="0.01"
                  value={sf.amount_override ?? (payoutAmt && sf.percentage ? (payoutAmt * parseFloat(sf.percentage) / 100).toFixed(2) : '')}
                  onChange={e => { const amt = e.target.value; const pct = payoutAmt && amt !== '' ? ((parseFloat(amt) / payoutAmt) * 100).toFixed(4) : ''; setSF(i, 'amount_override', amt); setSF(i, 'percentage', pct); }}
                  style={{ width: 90 }} placeholder="$0.00" />
              </div>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Split Status</label>
              <select className="form-select" value={sf.split_status} onChange={e => setSF(i, 'split_status', e.target.value)}>
                {SPLIT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Reference / TX ID</label>
              <input className="form-input" value={sf.reference} onChange={e => setSF(i, 'reference', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sent Date</label>
              <input className="form-input" type="date" value={sf.sent_date} onChange={e => setSF(i, 'sent_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cleared Date</label>
              <input className="form-input" type="date" value={sf.cleared_date} onChange={e => setSF(i, 'cleared_date', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      <button className="btn btn-primary w-full mt-12" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
        {saving ? 'Saving...' : 'Save Payout'}
      </button>
    </div>
  );
}
