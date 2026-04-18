import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { SparkLine, BarChart, HBar, DonutChart, StatTile, ChartCard, fmtNum, fmtSecs, fmtPct } from '../shared/Charts';
import { fmtDate } from '../../utils/format';
import { format, parseISO, subDays } from 'date-fns';

function openPopup(url) {
  if (!url) return;
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`);
}

export default function CreatorAnalytics() {
  const { profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [dateRange, setDateRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => { fetchAccount(); }, []);
  useEffect(() => { if (account) fetchData(); }, [account, dateRange]);

  async function fetchAccount() {
    const { data: acc } = await supabase
      .from('tiktok_accounts')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .single();
    setAccount(acc || null);
    if (!acc) setLoading(false);
  }

  async function fetchData() {
    if (!account) return;
    setLoading(true);
    const since = format(subDays(new Date(), dateRange), 'yyyy-MM-dd');
    const username = account.tiktok_username;

    const [profileRes, genderRes, countryRes, hourlyRes, videoRes] = await Promise.all([
      supabase.from('tiktok_profile_insights_view')
        .select('*')
        .eq('tiktok_username', username)
        .gte('date', since)
        .order('date', { ascending: true }),
      supabase.from('tiktok_audience_gender_view')
        .select('*')
        .eq('tiktok_username', username),
      supabase.from('tiktok_audience_country_view')
        .select('*')
        .eq('tiktok_username', username),
      supabase.from('tiktok_audience_hourly_view')
        .select('*')
        .eq('tiktok_username', username),
      supabase.from('tiktok_video_insights_view')
        .select('*')
        .eq('tiktok_username', username)
        .order('total_play', { ascending: false })
        .limit(20),
    ]);

    const { data: campaignStats } = await supabase
      .from('campaign_deliverables_with_stats')
      .select('*, campaign:campaigns!inner(campaign_name, brand_name, creator_profile_id, agency:agencies(name))')
      .eq('campaign.creator_profile_id', profile.id)
      .not('post_url', 'is', null)
      .not('views', 'is', null)
      .order('views', { ascending: false })
      .limit(20);

    setData({
      profile: profileRes.data || [],
      gender: genderRes.data || [],
      country: countryRes.data || [],
      hourly: hourlyRes.data || [],
      videos: videoRes.data || [],
      campaignStats: campaignStats || [],
    });
    setLoading(false);
  }

  if (!account && !loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div><div className="page-title">MY ANALYTICS</div></div>
        </div>
        <div className="card" style={{ maxWidth: 500 }}>
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">Analytics not set up yet</div>
            <div className="empty-state-text">Your manager needs to link your TikTok account. Let them know!</div>
          </div>
        </div>
      </div>
    );
  }

  const profileData = data?.profile || [];
  const profileClean = profileData.filter(d =>
    Number(d.followers_count) > 0 && Number(d.net_followers) > 0
  );
  const latestProfile = profileClean[profileClean.length - 1];
  const earliestProfile = profileClean[0];

  const followerGrowth = latestProfile && earliestProfile
    ? latestProfile.followers_count - earliestProfile.followers_count
    : null;

  const totalViews    = profileData.reduce((s, d) => s + (Number(d.video_views) || 0), 0);
  const totalLikes    = profileData.reduce((s, d) => s + (Number(d.likes) || 0), 0);
  const totalComments = profileData.reduce((s, d) => s + (Number(d.comments) || 0), 0);
  const totalShares   = profileData.reduce((s, d) => s + (Number(d.shares) || 0), 0);

  // Gender: detect 0-1 vs 0-100 scale
  const genderMap = {};
  data?.gender?.forEach(g => {
    if (!genderMap[g.gender]) genderMap[g.gender] = [];
    genderMap[g.gender].push(Number(g.percentage) || 0);
  });
  const allGenderVals = Object.values(genderMap).flat();
  const genderIsPercent = allGenderVals.some(v => v > 1);
  const genderAvg = Object.entries(genderMap).map(([k, vals]) => {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return {
      label: k,
      value: Math.round(genderIsPercent ? avg : avg * 100),
      color: k === 'Male' ? 'var(--blue)' : k === 'Female' ? 'var(--purple)' : 'var(--text-dim)',
    };
  });

  // Country: detect scale, top 8
  const allCountryVals = (data?.country || []).map(c => Number(c.percentage) || 0);
  const countryIsPercent = allCountryVals.some(v => v > 1);
  const topCountries = [...(data?.country || [])]
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .slice(0, 8)
    .map(c => {
      const raw = Number(c.percentage) || 0;
      const pct = countryIsPercent ? Math.round(raw * 10) / 10 : Math.round(raw * 1000) / 10;
      return { ...c, percentage: pct };
    });
  const maxCountryPct = Math.max(...topCountries.map(c => c.percentage || 0), 1);

  // Hourly: average by hour, normalize to 0-100
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
  const peakHour = hourlyAvg.reduce((max, h) => h.value > max.value ? h : max, { value: 0, label: '—' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MY ANALYTICS</div>
          <div className="page-subtitle">@{account?.tiktok_username}</div>
        </div>
        <select
          className="form-select"
          style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
          value={dateRange}
          onChange={e => setDateRange(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted">Loading analytics...</div>
      ) : profileClean.length === 0 ? (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">No TikTok data yet for @{account?.tiktok_username}</div>
            <div className="empty-state-text" style={{ maxWidth: 380, margin: '8px auto 0' }}>
              Analytics will appear here once Coupler.io starts syncing your TikTok data.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <StatTile label="Followers" value={fmtNum(latestProfile?.followers_count)} trend={followerGrowth} color="stat-accent" />
            <StatTile label={`Views (${dateRange}d)`} value={fmtNum(totalViews)} color="stat-green" />
            <StatTile label={`Likes (${dateRange}d)`} value={fmtNum(totalLikes)} />
            <StatTile label={`Comments (${dateRange}d)`} value={fmtNum(totalComments)} />
            <StatTile label={`Shares (${dateRange}d)`} value={fmtNum(totalShares)} />
          </div>

          {/* Follower growth */}
          <ChartCard title={`FOLLOWER GROWTH — LAST ${dateRange} DAYS`}>
            <SparkLine
              data={profileClean.map(d => Number(d.net_followers) || 0)}
              xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
              color="var(--orange)"
              height={120}
              fill={true}
              valueFormatter={v => fmtNum(v)}
            />
            <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              <span>{earliestProfile && format(parseISO(earliestProfile.date), 'MMM d')}</span>
              <span style={{ marginLeft: 'auto' }}>{latestProfile && format(parseISO(latestProfile.date), 'MMM d')}</span>
            </div>
          </ChartCard>

          {/* Views + Likes side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="DAILY VIDEO VIEWS">
              <SparkLine
                data={profileClean.map(d => Number(d.video_views) || 0)}
                xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
                color="var(--blue)"
                height={70}
                valueFormatter={v => fmtNum(v)}
              />
              <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{earliestProfile && format(parseISO(earliestProfile.date), 'MMM d')}</span>
                <span style={{ marginLeft: 'auto' }}>{latestProfile && format(parseISO(latestProfile.date), 'MMM d')}</span>
              </div>
            </ChartCard>
            <ChartCard title="DAILY LIKES">
              <SparkLine
                data={profileClean.map(d => Number(d.likes) || 0)}
                xLabels={profileClean.map(d => format(parseISO(d.date), 'MMM d'))}
                color="var(--purple)"
                height={70}
                valueFormatter={v => fmtNum(v)}
              />
              <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{earliestProfile && format(parseISO(earliestProfile.date), 'MMM d')}</span>
                <span style={{ marginLeft: 'auto' }}>{latestProfile && format(parseISO(latestProfile.date), 'MMM d')}</span>
              </div>
            </ChartCard>
          </div>

          {/* Audience row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="AUDIENCE GENDER">
              {genderAvg.length === 0 ? (
                <div className="text-muted text-sm">No data</div>
              ) : (
                <DonutChart segments={genderAvg} size={160} />
              )}
            </ChartCard>

            <ChartCard title="TOP COUNTRIES">
              {topCountries.length === 0 ? (
                <div className="text-muted text-sm">No data</div>
              ) : (
                topCountries.slice(0, 5).map(c => (
                  <HBar
                    key={c.country}
                    label={c.country}
                    value={c.percentage || 0}
                    max={maxCountryPct}
                    color="var(--blue)"
                    suffix="%"
                  />
                ))
              )}
            </ChartCard>

            <ChartCard title={`PEAK POSTING HOURS · Best: ${peakHour.label}`}>
              <BarChart
                data={hourlyAvg}
                color="var(--orange)"
                height={180}
                valueFormatter={v => v.toFixed(2)}
              />
            </ChartCard>
          </div>

          <CampaignPerformanceTable campaignStats={data?.campaignStats} />
          <TopVideosTable videos={data?.videos} />
        </>
      )}
    </div>
  );
}

// ============================================================
// Campaign performance table
// ============================================================
function CampaignPerformanceTable({ campaignStats }) {
  if (!campaignStats || campaignStats.length === 0) return null;

  const grouped = {};
  for (const d of campaignStats) {
    const key = d.campaign_id;
    if (!grouped[key]) grouped[key] = { meta: d.campaign, rows: [] };
    grouped[key].rows.push(d);
  }

  function totals(rows) {
    const n = rows.length;
    const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const avg = (key) => n ? sum(key) / n : null;
    const totalViews    = sum('views');
    const totalLikes    = sum('likes');
    const totalComments = sum('comments');
    const totalShares   = sum('shares');
    const engRate = totalViews > 0
      ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)
      : null;
    return {
      views: totalViews, likes: totalLikes, comments: totalComments, shares: totalShares,
      engagement_rate: engRate,
      average_time_watched: avg('average_time_watched'),
      full_video_watched_rate: avg('full_video_watched_rate'),
      reach: sum('reach'), count: n,
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
              <th style={{ fontSize: 11 }}>Campaign / Post</th>
              <th style={{ fontSize: 11 }}>Link</th>
              <th style={{ fontSize: 11 }}>Views</th>
              <th style={{ fontSize: 11 }}>Likes</th>
              <th style={{ fontSize: 11 }}>Comments</th>
              <th style={{ fontSize: 11 }}>Shares</th>
              <th style={{ fontSize: 11 }}>ER</th>
              <th style={{ fontSize: 11 }}>Avg Watch</th>
              <th style={{ fontSize: 11 }}>Completion</th>
              <th style={{ fontSize: 11 }}>Reach</th>
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
                        {i === 0 && (
                          <div style={{ fontWeight: 500, fontSize: 11, marginBottom: 1 }}>{meta?.campaign_name || '—'}</div>
                        )}
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          {d.video_title ? (d.video_title.length > 45 ? d.video_title.slice(0, 45) + '…' : d.video_title) : `Post ${i + 1}`}
                        </div>
                      </td>
                      <td style={cellSm}>
                        {d.post_url
                          ? <span className="link" style={{ fontSize: 11, cursor: 'pointer' }} onClick={() => openPopup(d.post_url)}>View ↗</span>
                          : '—'}
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
                    <td style={cellTot}>
                      {t.engagement_rate != null
                        ? <span style={{ color: erColor, fontWeight: 700 }}>{t.engagement_rate}%</span>
                        : '—'}
                    </td>
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

// ============================================================
// Top videos table
// ============================================================
function TopVideosTable({ videos }) {
  if (!videos || videos.length === 0) return null;

  return (
    <ChartCard title="TOP VIDEOS BY VIEWS">
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
            {videos.map(v => {
              const er = v.total_play > 0
                ? (((Number(v.total_like) || 0) + (Number(v.total_comment) || 0) + (Number(v.total_share) || 0)) / Number(v.total_play) * 100)
                : null;
              const erStr = er != null ? er.toFixed(2) : null;
              const erColor = er > 5 ? 'var(--green)' : er > 2 ? 'var(--orange)' : 'var(--text-muted)';
              return (
                <tr key={v.video_id}>
                  <td style={{ padding: '6px 8px', width: 56 }}>
                    {v.cover_image_url ? (
                      <div
                        onClick={() => openPopup(v.share_url || v.embed_url)}
                        style={{ width: 40, height: 54, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}
                      >
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
                    {v.create_time && (
                      <div className="text-muted text-xs">{fmtDate(v.create_time)}</div>
                    )}
                  </td>
                  <td style={{ color: 'var(--orange)', fontWeight: 600 }}>{fmtNum(v.total_play)}</td>
                  <td>{fmtNum(v.total_like)}</td>
                  <td>{fmtNum(v.total_comment)}</td>
                  <td>{fmtNum(v.total_share)}</td>
                  <td>
                    {erStr != null
                      ? <span style={{ color: erColor, fontWeight: 600 }}>{erStr}%</span>
                      : '—'}
                  </td>
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
