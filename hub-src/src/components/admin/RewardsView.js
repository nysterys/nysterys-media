import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { fmtDate, fmtMoney, fmtMonth, isValidDateString, isValidNumber } from '../../utils/format';

function isInKind(m) { return (m || '').toLowerCase() === 'in kind'; }

function PayoutBadge({ status }) {
  const map = { 'Pending': 'badge-not-invoiced', 'Partial': 'badge-pending', 'Paid': 'badge-paid', 'On Hold': 'badge-overdue', 'N/A': 'badge-not-invoiced' };
  return <span className={`badge ${map[status] || 'badge-not-invoiced'}`}>{status || 'Pending'}</span>;
}

const AGENCY_STATUSES = ['Not Invoiced', 'Invoiced', 'Pending', 'Paid', 'Overdue'];
const PAYOUT_STATUSES = ['Pending', 'Partial', 'Paid', 'On Hold'];
const SPLIT_STATUSES  = ['Pending', 'Sent', 'Cleared', 'Failed'];

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

async function getSignedUrl(bucket, path) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  return data?.signedUrl || null;
}

export default function RewardsView() {
  const [entries, setEntries] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [creators, setCreators] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  const [monthFilter, setMonthFilter] = useState(lastMonth);
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showPrograms, setShowPrograms] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [sumRes, progRes, crRes, plRes] = await Promise.all([
      supabase.from('reward_payout_summary').select('*').order('period_month', { ascending: false }),
      supabase.from('platform_rewards_programs').select('*, platform:platforms(name)').eq('is_active', true),
      supabase.from('profiles').select('*').eq('role', 'creator'),
      supabase.from('platforms').select('*').eq('is_active', true),
    ]);
    setEntries(sumRes.data || []);
    setPrograms(progRes.data || []);
    setCreators(crRes.data || []);
    setPlatforms(plRes.data || []);
    setLoading(false);
  }

  const months = [...new Set((entries || []).map(e => e.period_month?.slice(0, 7)).filter(Boolean))].sort().reverse();

  const filtered = entries.filter(e => {
    if (creatorFilter !== 'all' && e.profile_id !== creatorFilter) return false;
    if (programFilter !== 'all' && e.program_id !== programFilter) return false;
    if (monthFilter !== 'all' && e.period_month?.slice(0, 7) !== monthFilter) return false;
    return true;
  });

  const totalGross   = filtered.reduce((s, e) => s + (e.gross_amount || 0), 0);
  const totalReceived = filtered.filter(e => e.you_received).reduce((s, e) => s + (e.amount_received || e.invoice_amount || 0), 0);
  const totalPaidOut  = filtered.filter(e => e.payout_status === 'Paid').reduce((s, e) => s + (e.payout_amount || 0), 0);
  const totalPending  = filtered.filter(e => e.payout_status !== 'Paid').reduce((s, e) => s + (e.gross_amount || 0), 0);
  const totalFees     = filtered.reduce((s, e) => s + (e.processing_fee || 0), 0);

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">REWARDS</div>
          <div className="page-subtitle">Platform creator rewards program earnings</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowPrograms(true)}>Manage Programs</button>
          <button className="btn btn-primary" onClick={() => setSelected({ _new: true })}>+ Add Entry</button>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22 }}>{fmtMoney(totalGross)}</div><div className="stat-label">Gross Earned</div></div>
        <div className="stat-card"><div className="stat-value stat-green" style={{ fontSize: 22 }}>{fmtMoney(totalReceived)}</div><div className="stat-label">You Received</div></div>
        <div className="stat-card"><div className="stat-value stat-accent" style={{ fontSize: 22 }}>{fmtMoney(totalPaidOut)}</div><div className="stat-label">Paid to Creators</div></div>
        <div className="stat-card"><div className="stat-value stat-orange" style={{ fontSize: 22 }}>{fmtMoney(totalPending)}</div><div className="stat-label">Pending Payout</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: 22, color: totalFees > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{fmtMoney(totalFees)}</div><div className="stat-label">Fees Paid</div></div>
      </div>

      <div className="filters-row" style={{ flexWrap: 'wrap' }}>
        <span className="text-muted text-xs">CREATOR</span>
        <button className={`filter-chip ${creatorFilter === 'all' ? 'active' : ''}`} onClick={() => setCreatorFilter('all')}>All</button>
        {creators.map(c => <button key={c.id} className={`filter-chip ${creatorFilter === c.id ? 'active' : ''}`} onClick={() => setCreatorFilter(c.id)}>{c.creator_name || c.full_name}</button>)}
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 6px' }} />
        <span className="text-muted text-xs">PROGRAM</span>
        <button className={`filter-chip ${programFilter === 'all' ? 'active' : ''}`} onClick={() => setProgramFilter('all')}>All</button>
        {programs.map(p => <button key={p.id} className={`filter-chip ${programFilter === p.id ? 'active' : ''}`} onClick={() => setProgramFilter(p.id)}>{p.name}</button>)}
        {months.length > 0 && (
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12, marginLeft: 8 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="all">All time</option>
            {months.map(m => { const [y, mo] = m.split('-'); return <option key={m} value={m}>{new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</option>; })}
          </select>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Creator</th><th>Platform</th><th>Program</th><th>Period</th>
              <th>Gross</th><th>Platform Status</th><th>Fees Paid</th><th>You Received</th><th>Payout Status</th><th>Paid Out</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No reward entries yet. Click + Add Entry to get started.</td></tr>
            ) : filtered.map(e => (
              <tr key={e.entry_id} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 500 }}>{e.creator_name || e.creator_full_name || '—'}</td>
                <td>{e.platform_name || '—'}</td>
                <td>{e.program_name}</td>
                <td>{e.period_month ? new Date(e.period_month + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                <td style={{ fontWeight: 600 }}>{fmtMoney(e.gross_amount)}</td>
                <td><Badge status={e.agency_payment_status || 'Not Invoiced'} /></td>
                <td>{e.processing_fee > 0 ? <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>{fmtMoney(e.processing_fee)}</span> : <span className="text-muted">—</span>}</td>
                <td>{e.you_received ? <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>✓ {fmtDate(e.you_received_date)}</span> : <span className="text-muted text-xs">Not yet</span>}</td>
                <td><PayoutBadge status={e.payout_status || 'Pending'} /></td>
                <td>{e.payout_amount != null ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtMoney(e.payout_amount)}</span> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <RewardDetailPanel
          entry={selected}
          programs={programs}
          creators={creators}
          onClose={() => setSelected(null)}
          onUpdated={() => { fetchAll(); setSelected(null); }}
          onUpdatedKeepOpen={() => fetchAll()}
        />
      )}

      {showPrograms && (
        <ProgramsModal platforms={platforms} onClose={() => { setShowPrograms(false); fetchAll(); }} />
      )}
    </div>
  );
}

// ============================================================
// Reward Detail Panel — new entry or existing
// ============================================================
function RewardDetailPanel({ entry, programs, creators, onClose, onUpdated, onUpdatedKeepOpen }) {
  const isNew = entry?._new;
  const [tab, setTab] = useState('entry');
  const [entryData, setEntryData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew) fetchDetail(true);
  }, [entry?.entry_id]);

  async function fetchDetail(initial = false) {
    if (initial) setInitialLoading(true);
    const { data } = await supabase.from('reward_payout_summary').select('*').eq('entry_id', entry.entry_id).single();
    setEntryData(data);
    if (initial) setInitialLoading(false);
  }

  const data = isNew ? null : (entryData || entry);

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="flex items-center justify-between mb-8">
          <span className="text-muted text-xs">{isNew ? 'New Entry' : data?.platform_name}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>
        {!isNew && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 1 }}>{data?.program_name}</div>
            <div className="text-muted mt-4">{data?.creator_name || data?.creator_full_name}</div>
            <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 18, marginTop: 8 }}>{fmtMoney(data?.gross_amount)}</div>
          </>
        )}
      </div>

      <div className="tabs" style={{ padding: '0 24px' }}>
        {(isNew ? ['entry'] : ['entry', 'invoice', 'payout']).map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'entry' ? 'Reward Entry' : t === 'invoice' ? 'Invoice (Platform → You)' : 'Payout (You → Creator)'}
          </div>
        ))}
      </div>

      <div className="detail-body">
        {initialLoading ? <div className="text-muted">Loading...</div> : (
          <>
            {tab === 'entry' && (
              <EntryForm
                entry={isNew ? null : data}
                programs={programs}
                creators={creators}
                onSaved={() => {
                  if (isNew) onUpdated();
                  else { onUpdatedKeepOpen(); fetchDetail(); }
                }}
              />
            )}
            {tab === 'invoice' && !isNew && (
              <RewardInvoiceForm entry={data} onUpdated={() => { onUpdatedKeepOpen(); fetchDetail(); }} />
            )}
            {tab === 'payout' && !isNew && (
              <RewardPayoutForm entry={data} onUpdated={() => { onUpdatedKeepOpen(); fetchDetail(); }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Entry form — create or edit
// ============================================================
function EntryForm({ entry, programs, creators, onSaved }) {
  const [form, setForm] = useState({
    program_id: entry?.program_id || '',
    profile_id: entry?.profile_id || '',
    period_month: entry?.period_month ? entry.period_month.slice(0, 7) : '',
    gross_amount: entry?.gross_amount ?? '',
    notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.program_id || !form.profile_id || !form.period_month) { alert('Program, creator, and period are required.'); return; }
    if (form.gross_amount !== '' && !isValidNumber(form.gross_amount)) { alert('Gross amount must be a number.'); return; }
    setSaving(true);
    const payload = {
      program_id: form.program_id,
      profile_id: form.profile_id,
      period_month: form.period_month + '-01',
      gross_amount: form.gross_amount !== '' ? parseFloat(form.gross_amount) : null,
      notes: form.notes || null,
    };
    if (entry?.entry_id) {
      await supabase.from('platform_reward_entries').update(payload).eq('id', entry.entry_id);
    } else {
      await supabase.from('platform_reward_entries').insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div>
      <div className="detail-section-title">REWARD ENTRY</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Program</label>
          <select className="form-select" value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}>
            <option value="">Select...</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.platform?.name} — {p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Creator</label>
          <select className="form-select" value={form.profile_id} onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))}>
            <option value="">Select...</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Period (Month)</label>
          <input className="form-input" type="month" value={form.period_month} onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Gross Amount ($)</label>
          <input className="form-input" type="number" step="0.01" value={form.gross_amount} onChange={e => setForm(f => ({ ...f, gross_amount: e.target.value }))} placeholder="0.00" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 52 }} />
      </div>
      <button className="btn btn-primary w-full mt-12" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
        {saving ? 'Saving...' : entry?.entry_id ? 'Update Entry' : 'Create Entry'}
      </button>
    </div>
  );
}

// ============================================================
// Reward Invoice Form — platform paying Patrick
// ============================================================
function RewardInvoiceForm({ entry, onUpdated }) {
  const [invoice, setInvoice] = useState(undefined); // undefined = not yet loaded
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [receiptPath, setReceiptPath] = useState(null);
  const [receiptName, setReceiptName] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Compute auto-fill defaults from entry
  function getAutoFillDates() {
    // Invoice date = last day of period month
    let invoiceDate = '';
    if (entry?.period_month) {
      const [y, mo] = entry.period_month.slice(0, 7).split('-').map(Number);
      const lastDay = new Date(y, mo, 0); // day 0 of next month = last day of this month
      invoiceDate = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    }
    // Paid date = payout_day of month following period month
    let paidDate = '';
    if (entry?.period_month && entry?.payout_day) {
      const [y, mo] = entry.period_month.slice(0, 7).split('-').map(Number);
      const nextMonth = mo === 12 ? 1 : mo + 1;
      const nextYear = mo === 12 ? y + 1 : y;
      const day = String(Math.min(entry.payout_day, 28)).padStart(2, '0');
      paidDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${day}`;
    }
    return { invoiceDate, paidDate };
  }

  useEffect(() => {
    loadAll();
  }, [entry?.entry_id]);

  async function loadAll() {
    const [invRes, pmRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('reward_entry_id', entry.entry_id).maybeSingle(),
      supabase.from('payment_methods').select('*').eq('is_active', true).order('sort_order').order('name'),
    ]);
    const inv = invRes.data;
    setInvoice(inv);
    setPaymentMethods(pmRes.data || []);
    setReceiptPath(inv?.receipt_path || null);
    setReceiptName(inv?.receipt_name || null);

    const { invoiceDate, paidDate } = getAutoFillDates();
    setForm({
      invoice_number: inv?.invoice_number || '',
      invoice_date: inv?.invoice_date || invoiceDate,
      invoice_amount: inv?.invoice_amount ?? entry?.gross_amount ?? '',
      payment_status: inv?.payment_status || 'Not Invoiced',
      payment_received_date: inv?.payment_received_date || paidDate,
      payment_method: inv?.payment_method || '',
      payment_notes: inv?.payment_notes || '',
      you_received: inv?.you_received ?? false,
      you_received_date: inv?.you_received_date || '',
      amount_received: inv?.amount_received ?? '',
      processing_fee: inv?.processing_fee ?? '',
      you_received_notes: inv?.you_received_notes || '',
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const payload = {
      invoice_number: form.invoice_number || null,
      invoice_date: form.invoice_date || null,
      invoice_amount: form.invoice_amount !== '' ? parseFloat(form.invoice_amount) : null,
      payment_status: form.payment_status,
      payment_received_date: form.payment_received_date || null,
      payment_method: form.payment_method || null,
      payment_notes: form.payment_notes || null,
      you_received: form.you_received,
      you_received_date: form.you_received_date || null,
      amount_received: form.amount_received !== '' ? parseFloat(form.amount_received) : null,
      processing_fee: form.processing_fee !== '' ? parseFloat(form.processing_fee) : 0,
      you_received_notes: form.you_received_notes || null,
      reward_entry_id: entry.entry_id,
      campaign_id: null,
    };
    let savedInvoice = invoice;
    if (invoice) {
      await supabase.from('invoices').update(payload).eq('id', invoice.id);
    } else {
      const { data: newInv } = await supabase.from('invoices').insert(payload).select().single();
      savedInvoice = newInv;
    }
    // Update local invoice ref so receipt operations have the right id
    setInvoice(savedInvoice);
    setSaving(false);
    onUpdated();
  }

  async function uploadReceipt(file) {
    let invId = invoice?.id;
    if (!invId) {
      const { data: newInv } = await supabase.from('invoices').insert({
        reward_entry_id: entry.entry_id,
        payment_status: form?.payment_status || 'Not Invoiced',
        campaign_id: null,
      }).select().single();
      invId = newInv?.id;
      setInvoice(newInv);
    }
    if (!invId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `receipts/${invId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('payment-receipts').upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from('invoices').update({ receipt_path: path, receipt_name: file.name }).eq('id', invId);
      setReceiptPath(path);
      setReceiptName(file.name);
    }
    setUploading(false);
  }

  if (invoice === undefined || !form) return <div className="text-muted">Loading...</div>;

  const { invoiceDate, paidDate } = getAutoFillDates();
  const expectedPayoutDate = paidDate
    ? new Date(paidDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div>
      {expectedPayoutDate && (
        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Expected platform payout: <strong style={{ color: 'var(--text)' }}>{expectedPayoutDate}</strong>
        </div>
      )}
      <div className="detail-section-title">PLATFORM PAYMENT TO YOU</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Invoice #</label>
          <input className="form-input" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="form-group">
          <label className="form-label">Invoice Date</label>
          <input className="form-input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Amount ($)</label>
          <input className="form-input" type="number" step="0.01" value={form.invoice_amount} onChange={e => setForm(f => ({ ...f, invoice_amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}>
            {AGENCY_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Paid Date</label>
          <input className="form-input" type="date" value={form.payment_received_date} onChange={e => setForm(f => ({ ...f, payment_received_date: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Payment Method</label>
          <select className="form-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
            <option value="">Select...</option>
            {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={form.payment_notes} onChange={e => setForm(f => ({ ...f, payment_notes: e.target.value }))} style={{ minHeight: 44 }} />
      </div>

      <div className="divider" />
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
              <input className="form-input" type="number" step="0.01" value={form.amount_received} onChange={e => setForm(f => ({ ...f, amount_received: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Processing Fee ($)</label>
            <input className="form-input" type="number" step="0.01" value={form.processing_fee} onChange={e => setForm(f => ({ ...f, processing_fee: e.target.value }))} placeholder="0.00" />
          </div>
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
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={async () => {
            if (!window.confirm('Remove receipt?')) return;
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

// ============================================================
// Reward Payout Form — Patrick paying creator
// ============================================================
function RewardPayoutForm({ entry, onUpdated }) {
  const [payout, setPayout] = useState(null);
  const [splits, setSplits] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPayout(); }, [entry?.entry_id]);

  async function loadPayout() {
    setLoading(true);
    const [payRes, destRes] = await Promise.all([
      supabase.from('creator_payouts').select('*, payout_splits(*, destination:payment_destinations(*))').eq('reward_entry_id', entry.entry_id).maybeSingle(),
      supabase.from('payment_destinations').select('*').eq('profile_id', entry.profile_id).eq('is_active', true).order('sort_order'),
    ]);
    setPayout(payRes.data);
    setSplits(payRes.data?.payout_splits || []);
    setDestinations(destRes.data || []);
    setLoading(false);
  }

  const [form, setForm] = useState({ payout_amount: '', payout_status: 'Pending', payout_date: '', payout_notes: '' });
  useEffect(() => {
    if (!loading) {
      setForm({
        payout_amount: payout?.payout_amount ?? entry?.amount_received ?? entry?.gross_amount ?? '',
        payout_status: payout?.payout_status || 'Pending',
        payout_date: payout?.payout_date || '',
        payout_notes: payout?.payout_notes || '',
      });
    }
  }, [loading]);

  const defaultSplits = () => {
    if (destinations.length >= 2) return [
      { destination_id: destinations[0].id, percentage: '50', amount_override: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '' },
      { destination_id: destinations[1].id, percentage: '50', amount_override: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '' },
    ];
    if (destinations.length === 1) return [{ destination_id: destinations[0].id, percentage: '100', amount_override: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '' }];
    return [{ destination_id: '', percentage: '100', amount_override: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '' }];
  };

  const [splitForms, setSplitForms] = useState([]);
  useEffect(() => {
    if (!loading) {
      setSplitForms(splits.length > 0
        ? splits.map(s => ({ id: s.id, destination_id: s.destination_id || '', percentage: String(s.percentage ?? ''), amount_override: s.amount != null ? String(s.amount) : '', split_status: s.split_status || 'Pending', sent_date: s.sent_date || '', cleared_date: s.cleared_date || '', reference: s.reference || '' }))
        : defaultSplits()
      );
    }
  }, [loading]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const payoutAmt = parseFloat(form.payout_amount) || 0;
  const totalPct = splitForms.reduce((s, f) => s + (parseFloat(f.percentage) || 0), 0);

  function setSF(i, k, v) { setSplitForms(sf => sf.map((s, idx) => idx === i ? { ...s, [k]: v } : s)); }

  async function save() {
    if (Math.abs(totalPct - 100) > 0.01) { setError(`Splits must total 100%. Currently ${totalPct.toFixed(1)}%`); return; }
    if (splitForms.some(s => !s.destination_id)) { setError('All splits need a destination.'); return; }
    setSaving(true); setError('');

    const payloadPayout = {
      profile_id: entry.profile_id,
      reward_entry_id: entry.entry_id,
      campaign_id: null,
      payout_amount: payoutAmt || null,
      payout_status: form.payout_status,
      payout_date: form.payout_date || null,
      payout_notes: form.payout_notes || null,
    };

    let payoutId = payout?.id;
    if (payout) {
      await supabase.from('creator_payouts').update(payloadPayout).eq('id', payout.id);
    } else {
      const { data: np } = await supabase.from('creator_payouts').insert(payloadPayout).select().single();
      payoutId = np?.id;
    }
    if (!payoutId) { setError('Failed to save payout.'); setSaving(false); return; }

    for (const sf of splitForms) {
      const amt = sf.amount_override !== undefined && sf.amount_override !== ''
        ? parseFloat(parseFloat(sf.amount_override).toFixed(2))
        : payoutAmt ? parseFloat((payoutAmt * parseFloat(sf.percentage) / 100).toFixed(2)) : null;
      const sp = { payout_id: payoutId, destination_id: sf.destination_id, percentage: parseFloat(sf.percentage), amount: amt, split_status: sf.split_status, sent_date: sf.sent_date || null, cleared_date: sf.cleared_date || null, reference: sf.reference || null };
      if (sf.id) await supabase.from('payout_splits').update(sp).eq('id', sf.id);
      else await supabase.from('payout_splits').insert(sp);
    }
    setSaving(false);
    onUpdated();
    loadPayout();
  }

  if (loading) return <div className="text-muted">Loading...</div>;

  return (
    <div>
      {!entry.you_received && (
        <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 12, background: 'rgba(255,156,58,0.08)', border: '1px solid rgba(255,156,58,0.2)', color: 'var(--orange)' }}>
          Mark payment as received on the Invoice tab before recording payout.
        </div>
      )}

      <div className="detail-section-title">PAYOUT TO {(entry?.creator_name || 'CREATOR').toUpperCase()}</div>
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
        <input className="form-input" value={form.payout_notes} onChange={e => setForm(f => ({ ...f, payout_notes: e.target.value }))} />
      </div>

      <div className="divider" />
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="detail-section-title" style={{ marginBottom: 2 }}>DESTINATION SPLITS</div>
          <div style={{ fontSize: 11, color: Math.abs(totalPct - 100) < 0.01 ? 'var(--green)' : 'var(--orange)' }}>
            {totalPct.toFixed(1)}% allocated of {fmtMoney(payoutAmt)}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSplitForms(sf => [...sf, { destination_id: '', percentage: '', amount_override: '', split_status: 'Pending', sent_date: '', cleared_date: '', reference: '' }])}>+ Add Split</button>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      {splitForms.map((sf, i) => (
        <div key={i} className="deliverable-card" style={{ marginBottom: 10 }}>
          <div className="deliverable-card-header">
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Split {i + 1}</span>
            {splitForms.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                if (sf.id) { if (!window.confirm('Remove split?')) return; await supabase.from('payout_splits').delete().eq('id', sf.id); }
                setSplitForms(sf2 => sf2.filter((_, idx) => idx !== i));
              }}>Remove</button>
            )}
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Destination</label>
              <select className="form-select" value={sf.destination_id} onChange={e => setSF(i, 'destination_id', e.target.value)}>
                <option value="">Select...</option>
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name} — {d.account_type}{d.account_last4 ? ` ···${d.account_last4}` : ''}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Percentage / Amount</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" type="number" min="0" max="100" step="0.01" value={sf.percentage}
                  onChange={e => { const pct = e.target.value; const amt = payoutAmt && pct ? (payoutAmt * parseFloat(pct) / 100).toFixed(2) : ''; setSF(i, 'percentage', pct); setSF(i, 'amount_override', amt); }}
                  style={{ width: 70 }} placeholder="%" />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>% =</span>
                <input className="form-input" type="number" min="0" step="0.01" value={sf.amount_override}
                  onChange={e => { const amt = e.target.value; const pct = payoutAmt && amt ? ((parseFloat(amt) / payoutAmt) * 100).toFixed(4) : ''; setSF(i, 'amount_override', amt); setSF(i, 'percentage', pct); }}
                  style={{ width: 90 }} placeholder="$0.00" />
              </div>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Status</label>
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

// ============================================================
// Programs Modal — manage reward programs
// ============================================================
function ProgramsModal({ platforms, onClose }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', platform_id: '', description: '', payout_day: 15 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('platform_rewards_programs').select('*, platform:platforms(name)').order('created_at');
    setPrograms(data || []);
    setLoading(false);
  }

  function startEdit(p) {
    setEditing(p?.id || 'new');
    setForm(p ? { name: p.name, platform_id: p.platform_id || '', description: p.description || '', payout_day: p.payout_day || 15 } : { name: '', platform_id: '', description: '', payout_day: 15 });
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), platform_id: form.platform_id || null, description: form.description || null, payout_day: parseInt(form.payout_day) || 15 };
    if (editing === 'new') await supabase.from('platform_rewards_programs').insert(payload);
    else await supabase.from('platform_rewards_programs').update(payload).eq('id', editing);
    setSaving(false);
    setEditing(null);
    load();
  }

  async function toggleActive(p) {
    await supabase.from('platform_rewards_programs').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ fontSize: 20 }}>REWARD PROGRAMS</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? <div className="text-muted">Loading...</div> : (
            <>
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>Program</th><th>Platform</th><th>Payout Day</th><th>Active</th><th></th></tr></thead>
                  <tbody>
                    {programs.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td>{p.platform?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>15th of following month</td>
                        <td><span style={{ color: p.is_active ? 'var(--green)' : 'var(--text-muted)', fontSize: 12 }}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div className="flex gap-6">
                            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>Edit</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: p.is_active ? 'var(--red)' : 'var(--green)' }} onClick={() => toggleActive(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editing ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 12 }}>
                    {editing === 'new' ? 'New Program' : 'Edit Program'}
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Creator Rewards" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Platform</label>
                      <select className="form-select" value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))}>
                        <option value="">Select...</option>
                        {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Payout Day (of following month)</label>
                      <input className="form-input" type="number" min="1" max="28" value={form.payout_day} onChange={e => setForm(f => ({ ...f, payout_day: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => startEdit(null)}>+ Add Program</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
