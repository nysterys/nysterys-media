import React from 'react';

// ============================================================
// Minimal, sharp chart components — no dependencies
// ============================================================

// Line/Area chart
export function SparkLine({ data, color = 'var(--accent)', height = 60, fill = true, label }) {
  if (!data || data.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>No data</div>;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `M ${pts[0]} L ${pts.join(' L ')} L ${(data.length - 1) / (data.length - 1) * w},${h} L 0,${h} Z`;

  return (
    <div>
      {label && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, overflow: 'visible' }} preserveAspectRatio="none">
        {fill && (
          <path d={areaD} fill={color} fillOpacity="0.08" />
        )}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Last point dot */}
        <circle
          cx={(data.length - 1) / (data.length - 1) * w}
          cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
          r="2.5"
          fill={color}
        />
      </svg>
    </div>
  );
}

// Bar chart
export function BarChart({ data, color = 'var(--accent)', height = 80, valueFormatter = v => v }) {
  // data: [{label, value}]
  if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>No data</div>;
  const max = Math.max(...data.map(d => d.value)) || 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, paddingBottom: 18, position: 'relative' }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 }} title={`${d.label}: ${valueFormatter(d.value)}`}>
            <div style={{
              width: '100%',
              height: `${Math.max(pct, 2)}%`,
              background: color,
              borderRadius: '2px 2px 0 0',
              opacity: 0.85,
              transition: 'height 0.3s ease',
            }} />
            <div style={{ fontSize: 9, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal bar — for country/gender breakdowns
export function HBar({ label, value, max, color = 'var(--accent)', suffix = '%' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// Donut chart (gender split)
export function DonutChart({ segments, size = 80 }) {
  // segments: [{label, value, color}]
  if (!segments || segments.length === 0) return null;
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = 28;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const arc = { ...seg, pct, offset, dashArray: `${pct * circumference} ${circumference}` };
    offset += pct * circumference;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth="8" />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="8"
          strokeDasharray={arc.dashArray}
          strokeDashoffset={-arc.offset}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
    </svg>
  );
}

// Stat tile
export function StatTile({ label, value, sub, color, trend }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${color || ''}`} style={{ fontSize: 28 }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize: 11, marginTop: 4, color: trend >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Section wrapper
export function ChartCard({ title, children, action }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Utility formatters
export function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtSecs(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function fmtPct(v) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
