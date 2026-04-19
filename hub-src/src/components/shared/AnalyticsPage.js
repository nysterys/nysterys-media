import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SparkLine, BarChart, HBar, DonutChart, StatTile, ChartCard, fmtNum, fmtSecs, fmtPct } from './Charts';
import { format, parseISO, addDays } from 'date-fns';
import { fmtDate, extractMonths } from '../../utils/format';
import { inPeriod, PeriodSelect } from '../../utils/period';

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  window.open(url, '_blank',
    `width=${w},height=${h},left=${Math.round(window.screenX + (window.outerWidth - w) / 2)},` +
    `top=${Math.round(window.screenY + (window.outerHeight - h) / 2)},` +
    `toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

// ── Regression helpers ────────────────────────────────────────────────────────

function olsReg(ys) {
  const n = ys.length;
  const xm = (n - 1) / 2;
  const ym = ys.reduce((s, v) => s + v, 0) / n;
  const num = ys.reduce((s, v, i) => s + (i - xm) * (v - ym), 0);
  const den = ys.reduce((s, _, i) => s + (i - xm) ** 2, 0);
  const slope = den > 0 ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
}

function wlsReg(ys, lambda = 2.5) {
  const n = ys.length;
  const ws = ys.map((_, i) => Math.exp(lambda * i / Math.max(n - 1, 1)));
  const wsum = ws.reduce((s, w) => s + w, 0);
  const xm = ws.reduce((s, w, i) => s + w * i, 0) / wsum;
  const ym = ws.reduce((s, w, i) => s + w * ys[i], 0) / wsum;
  const num = ws.reduce((s, w, i) => s + w * (i - xm) * (ys[i] - ym), 0);
  const den = ws.reduce((s, w, i) => s + w * (i - xm) ** 2, 0);
  const slope = den > 0 ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
}

function movingAvg(ys, w = 30) {
  return ys.map((_, i) => {
    const slice = ys.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

// ── Milestone targets — based on current follower tier ───────────────────────

function getMilestones(current) {
  const tiers = current >= 1_000_000
    ? [1_500_000, 1_750_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000]
    : [250_000, 300_000, 350_000, 400_000, 500_000, 750_000, 1_000_000];
  return tiers.filter(m => m > current);
}

function fmtMilestone(n) {
  if (n >= 1_000_000) {
    const v = Math.round(n / 10_000) / 100;
    return (v % 1 === 0 ? v.toFixed(0) : v % 0.1 === 0 ? v.toFixed(1) : v.toFixed(2)) + 'M';
  }
  return Math.round(n / 1_000) + 'K';
}

// ── Follower Trend + Forecast Chart ──────────────────────────────────────────

function FollowerTrendChart({ rows }) {
  const clean = [...rows]
    .filter(d => Number(d.followers_count) > 100)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (clean.length < 14) {
    return <div className="text-muted text-sm">Not enough history for trend analysis (need 14+ days)</div>;
  }

  const ys  = clean.map(d => Number(d.followers_count));
  const n   = ys.length;
  const ols = olsReg(ys);
  const wls = wlsReg(ys, 2.5);
  const ma  = movingAvg(ys, 30);

  // CI from WLS residuals (robust — unaffected by outlier net_followers values)
  const fittedWLS = ys.map((_, i) => wls.intercept + wls.slope * i);
  const residuals = ys.map((v, i) => v - fittedWLS[i]);
  const stdRes    = Math.sqrt(residuals.reduce((s, v) => s + v ** 2, 0) / Math.max(n - 2, 1));

  const FCAST = 90;
  const fYs   = Array.from({ length: FCAST }, (_, k) =>
    Math.max(0, wls.intercept + wls.slope * (n + k)));

  // Scale y-axis on actual data + forecast only — CI is clipped to this range
  const W = 1000, H = 160;
  const yMin    = Math.max(0, Math.min(...ys) * 0.97);
  const yMaxRaw = Math.max(...ys, ...fYs) * 1.08;
  const yMax    = yMaxRaw;

  // Build CI after yMax is known so we can clamp it
  const ciHi = fYs.map((v, k) => Math.min(yMax, v + 1.645 * stdRes * Math.sqrt(k + 1)));
  const ciLo = fYs.map((v, k) => Math.max(yMin, v - 1.645 * stdRes * Math.sqrt(k + 1)));

  const olsLine = Array.from({ length: n + FCAST }, (_, i) =>
    ols.intercept + ols.slope * i);
  const xTotal = n + FCAST;

  const sx = i => (i / (xTotal - 1)) * W;
  const sy = v => H - ((v - yMin) / (yMax - yMin || 1)) * H;

  function pts(xArr, yArr) {
    return xArr.map((x, i) => `${i === 0 ? 'M' : 'L'} ${sx(x).toFixed(1)},${sy(yArr[i]).toFixed(1)}`).join(' ');
  }

  const bandPts = [
    ...Array.from({ length: FCAST }, (_, k) => `${sx(n + k).toFixed(1)},${sy(ciHi[k]).toFixed(1)}`),
    ...Array.from({ length: FCAST }, (_, k) => `${sx(n + FCAST - 1 - k).toFixed(1)},${sy(ciLo[FCAST - 1 - k]).toFixed(1)}`),
  ].join(' ');

  const firstDate  = parseISO(clean[0].date);
  const lastDate   = parseISO(clean[n - 1].date);

  // X-axis date labels
  const labelCount = 8;
  const dateLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round(i * (xTotal - 1) / (labelCount - 1));
    return { pct: (idx / (xTotal - 1)) * 100, label: format(addDays(firstDate, idx), 'MMM d') };
  });

  // Y-axis labels (right-aligned overlay)
  const yLevels = 4;
  const yAxisLabels = Array.from({ length: yLevels + 1 }, (_, i) => ({
    pct: (i / yLevels) * 100,
    label: fmtNum(Math.round(yMin + (yMax - yMin) * (1 - i / yLevels))),
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, fontSize: 11, marginBottom: 6, flexWrap: 'wrap', color: 'var(--text-muted)' }}>
        <span><span style={{ color: 'var(--orange)', fontWeight: 700 }}>—</span> Actual</span>
        <span><span style={{ color: 'var(--blue)', opacity: 0.7, fontWeight: 700 }}>—</span> Linear (OLS)</span>
        <span><span style={{ color: 'var(--green)', fontWeight: 700 }}>—</span> 30-day MA</span>
        <span><span style={{ color: 'var(--purple)', fontWeight: 700 }}>—</span> WLS forecast</span>
        <span style={{ color: 'var(--text-dim)' }}>Shaded band = 90% CI</span>
        <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {n} data points · {format(firstDate, 'MMM d, yyyy')} – {format(lastDate, 'MMM d, yyyy')} · WLS slope: +{Math.round(wls.slope).toLocaleString()}/day · OLS slope: +{Math.round(ols.slope).toLocaleString()}/day
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        {/* Y-axis labels */}
        <div style={{ position: 'absolute', top: 0, right: 0, height: 180, pointerEvents: 'none' }}>
          {yAxisLabels.map((l, i) => (
            <div key={i} style={{
              position: 'absolute', top: `${l.pct}%`, right: 4,
              fontSize: 9, color: 'var(--text-dim)', transform: 'translateY(-50%)',
              whiteSpace: 'nowrap',
            }}>{l.label}</div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, display: 'block' }} preserveAspectRatio="none">
          {/* Forecast region tint */}
          <rect x={sx(n - 0.5)} y={0} width={W - sx(n - 0.5)} height={H} fill="rgba(255,255,255,0.015)" />
          {/* Confidence band */}
          <polygon points={bandPts} fill="var(--purple)" fillOpacity="0.12" />
          {/* OLS trendline (full range) */}
          <path d={pts(olsLine.map((_, i) => i), olsLine)} fill="none" stroke="var(--blue)" strokeWidth="1.5" opacity="0.55" vectorEffect="non-scaling-stroke" />
          {/* 30-day MA */}
          <path d={pts(ma.map((_, i) => i), ma)} fill="none" stroke="var(--green)" strokeWidth="2" opacity="0.8" vectorEffect="non-scaling-stroke" />
          {/* WLS forecast */}
          <path d={pts(fYs.map((_, k) => n + k), fYs)} fill="none" stroke="var(--purple)" strokeWidth="2.5" opacity="0.9" vectorEffect="non-scaling-stroke" />
          {/* Actual follower count */}
          <path d={pts(ys.map((_, i) => i), ys)} fill="none" stroke="var(--orange)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {/* Today separator */}
          <line x1={sx(n - 1).toFixed(1)} y1={0} x2={sx(n - 1).toFixed(1)} y2={H}
            stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* X-axis date labels */}
        <div style={{ position: 'relative', height: 16 }}>
          {dateLabels.map((l, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${l.pct}%`,
              transform: `translateX(${l.pct > 85 ? '-100%' : l.pct < 5 ? '0' : '-50%'})`,
              fontSize: 9, color: 'var(--text-dim)', whiteSpace: 'nowrap',
            }}>{l.label}</div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textAlign: 'right' }}>
          ▏ Today &nbsp;&nbsp; {FCAST}d forecast →
        </div>
      </div>
    </div>
  );
}

// ── Milestone prediction table ────────────────────────────────────────────────

function MilestoneTable({ rows }) {
  const clean = [...rows]
    .filter(d => Number(d.followers_count) > 100)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (clean.length < 14) return null;

  const ys        = clean.map(d => Number(d.followers_count));
  const n         = ys.length;
  const current   = ys[n - 1];
  const ols       = olsReg(ys);
  const wls       = wlsReg(ys, 2.5);
  const milestones = getMilestones(current);
  if (milestones.length === 0) return null;

  const today     = parseISO(clean[n - 1].date);
  const firstDay  = parseISO(clean[0].date);

  // Days until model reaches target, starting from today (index n-1)
  function daysTo(model, target) {
    if (model.slope <= 0) return null;
    const x = (target - model.intercept) / model.slope;
    const days = Math.round(x - (n - 1));
    return days > 0 ? days : null;
  }

  const daily30 = n >= 31
    ? (ys[n - 1] - ys[n - 31]) / 30
    : (ys[n - 1] - ys[0]) / Math.max(n - 1, 1);

  return (
    <ChartCard title="FOLLOWER MILESTONE PREDICTIONS">
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Current: <strong style={{ color: 'var(--orange)' }}>{fmtNum(current)}</strong>
        {' · '}30-day avg growth: <strong style={{ color: 'var(--green)' }}>+{Math.round(daily30).toLocaleString()}/day</strong>
        {' · '}WLS slope: <strong style={{ color: 'var(--purple)' }}>+{Math.round(wls.slope).toLocaleString()}/day</strong>
        {' · '}<span style={{ color: 'var(--text-dim)' }}>{n} data points · {format(firstDay, 'MMM d, yyyy')} – {format(today, 'MMM d, yyyy')}</span>
      </div>
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th style={{ fontSize: 11 }}>Target</th>
              <th style={{ fontSize: 11 }}>Gap</th>
              <th style={{ fontSize: 11 }}>Linear (OLS)</th>
              <th style={{ fontSize: 11 }}>Weighted (WLS)</th>
              <th style={{ fontSize: 11 }}>Days away</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map(m => {
              const olsDays = daysTo(ols, m);
              const wlsDays = daysTo(wls, m);
              const olsDate = olsDays != null ? format(addDays(today, olsDays), 'MMM d, yyyy') : '—';
              const wlsDate = wlsDays != null ? format(addDays(today, wlsDays), 'MMM d, yyyy') : '—';
              return (
                <tr key={m}>
                  <td style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{fmtMilestone(m)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>+{fmtMilestone(m - current)}</td>
                  <td style={{ fontSize: 12 }}>{olsDate}</td>
                  <td style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600 }}>{wlsDate}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {wlsDays != null ? `${wlsDays.toLocaleString()} days` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.6 }}>
        OLS = ordinary least squares over all history. WLS = exponentially weighted (recent days weighted ~{Math.round(Math.exp(2.5))}× more than oldest). Both assume current growth trends continue.
      </div>
    </ChartCard>
  );
}

// ── Top videos table with count selector ─────────────────────────────────────

function TopVideosTable({ videos }) {
  const [limit, setLimit] = useState(10);
  if (!videos || videos.length === 0) return null;
  const shown = videos.slice(0, limit);

  return (
    <ChartCard
      title="TOP VIDEOS BY VIEWS"
      action={
        <select className="form-select" style={{ width: 'auto', padding: '3px 8px', fontSize: 11 }}
          value={limit} onChange={e => setLimit(Number(e.target.value))}>
          {[10, 20, 50, 100].filter(n => n <= videos.length || n === 10).map(n => (
            <option key={n} value={n}>{n} videos</option>
          ))}
        </select>
      }
    >
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 56 }}></th>
              <th>Video</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>ER</th>
              <th>Avg Watch</th>
              <th>Completion</th>
              <th>Reach</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(v => {
              const er = v.total_play > 0
                ? (((Number(v.total_like) || 0) + (Number(v.total_comment) || 0) + (Number(v.total_share) || 0)) / Number(v.total_play) * 100)
                : null;
              const erStr = er != null ? er.toFixed(2) : null;
              const erColor = er > 5 ? 'var(--green)' : er > 2 ? 'var(--orange)' : 'var(--text-muted)';
              return (
                <tr key={v.video_id}>
                  <td style={{ padding: '6px 8px', width: 56 }}>
                    {v.cover_image_url ? (
                      <div onClick={() => openPopup(v.share_url || v.embed_url)}
                        style={{ width: 40, height: 54, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        <img src={v.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: 40, height: 54, borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎬</div>
                    )}
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.video_title || v.video_id}
                    </div>
                    {v.create_time && <div className="text-muted text-xs">{fmtDate(v.create_time)}</div>}
                  </td>
                  <td style={{ color: 'var(--orange)', fontWeight: 600 }}>{fmtNum(v.total_play)}</td>
                  <td>{fmtNum(v.total_like)}</td>
                  <td>{fmtNum(v.total_comment)}</td>
                  <td>{fmtNum(v.total_share)}</td>
                  <td>{erStr != null ? <span style={{ color: erColor, fontWeight: 600 }}>{erStr}%</span> : '—'}</td>
                  <td>{fmtSecs(v.average_time_watched)}</td>
                  <td>
                    {v.full_video_watched_rate != null ? (
                      <div className="flex items-center gap-8">
                        <div style={{ width: 40, height: 4, background: 'var(--surface3)', borderRadius: 2 }}>
                          <div style={{ width: `${Math.min(v.full_video_watched_rate * 100, 100)}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{fmtPct(v.full_video_watched_rate)}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>{fmtNum(v.reach)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ── Campaign performance table ────────────────────────────────────────────────

function CampaignPerformanceTable({ campaignStats }) {
  if (!campaignStats || campaignStats.length === 0) return null;

  const grouped = {};
  for (const d of campaignStats) {
    if (!grouped[d.campaign_id]) grouped[d.campaign_id] = { meta: d.campaign, rows: [] };
    grouped[d.campaign_id].rows.push(d);
  }

  function totals(rows) {
    const n   = rows.length;
    const sum = key => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const avg = key => n ? sum(key) / n : null;
    const tv  = sum('views'), tl = sum('likes'), tc = sum('comments'), ts = sum('shares');
    return {
      views: tv, likes: tl, comments: tc, shares: ts, count: n,
      engagement_rate: tv > 0 ? ((tl + tc + ts) / tv * 100).toFixed(2) : null,
      average_time_watched: avg('average_time_watched'),
      full_video_watched_rate: avg('full_video_watched_rate'),
      reach: sum('reach'),
    };
  }

  const cellSm  = { fontSize: 11, padding: '4px 8px' };
  const cellTot = { fontSize: 12, padding: '8px 8px', background: 'rgba(255,92,0,0.06)', borderTop: '1px solid var(--border)', borderBottom: '2px solid var(--border)' };

  return (
    <ChartCard title="SPONSORED CAMPAIGN PERFORMANCE">
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              {['Campaign / Post', 'Link', 'Views', 'Likes', 'Comments', 'Shares', 'ER', 'Avg Watch', 'Completion', 'Reach'].map(h => (
                <th key={h} style={{ fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.values(grouped).map(({ meta, rows }) => {
              const t = totals(rows);
              const erColor = t.engagement_rate > 5 ? 'var(--green)' : t.engagement_rate > 2 ? 'var(--orange)' : 'var(--text-muted)';
              return (
                <React.Fragment key={rows[0]?.campaign_id}>
                  {rows.map((d, i) => (
                    <tr key={d.id} style={{ opacity: 0.75 }}>
                      <td style={cellSm}>
                        {i === 0 && <div style={{ fontWeight: 500, fontSize: 11, marginBottom: 1 }}>{meta?.campaign_name || '—'}</div>}
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          {d.video_title ? (d.video_title.length > 45 ? d.video_title.slice(0, 45) + '…' : d.video_title) : `Post ${i + 1}`}
                        </div>
                      </td>
                      <td style={cellSm}>
                        {d.post_url ? <span className="link" style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => openPopup(d.post_url)}>View ↗</span> : '—'}
                      </td>
                      <td style={{ ...cellSm, color: 'var(--orange)', fontWeight: 600 }}>{fmtNum(d.views)}</td>
                      <td style={cellSm}>{fmtNum(d.likes)}</td>
                      <td style={cellSm}>{fmtNum(d.comments)}</td>
                      <td style={cellSm}>{fmtNum(d.shares)}</td>
                      <td style={cellSm}>
                        {d.engagement_rate != null
                          ? <span style={{ color: d.engagement_rate > 5 ? 'var(--green)' : d.engagement_rate > 2 ? 'var(--orange)' : 'var(--text-muted)' }}>{d.engagement_rate}%</span>
                          : '—'}
                      </td>
                      <td style={cellSm}>{fmtSecs(d.average_time_watched)}</td>
                      <td style={cellSm}>{fmtPct(d.full_video_watched_rate)}</td>
                      <td style={cellSm}>{fmtNum(d.reach)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...cellTot, fontWeight: 700, fontSize: 12 }}>
                      <span style={{ color: 'var(--accent)' }}>∑</span> {meta?.campaign_name || '—'}
                      <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>{t.count} post{t.count !== 1 ? 's' : ''}</span>
                    </td>
                    <td style={cellTot}></td>
                    <td style={{ ...cellTot, color: 'var(--orange)', fontWeight: 700 }}>{fmtNum(t.views)}</td>
                    <td style={{ ...cellTot, fontWeight: 600 }}>{fmtNum(t.likes)}</td>
                    <td style={{ ...cellTot, fontWeight: 600 }}>{fmtNum(t.comments)}</td>
                    <td style={{ ...cellTot, fontWeight: 600 }}>{fmtNum(t.shares)}</td>
                    <td style={cellTot}>{t.engagement_rate != null ? <span style={{ color: erColor, fontWeight: 700 }}>{t.engagement_rate}%</span> : '—'}</td>
                    <td style={{ ...cellTot, color: 'var(--text-muted)' }}>{fmtSecs(t.average_time_watched)} avg</td>
                    <td style={{ ...cellTot, color: 'var(--text-muted)' }}>{t.full_video_watched_rate != null ? fmtPct(t.full_video_watched_rate) : '—'} avg</td>
                    <td style={{ ...cellTot, fontWeight: 600 }}>{fmtNum(t.reach)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ── No-data state ─────────────────────────────────────────────────────────────

function NoDataState({ username }) {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="empty-state" style={{ padding: '30px 20px' }}>
        <div className="empty-state-icon">◈</div>
        <div className="empty-state-title">No TikTok data yet for @{username}</div>
        <div className="empty-state-text" style={{ maxWidth: 380, margin: '8px auto 0' }}>
          Coupler.io hasn't synced data yet, or the sync hasn't been configured for this account.
        </div>
      </div>
    </div>
  );
}

// ── Main shared component ─────────────────────────────────────────────────────

export default function AnalyticsPage({ isAdmin, creatorProfileId }) {
  const [accounts, setAccounts]               = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [period, setPeriod]                   = useState('all');
  const [loading, setLoading]                 = useState(true);
  const [data, setData]                       = useState(null);

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selectedAccount) fetchData(); }, [selectedAccount]); // eslint-disable-line

  async function fetchAccounts() {
    if (isAdmin) {
      const { data: accs } = await supabase
        .from('tiktok_accounts')
        .select('*, profile:profiles(full_name, creator_name)')
        .eq('is_active', true);
      setAccounts(accs || []);
      if (accs?.length > 0) setSelectedAccount(accs[0]);
    } else {
      const { data: acc } = await supabase
        .from('tiktok_accounts')
        .select('*')
        .eq('profile_id', creatorProfileId)
        .eq('is_active', true)
        .single();
      setAccounts(acc ? [acc] : []);
      setSelectedAccount(acc || null);
    }
    if (!isAdmin) setLoading(false);
  }

  async function fetchData() {
    if (!selectedAccount) return;
    setLoading(true);
    const username = selectedAccount.tiktok_username;

    const [profileRes, genderRes, countryRes, hourlyRes, videoRes, campaignRes] = await Promise.all([
      // All history — trend chart, milestones, and KPI tiles (period-filtered client-side)
      supabase.from('tiktok_profile_insights_view')
        .select('*')
        .eq('tiktok_username', username)
        .order('date', { ascending: true })
        .limit(5000),
      supabase.from('tiktok_audience_gender_view').select('*').eq('tiktok_username', username),
      supabase.from('tiktok_audience_country_view').select('*').eq('tiktok_username', username),
      supabase.from('tiktok_audience_hourly_view').select('*').eq('tiktok_username', username),
      supabase.from('tiktok_video_insights_view')
        .select('*')
        .eq('tiktok_username', username)
        .order('total_play', { ascending: false })
        .limit(500),
      supabase.from('campaign_deliverables_with_stats')
        .select('*, campaign:campaigns!inner(campaign_name, brand_name, creator_profile_id, agency:agencies(name))')
        .eq('campaign.creator_profile_id', selectedAccount.profile_id)
        .not('post_url', 'is', null)
        .not('views', 'is', null)
        .order('views', { ascending: false })
        .limit(20),
    ]);

    setData({
      profileAll:    profileRes.data     || [],
      gender:        genderRes.data      || [],
      country:       countryRes.data     || [],
      hourly:        hourlyRes.data      || [],
      videos:        videoRes.data       || [],
      campaignStats: campaignRes.data    || [],
    });
    setLoading(false);
  }

  // Setup-required state (admin: no accounts at all)
  if (!loading && isAdmin && accounts.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><div><div className="page-title">ANALYTICS</div></div></div>
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-title">SETUP REQUIRED</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            No TikTok accounts configured. Go to <strong style={{ color: 'var(--text)' }}>Setup → TikTok Accounts</strong> to link accounts.
          </p>
        </div>
      </div>
    );
  }

  // Creator: no account linked
  if (!loading && !isAdmin && !selectedAccount) {
    return (
      <div className="page">
        <div className="page-header"><div><div className="page-title">MY ANALYTICS</div></div></div>
        <div className="card" style={{ maxWidth: 500 }}>
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">Analytics not set up yet</div>
            <div className="empty-state-text">Your manager needs to link your TikTok account.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const profileAll = data?.profileAll || [];

  // All-time clean: for trend chart and current follower count
  const profileAllClean = profileAll
    .filter(d => Number(d.followers_count) > 100);

  // Period-filtered: for KPI tiles and engagement sparklines
  const profileFiltered = profileAll
    .filter(d => inPeriod(d.date, period) && Number(d.followers_count) > 100);

  const latestProfile   = profileAllClean[profileAllClean.length - 1];
  const earliestFiltered = profileFiltered[0];
  const latestFiltered   = profileFiltered[profileFiltered.length - 1];

  const followerGrowth = latestFiltered && earliestFiltered
    ? Number(latestFiltered.followers_count) - Number(earliestFiltered.followers_count)
    : null;

  // Use period-filtered alias for engagement charts (matches old `profileClean` usage)
  const profileClean = profileFiltered;

  const totalViews    = profileFiltered.reduce((s, d) => s + (Number(d.video_views) || 0), 0);
  const totalLikes    = profileFiltered.reduce((s, d) => s + (Number(d.likes) || 0), 0);
  const totalComments = profileFiltered.reduce((s, d) => s + (Number(d.comments) || 0), 0);
  const totalShares   = profileFiltered.reduce((s, d) => s + (Number(d.shares) || 0), 0);

  // Months for PeriodSelect, derived from all history
  const months = extractMonths(profileAll, 'date');

  // Videos filtered by period
  const videosFiltered = (data?.videos || []).filter(v =>
    inPeriod(v.create_time ? v.create_time.slice(0, 10) : null, period)
  );


  // Gender: normalise 0-1 vs 0-100
  const genderMap = {};
  data?.gender?.forEach(g => {
    if (!genderMap[g.gender]) genderMap[g.gender] = [];
    genderMap[g.gender].push(Number(g.percentage) || 0);
  });
  const genderIsPercent = Object.values(genderMap).flat().some(v => v > 1);
  const genderAvg = Object.entries(genderMap).map(([k, vals]) => {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { label: k, value: Math.round(genderIsPercent ? avg : avg * 100),
      color: k === 'Male' ? 'var(--blue)' : k === 'Female' ? 'var(--purple)' : 'var(--text-dim)' };
  });

  // Country: normalise, top 5
  const allCountryVals   = (data?.country || []).map(c => Number(c.percentage) || 0);
  const countryIsPercent = allCountryVals.some(v => v > 1);
  const topCountries     = [...(data?.country || [])]
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .slice(0, 5)
    .map(c => {
      const raw = Number(c.percentage) || 0;
      return { ...c, percentage: countryIsPercent ? Math.round(raw * 10) / 10 : Math.round(raw * 1000) / 10 };
    });
  const maxCountryPct = Math.max(...topCountries.map(c => c.percentage || 0), 1);

  // Hourly: normalise to 0-100
  const hourlyMap = {};
  data?.hourly?.forEach(h => {
    const hr = parseInt(h.hour, 10);
    if (!hourlyMap[hr]) hourlyMap[hr] = [];
    hourlyMap[hr].push(Number(h.activity_score) || 0);
  });
  const hourlyRaw = Array.from({ length: 24 }, (_, i) => ({
    label: i === 0 ? '12a' : i === 12 ? '12p' : i < 12 ? `${i}a` : `${i - 12}p`,
    value: hourlyMap[i] ? hourlyMap[i].reduce((s, v) => s + v, 0) / hourlyMap[i].length : 0,
  }));
  const hourlyMax = Math.max(...hourlyRaw.map(h => h.value), 1);
  const hourlyAvg = hourlyRaw.map(h => ({ ...h, value: (h.value / hourlyMax) * 100 }));
  const peakHour  = hourlyAvg.reduce((max, h) => h.value > max.value ? h : max, { value: 0, label: '—' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{isAdmin ? 'ANALYTICS' : 'MY ANALYTICS'}</div>
          <div className="page-subtitle">
            {isAdmin
              ? 'TikTok performance data via Coupler.io'
              : `@${selectedAccount?.tiktok_username}`}
          </div>
        </div>
        <div className="flex gap-8 items-center">
          {isAdmin && accounts.length > 1 && (
            <div className="flex gap-8">
              {accounts.map(a => (
                <button
                  key={a.id}
                  className={`filter-chip ${selectedAccount?.id === a.id ? 'active' : ''}`}
                  onClick={() => setSelectedAccount(a)}
                >
                  {a.profile?.creator_name || a.tiktok_username}
                </button>
              ))}
            </div>
          )}
          <PeriodSelect period={period} onChange={setPeriod} months={months} />
        </div>
      </div>

      {loading ? (
        <div className="text-muted">Loading analytics...</div>
      ) : profileAllClean.length === 0 ? (
        <NoDataState username={selectedAccount?.tiktok_username} />
      ) : (
        <>
          {/* KPI tiles */}
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <StatTile label="Followers" value={fmtNum(latestProfile?.followers_count)} trend={followerGrowth} color="stat-accent" />
            <StatTile label="Views" value={fmtNum(totalViews)} color="stat-green" />
            <StatTile label="Likes" value={fmtNum(totalLikes)} />
            <StatTile label="Comments" value={fmtNum(totalComments)} />
            <StatTile label="Shares" value={fmtNum(totalShares)} />
          </div>

          {/* Follower count trend + forecast (all history) */}
          <ChartCard title="FOLLOWER COUNT TREND & FORECAST (ALL HISTORY)">
            <FollowerTrendChart rows={profileAllClean} />
          </ChartCard>

          {/* Milestone predictions */}
          <MilestoneTable rows={profileAllClean} />

          {/* Daily new followers (period-filtered) */}
          <ChartCard title="DAILY NEW FOLLOWERS">
            {profileClean.length === 0 ? (
              <div className="text-muted text-sm">No data for selected period</div>
            ) : (
              <>
                <SparkLine
                  data={profileClean.map(d => Number(d.net_followers) || 0)}
                  xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
                  color="var(--orange)"
                  height={80}
                  fill={true}
                  valueFormatter={v => fmtNum(v)}
                />
                <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  <span>{earliestFiltered && format(parseISO(earliestFiltered.date), 'MMM d')}</span>
                  <span style={{ marginLeft: 'auto' }}>{latestFiltered && format(parseISO(latestFiltered.date), 'MMM d')}</span>
                </div>
              </>
            )}
          </ChartCard>

          {/* Views + Likes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="DAILY VIDEO VIEWS">
              {profileClean.length === 0 ? <div className="text-muted text-sm">No data for selected period</div> : (
                <>
                  <SparkLine
                    data={profileClean.map(d => Number(d.video_views) || 0)}
                    xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
                    color="var(--blue)"
                    height={70}
                    valueFormatter={v => fmtNum(v)}
                  />
                  <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <span>{earliestFiltered && format(parseISO(earliestFiltered.date), 'MMM d')}</span>
                    <span style={{ marginLeft: 'auto' }}>{latestFiltered && format(parseISO(latestFiltered.date), 'MMM d')}</span>
                  </div>
                </>
              )}
            </ChartCard>
            <ChartCard title="DAILY LIKES">
              {profileClean.length === 0 ? <div className="text-muted text-sm">No data for selected period</div> : (
                <>
                  <SparkLine
                    data={profileClean.map(d => Number(d.likes) || 0)}
                    xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
                    color="var(--purple)"
                    height={70}
                    valueFormatter={v => fmtNum(v)}
                  />
                  <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <span>{earliestFiltered && format(parseISO(earliestFiltered.date), 'MMM d')}</span>
                    <span style={{ marginLeft: 'auto' }}>{latestFiltered && format(parseISO(latestFiltered.date), 'MMM d')}</span>
                  </div>
                </>
              )}
            </ChartCard>
          </div>

          {/* Audience */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="AUDIENCE GENDER">
              {genderAvg.length === 0 ? (
                <div>
                  <div className="text-muted text-sm" style={{ marginBottom: 8 }}>No data</div>
                  {profileAll.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--orange)', lineHeight: 1.5 }}>
                      ⚠ Re-run <strong>13-reapply-tiktok-rls.sql</strong> to restore access after Coupler sync.
                    </div>
                  )}
                </div>
              ) : <DonutChart segments={genderAvg} size={160} />}
            </ChartCard>
            <ChartCard title="TOP COUNTRIES">
              {topCountries.length === 0 ? (
                <div>
                  <div className="text-muted text-sm" style={{ marginBottom: 8 }}>No data</div>
                  {profileAll.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--orange)', lineHeight: 1.5 }}>
                      ⚠ Re-run <strong>13-reapply-tiktok-rls.sql</strong> after Coupler sync.
                    </div>
                  )}
                </div>
              ) : topCountries.map(c => (
                <HBar key={c.country} label={c.country} value={c.percentage || 0} max={maxCountryPct} color="var(--blue)" suffix="%" />
              ))}
            </ChartCard>
            <ChartCard title={`PEAK POSTING HOURS · Best: ${peakHour.label}`}>
              <BarChart data={hourlyAvg} color="var(--orange)" height={180} valueFormatter={v => v.toFixed(2)} />
            </ChartCard>
          </div>

          <CampaignPerformanceTable campaignStats={data?.campaignStats} />
          <TopVideosTable videos={videosFiltered.length > 0 ? videosFiltered : (data?.videos || [])} />
        </>
      )}
    </div>
  );
}
