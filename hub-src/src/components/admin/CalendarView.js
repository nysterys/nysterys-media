import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../shared/Badge';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth, parseISO, isToday } from 'date-fns';

const STATUS_COLORS = {
  'Not Started':         'var(--text-muted)',
  'Draft Submitted':     'var(--blue)',
  'Revisions Requested': 'var(--orange)',
  'Approved':            'var(--accent)',
  'Posted':              'var(--green)',
};

const STATUS_LABELS = {
  'Not Started':         'Planned',
  'Draft Submitted':     'Draft Submitted',
  'Revisions Requested': 'Revisions',
  'Approved':            'Approved',
  'Posted':              'Posted',
};

function DeliverableChip({ d, isDragging, onDragStart, onDragEnd, onClick }) {
  const color = STATUS_COLORS[d.draft_status] || 'var(--text-muted)';
  const isPosted = d.draft_status === 'Posted';
  const draggable = !isPosted;

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('deliverable_id', d.id); onDragStart && onDragStart(d); } : undefined}
      onDragEnd={onDragEnd}
      onClick={() => onClick && onClick(d)}
      style={{
        padding: '3px 7px',
        borderRadius: 4,
        fontSize: 11,
        marginBottom: 3,
        cursor: draggable ? 'grab' : 'default',
        background: `${color}18`,
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, fontSize: 10, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {d.campaign_name}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {d.creator_name} · {d.platform_name}
        </div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {STATUS_LABELS[d.draft_status] || d.draft_status}
      </div>
    </div>
  );
}

export default function CalendarView() {
  const [deliverables, setDeliverables] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month'); // 'month' | 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [selected, setSelected] = useState(null);

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
      supabase.from('profiles').select('id, full_name, creator_name').eq('role', 'creator'),
    ]);

    const flat = (delRes.data || []).map(d => ({
      id: d.id,
      contracted_post_date: d.contracted_post_date,
      actual_post_date: d.actual_post_date,
      draft_status: d.draft_status,
      post_url: d.post_url,
      deliverable_details: d.deliverable_details,
      platform_name: d.platform?.name || '?',
      type_name: d.deliverable_type?.name || '',
      campaign_id: d.campaign?.id,
      campaign_name: d.campaign?.campaign_name || '?',
      brand_name: d.campaign?.brand_name || '',
      campaign_start_date: d.campaign?.campaign_start_date,
      campaign_end_date: d.campaign?.campaign_end_date,
      creator_id: d.campaign?.creator?.id,
      creator_name: d.campaign?.creator?.creator_name || d.campaign?.creator?.full_name || '?',
    }));

    setDeliverables(flat);
    setCreators(crRes.data || []);
    setLoading(false);
  }

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

  // Build days grid
  let days = [];
  if (view === 'month') {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
  } else {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  }

  const isWeek = view === 'week';
  const cellMinHeight = isWeek ? 180 : 100;

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
          {/* View toggle */}
          <div className="flex gap-4">
            {['month', 'week'].map(v => (
              <button key={v} className={`filter-chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Creator filter */}
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}>
            <option value="all">All Creators</option>
            {creators.map(c => <option key={c.id} value={c.id}>{c.creator_name || c.full_name}</option>)}
          </select>
          {/* Status filter */}
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {/* Navigation */}
          <div className="flex gap-4 items-center">
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
              {view === 'month'
                ? format(currentDate, 'MMMM yyyy')
                : `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d, yyyy')}`}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(1)}>›</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-12 mb-16" style={{ flexWrap: 'wrap', fontSize: 11 }}>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-6">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[k] }} />
            <span style={{ color: 'var(--text-muted)' }}>{v}</span>
          </div>
        ))}
        <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>Drag unposted deliverables to reschedule</span>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase' }}>
              {isWeek ? d : d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, i) => {
            const items = getDeliverablesForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isOver = dragOverDate && isSameDay(dragOverDate, day);
            const todayFlag = isToday(day);

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
                  minHeight: cellMinHeight,
                  padding: '6px 6px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: isOver
                    ? 'rgba(255,92,0,0.08)'
                    : !isCurrentMonth && view === 'month'
                      ? 'rgba(0,0,0,0.15)'
                      : 'transparent',
                  transition: 'background 0.1s',
                  verticalAlign: 'top',
                }}
              >
                {/* Date number */}
                <div style={{
                  fontSize: isWeek ? 20 : 13,
                  fontWeight: todayFlag ? 700 : 400,
                  color: todayFlag ? 'var(--orange)' : !isCurrentMonth && view === 'month' ? 'var(--text-dim)' : 'var(--text)',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  {todayFlag ? (
                    <span style={{ background: 'var(--orange)', color: 'var(--black)', borderRadius: '50%', width: isWeek ? 30 : 22, height: isWeek ? 30 : 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isWeek ? 16 : 12 }}>
                      {format(day, 'd')}
                    </span>
                  ) : (
                    <span>{isWeek ? format(day, 'EEE d') : format(day, 'd')}</span>
                  )}
                  {items.length > 0 && (
                    <span style={{ fontSize: 9, background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 10, padding: '1px 5px' }}>
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Deliverable chips */}
                {items.map(d => (
                  <DeliverableChip
                    key={d.id}
                    d={d}
                    isDragging={draggingId === d.id}
                    onDragStart={d => setDraggingId(d.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={d => setSelected(d)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail popup */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title" style={{ fontSize: 16 }}>{selected.campaign_name}</div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{selected.brand_name}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><div className="detail-item-label">Creator</div><div className="detail-item-value">{selected.creator_name}</div></div>
                <div><div className="detail-item-label">Platform</div><div className="detail-item-value">{selected.platform_name}{selected.type_name ? ` · ${selected.type_name}` : ''}</div></div>
                <div><div className="detail-item-label">Status</div><div className="detail-item-value"><Badge status={selected.draft_status} /></div></div>
                <div><div className="detail-item-label">Planned Date</div><div className="detail-item-value">{selected.contracted_post_date || '—'}</div></div>
                {selected.actual_post_date && <div><div className="detail-item-label">Posted</div><div className="detail-item-value" style={{ color: 'var(--green)' }}>✓ {selected.actual_post_date}</div></div>}
                {selected.deliverable_details && <div style={{ gridColumn: 'span 2' }}><div className="detail-item-label">Details</div><div className="detail-item-value">{selected.deliverable_details}</div></div>}
                {selected.post_url && <div style={{ gridColumn: 'span 2' }}><div className="detail-item-label">Post</div><div className="detail-item-value"><a href={selected.post_url} target="_blank" rel="noreferrer" className="link">View Post ↗</a></div></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
