import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth, isToday } from 'date-fns';

const STATUS_COLORS = {
  'Not Started':         '#6b7280',
  'Draft Submitted':     '#3b82f6',
  'Revisions Requested': '#f97316',
  'Approved':            '#8b5cf6',
  'Posted':              '#10b981',
};

const STATUS_LABELS = {
  'Not Started':         'Planned',
  'Draft Submitted':     'Draft',
  'Revisions Requested': 'Revisions',
  'Approved':            'Approved',
  'Posted':              'Posted',
};

// Two distinct colors for Kym and Mys (extended if more creators added)
const CREATOR_PALETTE = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24'];

// Extract readable label: brand_name first, then agency segment of campaign_name code
function chipLabel(campaign_name, brand_name) {
  if (brand_name) return brand_name;
  const parts = (campaign_name || '').split('-');
  return parts.length >= 4 ? parts.slice(3).join('-') : (campaign_name || '?');
}

function DeliverableChip({ d, creatorColor, isDragging, onDragStart, onDragEnd, onClick }) {
  const statusColor = STATUS_COLORS[d.draft_status] || '#6b7280';
  const isPosted = d.draft_status === 'Posted';
  const label = chipLabel(d.campaign_name, d.brand_name);

  return (
    <div
      draggable={!isPosted}
      onDragStart={!isPosted ? e => { e.dataTransfer.setData('deliverable_id', d.id); onDragStart?.(d); } : undefined}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(d)}
      title={`${label} · ${d.creator_name} · ${d.platform_name}`}
      style={{
        padding: '4px 8px',
        borderRadius: 5,
        marginBottom: 4,
        cursor: isPosted ? 'default' : 'grab',
        background: `${creatorColor}18`,
        border: `1px solid ${creatorColor}30`,
        borderLeft: `3px solid ${creatorColor}`,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'opacity 0.15s',
        minHeight: 36,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
          {d.creator_name} · {d.platform_name}
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, flexShrink: 0,
        color: statusColor,
        background: `${statusColor}22`,
        padding: '2px 5px', borderRadius: 3,
        whiteSpace: 'nowrap',
      }}>
        {STATUS_LABELS[d.draft_status] || d.draft_status}
      </span>
    </div>
  );
}

const MAX_MONTH_CHIPS = 3;

export default function CalendarView() {
  const [deliverables, setDeliverables] = useState([]);
  const [creators, setCreators]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState('week');
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [draggingId, setDraggingId]     = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [selected, setSelected]         = useState(null);
  const [dayModal, setDayModal]         = useState(null); // { date, items }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const [delRes, crRes] = await Promise.all([
      supabase.from('campaign_deliverables').select(`
        id, contracted_post_date, actual_post_date, draft_status, post_url, deliverable_details, quantity,
        platform:platforms(name),
        deliverable_type:deliverable_types(name),
        campaign:campaigns(id, campaign_name, brand_name, campaign_start_date, campaign_end_date,
          creator:profiles!campaigns_creator_profile_id_fkey(id, full_name, creator_name))
      `),
      supabase.from('profiles').select('id, full_name, creator_name').eq('role', 'creator').order('creator_name'),
    ]);

    const flat = (delRes.data || []).map(d => ({
      id:                   d.id,
      contracted_post_date: d.contracted_post_date,
      actual_post_date:     d.actual_post_date,
      draft_status:         d.draft_status,
      post_url:             d.post_url,
      deliverable_details:  d.deliverable_details,
      platform_name:        d.platform?.name || '?',
      type_name:            d.deliverable_type?.name || '',
      campaign_id:          d.campaign?.id,
      campaign_name:        d.campaign?.campaign_name || '?',
      brand_name:           d.campaign?.brand_name || '',
      campaign_start_date:  d.campaign?.campaign_start_date,
      campaign_end_date:    d.campaign?.campaign_end_date,
      creator_id:           d.campaign?.creator?.id,
      creator_name:         d.campaign?.creator?.creator_name || d.campaign?.creator?.full_name || '?',
    }));

    setDeliverables(flat);
    setCreators(crRes.data || []);
    setLoading(false);
  }

  // Map creator_id → color from palette
  const creatorColorMap = {};
  creators.forEach((c, i) => { creatorColorMap[c.id] = CREATOR_PALETTE[i % CREATOR_PALETTE.length]; });

  async function moveDeliverable(id, newDate) {
    const dateStr = format(newDate, 'yyyy-MM-dd');
    await supabase.from('campaign_deliverables').update({ contracted_post_date: dateStr }).eq('id', id);
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, contracted_post_date: dateStr } : d));
  }

  function getDeliverablesForDate(date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return deliverables.filter(d => {
      const postDate = d.draft_status === 'Posted' ? d.actual_post_date : d.contracted_post_date;
      if (!postDate || postDate !== dateStr) return false;
      if (creatorFilter !== 'all' && d.creator_id !== creatorFilter) return false;
      if (statusFilter !== 'all' && d.draft_status !== statusFilter) return false;
      return true;
    });
  }

  function navigate(dir) {
    if (view === 'month') setCurrentDate(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else setCurrentDate(d => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
  }

  let days = [];
  if (view === 'month') {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
  } else {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  }

  const isWeek = view === 'week';

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">CALENDAR</div>
          <div className="page-subtitle">Deliverable schedule across all campaigns</div>
        </div>
        <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-4">
            {['week', 'month'].map(v => (
              <button key={v} className={`filter-chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}>
            <option value="all">All Creators</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex gap-4 items-center">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
              {isWeek
                ? `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(1)}>›</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Status legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[k] }} />
              <span style={{ color: 'var(--text-muted)' }}>{v}</span>
            </div>
          ))}
        </div>
        {/* Creator legend */}
        {creators.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
            {creators.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: CREATOR_PALETTE[i % CREATOR_PALETTE.length] }} />
                <span style={{ color: 'var(--text-muted)' }}>{c.creator_name || c.full_name}</span>
              </div>
            ))}
          </div>
        )}
        <span style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 'auto' }}>Drag unposted deliverables to reschedule</span>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {(isWeek
            ? days.map(d => format(d, 'EEE'))
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          ).map((label, i) => (
            <div key={i} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {label}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, i) => {
            const items    = getDeliverablesForDate(day);
            const todayFlag = isToday(day);
            const isOtherMonth = !isSameMonth(day, currentDate) && view === 'month';
            const isOver   = dragOverDate && isSameDay(dragOverDate, day);
            const visible  = isWeek ? items : items.slice(0, MAX_MONTH_CHIPS);
            const overflow = isWeek ? 0 : Math.max(0, items.length - MAX_MONTH_CHIPS);

            return (
              <div
                key={i}
                onDragOver={e => { e.preventDefault(); setDragOverDate(day); }}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={e => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('deliverable_id');
                  if (id) moveDeliverable(id, day);
                  setDragOverDate(null);
                  setDraggingId(null);
                }}
                style={{
                  minHeight: isWeek ? 200 : 110,
                  padding: '8px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: isOver
                    ? 'rgba(255,92,0,0.08)'
                    : isOtherMonth
                      ? 'rgba(0,0,0,0.18)'
                      : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Date number */}
                <div style={{ marginBottom: 8 }}>
                  {todayFlag ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--orange)', color: '#000',
                      borderRadius: '50%',
                      width: isWeek ? 32 : 24, height: isWeek ? 32 : 24,
                      fontSize: isWeek ? 15 : 12, fontWeight: 700,
                    }}>
                      {format(day, 'd')}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: isWeek ? 15 : 12,
                      fontWeight: 500,
                      color: isOtherMonth ? 'var(--dim)' : 'var(--text-muted)',
                    }}>
                      {format(day, 'd')}
                    </span>
                  )}
                  {items.length > 0 && (
                    <span style={{ fontSize: 9, background: 'var(--surface3)', color: 'var(--text-muted)', borderRadius: 8, padding: '1px 5px', marginLeft: 5 }}>
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Chips */}
                {visible.map(d => (
                  <DeliverableChip
                    key={d.id}
                    d={d}
                    creatorColor={creatorColorMap[d.creator_id] || '#6b7280'}
                    isDragging={draggingId === d.id}
                    onDragStart={d => setDraggingId(d.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={d => setSelected(d)}
                  />
                ))}

                {/* Overflow link */}
                {overflow > 0 && (
                  <button
                    onClick={() => setDayModal({ date: day, items })}
                    style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontWeight: 600 }}
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day overflow modal */}
      {dayModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDayModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">{format(dayModal.date, 'EEEE, MMMM d')}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setDayModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {dayModal.items.map(d => (
                <DeliverableChip
                  key={d.id}
                  d={d}
                  creatorColor={creatorColorMap[d.creator_id] || '#6b7280'}
                  isDragging={false}
                  onClick={d => { setDayModal(null); setSelected(d); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail popup */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{chipLabel(selected.campaign_name, selected.brand_name)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.creator_name} · {selected.platform_name}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><div className="detail-item-label">Status</div><div className="detail-item-value"><Badge status={selected.draft_status} /></div></div>
                <div><div className="detail-item-label">Type</div><div className="detail-item-value">{selected.type_name || '—'}</div></div>
                <div><div className="detail-item-label">Planned Date</div><div className="detail-item-value">{selected.contracted_post_date || '—'}</div></div>
                {selected.actual_post_date && (
                  <div><div className="detail-item-label">Posted</div><div className="detail-item-value" style={{ color: '#10b981' }}>✓ {selected.actual_post_date}</div></div>
                )}
                {selected.deliverable_details && (
                  <div style={{ gridColumn: 'span 2' }}><div className="detail-item-label">Details</div><div className="detail-item-value">{selected.deliverable_details}</div></div>
                )}
                {selected.post_url && (
                  <div style={{ gridColumn: 'span 2' }}><div className="detail-item-label">Post</div><div className="detail-item-value"><a href={selected.post_url} target="_blank" rel="noreferrer" className="link">View Post ↗</a></div></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
