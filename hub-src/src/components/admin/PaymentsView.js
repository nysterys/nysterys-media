import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney, fmtMonth, extractMonths, isValidDateString, isValidNumber, isValidUrl } from '../../utils/format';

const AGENCY_STATUSES = ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue', 'Disputed'];
const PAYOUT_STATUSES = ['Pending', 'Partial', 'Paid', 'On Hold', 'N/A'];

function isInKind(paymentMethod) {
  return (paymentMethod || '').toLowerCase() === 'in kind';
}
const SPLIT_STATUSES = ['Pending', 'Sent', 'Cleared', 'Failed'];

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

async function getSignedUrl(bucket, path) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  return data?.signedUrl || null;
}

function PayoutBadge({ status }) {
  const map = { 'Pending': 'badge-not-invoiced', 'Partial': 'badge-pending', 'Paid': 'badge-paid', 'On Hold': 'badge-overdue' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status || 'Pending'}</span>;
}

export default function PaymentsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const lastMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  const [monthFilter, setMonthFilter] = useState(lastMonth);
  const [creators, setCreators] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [summary, creatorsRes] = await Promise.all([
      supabase.from('campaign_payout_summary').select('*').order('invoice_date', { ascending: false, nullsFirst: false }),
      supabase.from('profiles').select('*').eq('role', 'creator'),
    ]);
    setRows(summary.data || []);
    setCreators(creatorsRes.data || []);
    setLoading(false);
  }

  const months = extractMonths(rows, 'invoice_date');

  const [sortBy, setSortBy] = useState('invoice_date');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  const filtered = rows.filter(r => {
    if (agencyFilter !== 'all' && r.agency_payment_status !== agencyFilter) return false;
    if (payoutFilter !== 'all' && (r.payout_status || 'Pending') !== payoutFilter) return false;
    if (creatorFilter !== 'all' && r.creator_profile_id !== creatorFilter) return false;
    if (monthFilter !== 'all' && r.invoice_date && !r.invoice_date.startsWith(monthFilter)) return false;
    return true;
  }).sort((a, b) => {
    let av, bv;
    switch (sortBy) {
      case 'campaign':   av = a.campaign_name || ''; bv = b.campaign_name || ''; break;
      case 'creator':    av = (a.creator_name || a.creator_full_name || '').toLowerCase(); bv = (b.creator_name || b.creator_full_name || '').toLowerCase(); break;
      case 'contracted': av = a.contracted_rate || 0; bv = b.contracted_rate || 0; break;
      case 'agency':     av = a.agency_payment_status || ''; bv = b.agency_payment_status || ''; break;
      case 'received':   av = a.you_received_date || ''; bv = b.you_received_date || ''; break;
      case 'cashin':     av = a.amount_received ?? a.invoice_amount ?? 0; bv = b.amount_received ?? b.invoice_amount ?? 0; break;
      case 'fee':        av = a.processing_fee || 0; bv = b.processing_fee || 0; break;
      case 'payout':     av = a.payout_status || ''; bv = b.payout_status || ''; break;
      case 'payoutamt':  av = a.payout_amount || 0; bv = b.payout_amount || 0; break;
      case 'splits':     av = a.splits_cleared || 0; bv = b.splits_cleared || 0; break;
      default:           av = a.invoice_date || ''; bv = b.invoice_date || '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalContracted = filtered.reduce((s, r) => s + (r.contracted_rate || 0), 0);
  const totalReceived = filtered.filter(r => r.you_received && !isInKind(r.payment_method)).reduce((s, r) => s + (r.amount_received || r.invoice_amount || 0), 0);
  const totalPaidOut = filtered.filter(r => r.payout_status === 'Paid' && !isInKind(r.payment_method)).reduce((s, r) => s + (r.payout_amount || 0), 0);
  const totalPendingPayout = filtered.filter(r => r.payout_status !== 'Paid' && r.payout_status !== 'N/A' && !isInKind(r.payment_method) && r.you_received).reduce((s, r) => s + (r.payout_amount || r.contracted_rate || 0), 0);
  const totalFees = filtered.filter(r => !isInKind(r.payment_method)).reduce((s, r) => s + (r.processing_fee || 0), 0);
  const totalInKind = filtered.filter(r => isInKind(r.payment_method)).reduce((s, r) => s + (r.invoice_amount ?? r.contracted_rate ?? 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  function SortTh({ col, children }) {
    const active = sortBy === col;
    return (
      <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(col)}>
        {children}
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 9 }}>{active && sortDir === 'desc' ? '▼' : '▲'}</span>
      </th>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">PAYMENTS</div>
          <div className="page-subtitle">Agency invoices and creator payouts — two-stage tracking</div>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22 }}>{fmtMoney(totalContracted)}</div><div className="stat-label">Contracted</div></div>
        <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 22 }}>{fmtMoney(totalReceived)}</div><div className="stat-label">You Received</div></div>
        <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 22 }}>{fmtMoney(totalPaidOut)}</div><div className="stat-label">Paid to Creators</div></div>
        <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 22 }}>{fmtMoney(totalPendingPayout)}</div><div className="stat-label">Awaiting Payout</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22, color: totalFees > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(totalFees)}</div><div className="stat-label">Fees Paid</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22, color: 'var(--text-muted)', fontStyle: 'italic' }}>{fmtMoney(totalInKind)}</div><div className="stat-label">In-Kind FMV</div></div>
      </div>

      <div className="filters-row" style={{ flexWrap: 'wrap' }}>
        <span className="text-muted text-xs">CREATOR</span>
        <button className={`filter-chip ${creatorFilter === 'all' ? 'active' : ''}`} onClick={() => setCreatorFilter('all')}>All</button>
        {creators.map(c => (
          <button key={c.id} className={`filter-chip ${creatorFilter === c.id ? 'active' : ''}`} onClick={() => setCreatorFilter(c.id)}>
            {c.creator_name || c.full_name}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px' }} />
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh col="campaign">Campaign</SortTh>
              <SortTh col="creator">Creator</SortTh>
              <SortTh col="contracted">Contracted</SortTh>
              <SortTh col="agency">Agency Status</SortTh>
              <SortTh col="received">You Received</SortTh>
              <SortTh col="cashin">Cash In</SortTh>
              <SortTh col="fee">Fee</SortTh>
              <SortTh col="payout">Payout Status</SortTh>
              <SortTh col="payoutamt">Payout Out</SortTh>
              <SortTh col="splits">Splits</SortTh>
            </tr>
          </thead>
          <tbody>
            {filtered.filter(r => !isInKind(r.payment_method)).map(r => (
              <tr key={r.campaign_id} onClick={() => setSelected(r)}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                  <div className="text-muted text-xs">{r.brand_name} · {r.agency_name || '—'}</div>
                </td>
                <td>{r.creator_name || r.creator_full_name || '—'}</td>
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

      {/* In-Kind table */}
      {filtered.some(r => isInKind(r.payment_method)) && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-dim)', marginBottom: 10 }}>
            IN-KIND COMPENSATION
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Creator</th>
                  <th>Agency</th>
                  <th>Fair Value</th>
                  <th>Agency Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.filter(r => isInKind(r.payment_method)).map(r => (
                  <tr key={r.campaign_id} onClick={() => setSelected(r)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.campaign_name}</div>
                      <div className="text-muted text-xs">{r.brand_name}</div>
                    </td>
                    <td>{r.creator_name || r.creator_full_name || '—'}</td>
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

      {selected && (
        <PaymentDetailPanel
          row={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { fetchAll(); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Payment Detail Panel
// ============================================================
function PaymentDetailPanel({ row, onClose, onUpdated }) {
  const [invoice, setInvoice] = useState(null);
  const [payout, setPayout] = useState(null);
  const [splits, setSplits] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [tab, setTab] = useState('invoice');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDetail(); }, [row.campaign_id]);

  async function fetchDetail() {
    setLoading(true);
    const [invRes, payoutRes, destRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('campaign_id', row.campaign_id).maybeSingle(),
      supabase.from('creator_payouts').select('*, payout_splits(*, destination:payment_destinations(*))').eq('campaign_id', row.campaign_id).maybeSingle(),
      supabase.from('payment_destinations').select('*').eq('profile_id', row.creator_profile_id).eq('is_active', true).order('sort_order'),
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
        <div className="text-muted mt-4">{row.brand_name} · {row.creator_name || row.creator_full_name}</div>
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
        {loading ? <div className="text-muted">Loading...</div>
          : tab === 'invoice'
            ? <InvoiceForm invoice={invoice} row={row} onUpdated={() => { fetchDetail(); onUpdated(); }} />
            : <PayoutForm payout={payout} splits={splits} destinations={destinations} row={row} onUpdated={() => { fetchDetail(); onUpdated(); }} />
        }
      </div>
    </div>
  );
}

// ============================================================
// Invoice form
// ============================================================
function InvoiceForm({ invoice, row, onUpdated }) {
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    invoice_date: invoice?.invoice_date || '',
    invoice_amount: invoice?.invoice_amount ?? row.contracted_rate ?? '',
    payment_status: invoice?.payment_status || 'Not Invoiced',
    payment_received_date: invoice?.payment_received_date || '',
    payment_method: invoice?.payment_method || '',
    payment_notes: invoice?.payment_notes || '',
    you_received: invoice?.you_received ?? false,
    you_received_date: invoice?.you_received_date || '',
    you_received_notes: invoice?.you_received_notes || '',
    amount_received: invoice?.amount_received ?? '',
    processing_fee: invoice?.processing_fee ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptPath, setReceiptPath] = useState(invoice?.receipt_path || null);
  const [receiptName, setReceiptName] = useState(invoice?.receipt_name || null);

  const delta = form.amount_received !== '' && form.invoice_amount !== ''
    ? parseFloat(form.amount_received) - parseFloat(form.invoice_amount) : null;

  const inKind = isInKind(form.payment_method);

  async function save() {
    const errors = [];
    if (form.invoice_date && !isValidDateString(form.invoice_date)) errors.push('Invoice date is not a valid date.');
    if (form.payment_received_date && !isValidDateString(form.payment_received_date)) errors.push('Agency paid date is not a valid date.');
    if (!inKind && form.you_received_date && !isValidDateString(form.you_received_date)) errors.push('Date cleared is not a valid date.');
    if (form.invoice_amount !== '' && !isValidNumber(form.invoice_amount)) errors.push('Invoice amount must be a number.');
    if (!inKind && form.amount_received !== '' && !isValidNumber(form.amount_received)) errors.push('Amount received must be a number.');
    if (!inKind && form.processing_fee !== '' && !isValidNumber(form.processing_fee)) errors.push('Processing fee must be a number.');
    if (errors.length) { alert(errors.join('\n')); return; }
    setSaving(true);
    const payload = {
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      invoice_amount: form.invoice_amount !== '' ? parseFloat(form.invoice_amount) : null,
      payment_status: form.payment_status,
      payment_received_date: form.payment_received_date || null,
      payment_method: form.payment_method || null,
      payment_notes: form.payment_notes || null,
      you_received: inKind ? false : form.you_received,
      you_received_date: inKind ? null : (form.you_received_date || null),
      you_received_notes: inKind ? null : (form.you_received_notes || null),
      amount_received: inKind ? null : (form.amount_received !== '' ? parseFloat(form.amount_received) : null),
      processing_fee: inKind ? 0 : (form.processing_fee !== '' ? parseFloat(form.processing_fee) : 0),
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
      const { data: newInv } = await supabase.from('invoices').insert({
        campaign_id: row.campaign_id,
        payment_status: form.payment_status || 'Not Invoiced',
      }).select().single();
      invoiceId = newInv?.id;
      if (!invoiceId) return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `receipts/${invoiceId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('payment-receipts').upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from('invoices').update({ receipt_path: path, receipt_name: file.name }).eq('id', invoiceId);
      setReceiptPath(path);
      setReceiptName(file.name);
      onUpdated();
    }
    setUploading(false);
  }

  async function viewReceipt() {
    const url = await getSignedUrl('payment-receipts', receiptPath);
    if (url) openPopup(url);
  }

  async function downloadReceipt() {
    const url = await getSignedUrl('payment-receipts', receiptPath);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = receiptName || 'receipt';
    a.click();
  }

  async function deleteReceipt() {
    if (!window.confirm('Remove this receipt?')) return;
    await supabase.storage.from('payment-receipts').remove([receiptPath]);
    await supabase.from('invoices').update({ receipt_path: null, receipt_name: null }).eq('id', invoice.id);
    setReceiptPath(null);
    setReceiptName(null);
    onUpdated();
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
            <option>PayPal</option>
            <option>Wire</option>
            <option>ACH</option>
            <option>Check</option>
            <option>Zelle</option>
            <option>In Kind</option>
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
                  <label className="form-label">Amount Received ($)</label>
                  <input className="form-input" type="number" step="0.01" value={form.amount_received}
                    onChange={e => setForm(f => ({ ...f, amount_received: e.target.value }))}
                    placeholder={form.invoice_amount || ''} />
                </div>
              </div>
              {delta !== null && Math.abs(delta) > 0.01 && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12,
                  background: delta < 0 ? 'rgba(255,156,58,0.08)' : 'rgba(74,223,138,0.08)',
                  border: `1px solid ${delta < 0 ? 'rgba(255,156,58,0.25)' : 'rgba(74,223,138,0.25)'}`,
                  color: delta < 0 ? 'var(--orange)' : 'var(--green)',
                }}>
                  {delta < 0
                    ? `${fmtMoney(Math.abs(delta))} less than invoiced — record processing fee below`
                    : `${fmtMoney(delta)} more than invoiced`}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Processing Fee ($)</label>
                <input className="form-input" type="number" step="0.01" value={form.processing_fee}
                  onChange={e => setForm(f => ({ ...f, processing_fee: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.you_received_notes}
                  onChange={e => setForm(f => ({ ...f, you_received_notes: e.target.value }))}
                  placeholder="e.g. PayPal deducted $12 fee" />
              </div>
            </>
          )}
        </>
      )}

      <button className="btn btn-primary w-full mt-12" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
        {saving ? 'Saving...' : 'Save Invoice'}
      </button>

      {/* Receipt */}
      <div className="divider" style={{ margin: '20px 0 14px' }} />
      <div className="detail-section-title" style={{ marginBottom: 10 }}>PAYMENT RECEIPT</div>
      {receiptPath ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receiptName || 'Receipt'}</span>
          <button className="btn btn-secondary btn-sm" onClick={viewReceipt}>View</button>
          <button className="btn btn-secondary btn-sm" onClick={downloadReceipt}>↓ Download</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red, #e74c3c)' }} onClick={deleteReceipt}>✕</button>
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>📎</span>
          <span className="text-muted text-sm">{uploading ? 'Uploading...' : 'Click to upload receipt (PDF, JPG, PNG)'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploading}
            onChange={e => { if (e.target.files[0]) uploadReceipt(e.target.files[0]); }} />
        </label>
      )}
    </div>
  );
}

// ============================================================
// Payout form
// ============================================================
function PayoutForm({ payout, splits, destinations, row, onUpdated }) {
  const [form, setForm] = useState({
    payout_amount: payout?.payout_amount ?? row.amount_received ?? row.contracted_rate ?? '',
    payout_status: payout?.payout_status || 'Pending',
    payout_date: payout?.payout_date || '',
    payout_notes: payout?.payout_notes || '',
  });

  // Pre-populate splits from existing or default to 50/50 if 2 destinations
  const defaultSplits = () => {
    if (destinations.length >= 2) {
      return [
        { destination_id: destinations[0].id, percentage: '50', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' },
        { destination_id: destinations[1].id, percentage: '50', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' },
      ];
    }
    if (destinations.length === 1) {
      return [{ destination_id: destinations[0].id, percentage: '100', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }];
    }
    return [{ destination_id: '', percentage: '100', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }];
  };

  const [splitForms, setSplitForms] = useState(
    splits.length > 0
      ? splits.map(s => ({
          id: s.id,
          destination_id: s.destination_id || '',
          percentage: String(s.percentage ?? ''),
          amount_override: s.amount != null ? String(s.amount) : '',
          split_status: s.split_status || 'Pending',
          sent_date: s.sent_date || '',
          cleared_date: s.cleared_date || '',
          reference: s.reference || '',
          notes: s.notes || '',
        }))
      : defaultSplits()
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inKind = isInKind(row.payment_method);

  const totalPct = splitForms.reduce((s, f) => s + (parseFloat(f.percentage) || 0), 0);
  const payoutAmt = parseFloat(form.payout_amount) || 0;

  function computedAmount(pct) {
    if (!payoutAmt || !pct) return '—';
    return fmtMoney(payoutAmt * parseFloat(pct) / 100);
  }

  function setSF(i, k, v) { setSplitForms(sf => sf.map((s, idx) => idx === i ? { ...s, [k]: v } : s)); }

  async function save() {
    if (Math.abs(totalPct - 100) > 0.01) { setError(`Splits must total 100%. Currently ${totalPct.toFixed(1)}%`); return; }
    if (splitForms.some(s => !s.destination_id)) { setError('All splits need a destination.'); return; }
    setSaving(true); setError('');

    const payoutPayload = {
      campaign_id: row.campaign_id,
      invoice_id: row.invoice_id,
      profile_id: row.creator_profile_id,
      contracted_amount: row.contracted_rate,
      payout_amount: payoutAmt || null,
      payout_status: form.payout_status,
      payout_date: form.payout_date || null,
      payout_notes: form.payout_notes || null,
    };

    let payoutId = payout?.id;
    if (payout) {
      await supabase.from('creator_payouts').update(payoutPayload).eq('id', payout.id);
    } else {
      const { data: np } = await supabase.from('creator_payouts').insert(payoutPayload).select().single();
      payoutId = np?.id;
    }

    if (!payoutId) { setError('Failed to save payout record.'); setSaving(false); return; }

    for (const sf of splitForms) {
      const amt = sf.amount_override !== undefined && sf.amount_override !== ''
        ? parseFloat(parseFloat(sf.amount_override).toFixed(2))
        : payoutAmt ? parseFloat((payoutAmt * parseFloat(sf.percentage) / 100).toFixed(2)) : null;
      const sp = {
        payout_id: payoutId,
        destination_id: sf.destination_id,
        percentage: parseFloat(sf.percentage),
        amount: amt,
        split_status: sf.split_status,
        sent_date: sf.sent_date || null,
        cleared_date: sf.cleared_date || null,
        reference: sf.reference || null,
        notes: sf.notes || null,
      };
      if (sf.id) {
        await supabase.from('payout_splits').update(sp).eq('id', sf.id);
      } else {
        await supabase.from('payout_splits').insert(sp);
      }
    }
    setSaving(false);
    onUpdated();
  }

  return (
    <div>
      {inKind ? (
        <div style={{
          padding: '16px 18px', borderRadius: 8, fontSize: 13,
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>In-Kind Campaign</div>
          This campaign was compensated in kind. No cash was received and no payout to the creator applies. The fair value is tracked on the Invoice tab for tax purposes only.
        </div>
      ) : (
        <>
      {!row.you_received && (
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 12, background: 'rgba(255,156,58,0.08)', border: '1px solid rgba(255,156,58,0.2)', color: 'var(--orange)' }}>
          Mark payment as received on the Invoice tab before recording payout.
        </div>
      )}

      <div className="detail-section-title">PAYOUT TO {(row.creator_name || 'CREATOR').toUpperCase()}</div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Payout Amount ($)</label>
          <input className="form-input" type="number" step="0.01" value={form.payout_amount}
            onChange={e => setForm(f => ({ ...f, payout_amount: e.target.value }))} />
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
        <input className="form-input" value={form.payout_notes}
          onChange={e => setForm(f => ({ ...f, payout_notes: e.target.value }))}
          placeholder="e.g. Deducted $12 processing fee" />
      </div>

      <div className="divider" />

      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="detail-section-title" style={{ marginBottom: 2 }}>DESTINATION SPLITS</div>
          <div style={{ fontSize: 11, color: Math.abs(totalPct - 100) < 0.01 ? 'var(--green)' : 'var(--orange)' }}>
            {totalPct.toFixed(1)}% allocated of {fmtMoney(payoutAmt)}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSplitForms(sf => [...sf, { destination_id: '', percentage: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '', notes: '' }])}>
          + Add Split
        </button>
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
                if (sf.id) {
                  if (!window.confirm('Remove this split? This cannot be undone.')) return;
                  await supabase.from('payout_splits').delete().eq('id', sf.id);
                }
                setSplitForms(sf2 => sf2.filter((_, idx) => idx !== i));
              }}>Remove</button>
            )}
          </div>

          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination</label>
              <select className="form-select" value={sf.destination_id} onChange={e => setSF(i, 'destination_id', e.target.value)}>
                <option value="">Select...</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.account_type}{d.account_last4 ? ` ···${d.account_last4}` : ''}{d.institution ? ` (${d.institution})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Percentage / Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="form-input"
                  type="number" min="0" max="100" step="0.01"
                  value={sf.percentage}
                  onChange={e => {
                    const pct = e.target.value;
                    const amt = payoutAmt && pct !== '' ? (payoutAmt * parseFloat(pct) / 100).toFixed(2) : '';
                    setSF(i, 'percentage', pct);
                    setSF(i, 'amount_override', amt);
                  }}
                  style={{ width: 72 }}
                  placeholder="%"
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>%  =</span>
                <input
                  className="form-input"
                  type="number" min="0" step="0.01"
                  value={sf.amount_override ?? (payoutAmt && sf.percentage ? (payoutAmt * parseFloat(sf.percentage) / 100).toFixed(2) : '')}
                  onChange={e => {
                    const amt = e.target.value;
                    const pct = payoutAmt && amt !== '' ? ((parseFloat(amt) / payoutAmt) * 100).toFixed(4) : '';
                    setSF(i, 'amount_override', amt);
                    setSF(i, 'percentage', pct);
                  }}
                  style={{ width: 90 }}
                  placeholder="$0.00"
                />
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
      </>
      )}
    </div>
  );
}
