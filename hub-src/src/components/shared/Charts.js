import React, { useState, useCallback } from 'react';

// ============================================================
// Minimal, sharp chart components — no dependencies
// ============================================================

// Line/Area chart
export function SparkLine({ data, color = 'var(--orange)', height = 60, fill = true, label, valueFormatter = v => v.toLocaleString(), xLabels = null }) {
  if (!data || data.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>No data</div>;

  const [tooltip, setTooltip] = useState(null);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 1000;
  const h = 100;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return { x, y, v };
  });
  const pathD = `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaD = `M ${pts[0].x},${pts[0].y} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${w},${h} L 0,${h} Z`;

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(Math.round(pct * (data.length - 1)), data.length - 1);
    const pt = pts[idx];
    const xLabel = xLabels ? xLabels[idx] : null;
    setTooltip({ idx, x: pct * 100, y: (pt.y / h) * 100, value: pt.v, xLabel });
  }, [data, pts, xLabels]);

  return (
    <div style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>}
      <div style={{ position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
          {fill && <path d={areaD} fill={color} fillOpacity="0.12" />}
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {tooltip && (
            <circle cx={pts[tooltip.idx].x} cy={pts[tooltip.idx].y} r="5" fill={color} vectorEffect="non-scaling-stroke" />
          )}
          {!tooltip && (
            <circle cx={w} cy={pts[pts.length-1].y} r="4" fill={color} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {tooltip && (
          <div style={{
            position: 'absolute',
            top: `${tooltip.y}%`,
            left: `${tooltip.x}%`,
            transform: `translate(${tooltip.x > 80 ? '-110%' : '8px'}, -50%)`,
            background: 'var(--surface3)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--white)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
            lineHeight: 1.5,
          }}>
            {tooltip.xLabel && <div style={{ color: 'var(--muted)', fontSize: 10 }}>{tooltip.xLabel}</div>}
            <div>{valueFormatter(tooltip.value)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Bar chart
export function BarChart({ data, color = 'var(--orange)', height = 80, valueFormatter = v => v }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>No data</div>;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const barH = height - 16;

  return (
    <div style={{ position: 'relative', height }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barH, position: 'absolute', top: 0, left: 0, right: 0 }}>
        {data.map((d, i) => {
          const pct = ((d.value - min) / range) * 70 + 30;
          const isHovered = hoveredIdx === i;
          return (
            <div key={i}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div style={{
                width: '100%',
                height: `${pct}%`,
                background: color,
                borderRadius: '2px 2px 0 0',
                opacity: isHovered ? 1 : 0.9,
                transition: 'height 0.3s ease',
              }} />
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: `${pct}%`,
                  left: '50%',
                  transform: `translate(${i > data.length * 0.75 ? '-100%' : '-50%'}, -4px)`,
                  background: 'var(--surface3)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  color: 'var(--white)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}>
                  {d.label}: {valueFormatter(d.value)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', position: 'absolute', bottom: 0, left: 0, right: 0, height: 16 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 8, color: 'var(--text-dim)', textAlign: 'center', lineHeight: '16px', overflow: 'hidden' }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bar — for country/gender breakdowns
export function HBar({ label, value, max, color = 'var(--orange)', suffix = '%' }) {
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
  const r = size * 0.32;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const labelR = r + size * 0.18; // callout label radius

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const midAngle = -Math.PI / 2 + (offset / circumference + pct / 2) * 2 * Math.PI;
    const arc = {
      ...seg, pct, offset,
      dashArray: `${pct * circumference} ${circumference}`,
      labelX: cx + labelR * Math.cos(midAngle),
      labelY: cy + labelR * Math.sin(midAngle),
      midAngle,
    };
    offset += pct * circumference;
    return arc;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth={size * 0.08} />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={size * 0.08}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={-arc.offset}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {arcs.filter(arc => arc.pct > 0.03).map((arc, i) => {
        const lx = cx + labelR * Math.cos(arc.midAngle);
        const ly = cy + labelR * Math.sin(arc.midAngle);
        const anchor = lx < cx ? 'end' : 'start';
        return (
          <g key={i}>
            <text x={lx} y={ly - 6} textAnchor={anchor} fill={arc.color} fontSize={size * 0.09} fontWeight="600">
              {arc.label}
            </text>
            <text x={lx} y={ly + size * 0.1} textAnchor={anchor} fill="var(--white)" fontSize={size * 0.085} opacity="0.7">
              {Math.round(arc.pct * 100)}%
            </text>
          </g>
        );
      })}
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
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
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
