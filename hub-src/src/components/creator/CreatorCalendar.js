import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../shared/Badge';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth, isToday } from 'date-fns';

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

export default function CreatorCalendar() {
  const { profile } = useAuth();
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data } = await supabase
      .from('campaign_deliverables')
      .select(`
        id, contracted_post_date, actual_post_date, draft_status, post_url, deliverable_details,
        platform:platforms(name),
        deliverable_type:deliverable_types(name),
        campaign:campaigns!inner(id, campaign_name, brand_name, creator_profile_id)
      `)
      .eq('campaign.creator_profile_id', profile.id);

    const flat = (data || []).map(d => ({
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
    }));

    setDeliverables(flat);
    setLoading(false);
  }

  function getDeliverablesForDate(date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return deliverables.filter(d => {
      const postDate = d.draft_status === 'Posted' ? d.actual_post_date : d.contracted_post_date;
      if (!postDate || postDate !== dateStr) return false;
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
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
  } else {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
  }

  const isWeek = view === 'week';
  const cellMinHeight = isWeek ? 160 : 90;

  if (loading) return <div className="page"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MY CALENDAR</div>
          <div className="page-subtitle">Your posting schedule</div>
        </div>
        <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-4">
            {['month', 'week'].map(v => (
              <button key={v} className={`filter-chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day, i) => {
            const items = getDeliverablesForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const todayFlag = isToday(day);

            return (
              <div
                key={i}
                style={{
                  minHeight: cellMinHeight,
                  padding: '6px 6px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                  background: !isCurrentMonth && view === 'month' ? 'rgba(0,0,0,0.15)' : 'transparent',
                }}
              >
                <div style={{
                  fontSize: isWeek ? 20 : 13,
                  fontWeight: todayFlag ? 700 : 400,
                  color: todayFlag ? 'var(--orange)' : !isCurrentMonth && view === 'month' ? 'var(--text-dim)' : 'var(--text)',
                  marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {todayFlag ? (
                    <span style={{ background: 'var(--orange)', color: 'var(--black)', borderRadius: '50%', width: isWeek ? 30 : 22, height: isWeek ? 30 : 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isWeek ? 16 : 12 }}>
                      {format(day, 'd')}
                    </span>
                  ) : (
                    <span>{isWeek ? format(day, 'EEE d') : format(day, 'd')}</span>
                  )}
                  {items.length > 0 && (
                    <span style={{ fontSize: 9, background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 10, padding: '1px 5px' }}>{items.length}</span>
                  )}
                </div>

                {items.map(d => {
                  const color = STATUS_COLORS[d.draft_status] || 'var(--text-muted)';
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelected(d)}
                      style={{
                        padding: '3px 7px', borderRadius: 4, fontSize: 11, marginBottom: 3, cursor: 'pointer',
                        background: `${color}18`, border: `1px solid ${color}55`, borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 10, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.campaign_name}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.platform_name} · {STATUS_LABELS[d.draft_status]}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title" style={{ fontSize: 16 }}>{selected.campaign_name}</div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{selected.brand_name}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
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
