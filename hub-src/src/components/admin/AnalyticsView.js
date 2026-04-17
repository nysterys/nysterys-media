import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SparkLine, BarChart, HBar, DonutChart, StatTile, ChartCard, fmtNum, fmtSecs, fmtPct } from '../shared/Charts';
import { format, parseISO, subDays } from 'date-fns';

export default function AnalyticsView() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [dateRange, setDateRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selectedAccount) fetchAnalytics(); }, [selectedAccount, dateRange]);

  async function fetchAccounts() {
    const { data: accs } = await supabase
      .from('tiktok_accounts')
      .select('*, profile:profiles(full_name, creator_name)')
      .eq('is_active', true);
    setAccounts(accs || []);
    if (accs && accs.length > 0) setSelectedAccount(accs[0]);
    setLoading(false);
  }

  async function fetchAnalytics() {
    if (!selectedAccount) return;
    setLoading(true);
    const since = format(subDays(new Date(), dateRange), 'yyyy-MM-dd');
    const username = selectedAccount.tiktok_username;

    const [profileRes, genderRes, countryRes, hourlyRes, videoRes] = await Promise.all([
      supabase.from('tiktok_profile_insights')
        .select('*')
        .eq('tiktok_username', username)
        .gte('date', since)
        .order('date', { ascending: true }),
      supabase.from('tiktok_audience_gender')
        .select('*')
        .eq('tiktok_username', username)
        .order('date', { ascending: false })
        .limit(10),
      supabase.from('tiktok_audience_country')
        .select('*')
        .eq('tiktok_username', username)
        .order('date', { ascending: false })
        .limit(50),
      supabase.from('tiktok_audience_hourly')
        .select('*')
        .eq('tiktok_username', username)
        .order('date', { ascending: false })
        .limit(48),
      supabase.from('tiktok_video_insights')
        .select('*')
        .eq('tiktok_username', username)
        .order('total_play', { ascending: false })
        .limit(20),
    ]);

    // Also fetch campaign deliverables that have TikTok posts for this creator
    const { data: campaignStats } = await supabase
      .from('campaign_deliverables_with_stats')
      .select('*, campaign:campaigns(campaign_name, brand_name, agency:agencies(name))')
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

  if (!accounts || accounts.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">ANALYTICS</div>
            <div className="page-subtitle">TikTok performance tracking</div>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-title">SETUP REQUIRED</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            No TikTok accounts configured yet. Go to <strong style={{ color: 'var(--text)' }}>Setup → TikTok Accounts</strong> to link Kym and Mys's TikTok usernames to their profiles. Then configure Coupler.io to sync data into Supabase.
          </p>
        </div>
      </div>
    );
  }

  const profile = data?.profile || [];
  const latestProfile = profile[profile.length - 1];
  const earliestProfile = profile[0];

  const followerGrowth = latestProfile && earliestProfile
    ? latestProfile.followers_count - earliestProfile.followers_count
    : null;

  const totalViews = profile.reduce((s, d) => s + (d.video_views || 0), 0);
  const totalLikes = profile.reduce((s, d) => s + (d.likes || 0), 0);
  const totalComments = profile.reduce((s, d) => s + (d.comments || 0), 0);
  const totalShares = profile.reduce((s, d) => s + (d.shares || 0), 0);

  // Gender: average across recent rows
  const genderMap = {};
  data?.gender?.forEach(g => {
    if (!genderMap[g.gender]) genderMap[g.gender] = [];
    genderMap[g.gender].push(g.percentage);
  });
  const genderAvg = Object.entries(genderMap).map(([k, vals]) => ({
    label: k,
    value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    color: k === 'Male' ? 'var(--blue)' : k === 'Female' ? 'var(--purple)' : 'var(--text-dim)',
  }));

  // Country: latest date, top 8
  const latestDate = data?.country?.[0]?.date;
  const topCountries = data?.country
    ?.filter(c => c.date === latestDate)
    ?.sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    ?.slice(0, 8) || [];
  const maxCountryPct = Math.max(...topCountries.map(c => c.percentage || 0), 1);

  // Hourly: average activity by hour across recent days
  const hourlyMap = {};
  data?.hourly?.forEach(h => {
    if (!hourlyMap[h.hour]) hourlyMap[h.hour] = [];
    hourlyMap[h.hour].push(h.activity_score || 0);
  });
  const hourlyAvg = Array.from({ length: 24 }, (_, i) => ({
    label: i === 0 ? '12a' : i === 12 ? '12p' : i < 12 ? `${i}a` : `${i - 12}p`,
    value: hourlyMap[i] ? hourlyMap[i].reduce((s, v) => s + v, 0) / hourlyMap[i].length : 0,
  }));
  const peakHour = hourlyAvg.reduce((max, h) => h.value > max.value ? h : max, { value: 0, label: '—' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">ANALYTICS</div>
          <div className="page-subtitle">TikTok performance data via Coupler.io</div>
        </div>
        <div className="flex gap-8 items-center">
          {/* Account switcher */}
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
          {/* Date range */}
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
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-muted">Loading analytics...</div>
      ) : profile.length === 0 ? (
        <NoDataState username={selectedAccount?.tiktok_username} />
      ) : (
        <>
          {/* KPI row */}
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <StatTile
              label="Followers"
              value={fmtNum(latestProfile?.followers_count)}
              trend={followerGrowth}
              color="stat-accent"
            />
            <StatTile label={`Views (${dateRange}d)`} value={fmtNum(totalViews)} color="stat-green" />
            <StatTile label={`Likes (${dateRange}d)`} value={fmtNum(totalLikes)} />
            <StatTile label={`Comments (${dateRange}d)`} value={fmtNum(totalComments)} />
            <StatTile label={`Shares (${dateRange}d)`} value={fmtNum(totalShares)} />
          </div>

          {/* Follower growth chart */}
          <ChartCard title={`FOLLOWER GROWTH — LAST ${dateRange} DAYS`}>
            <SparkLine
              data={profile.map(d => d.followers_count || 0)}
              color="var(--accent)"
              height={80}
              fill={true}
            />
            <div className="flex gap-16 mt-8" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              <span>{profile[0] && format(parseISO(profile[0].date), 'MMM d')}</span>
              <span style={{ marginLeft: 'auto' }}>{latestProfile && format(parseISO(latestProfile.date), 'MMM d')}</span>
            </div>
          </ChartCard>

          {/* Video views + Likes side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="DAILY VIDEO VIEWS">
              <SparkLine
                data={profile.map(d => d.video_views || 0)}
                color="var(--blue)"
                height={70}
              />
            </ChartCard>
            <ChartCard title="DAILY LIKES">
              <SparkLine
                data={profile.map(d => d.likes || 0)}
                color="var(--purple)"
                height={70}
              />
            </ChartCard>
          </div>

          {/* Audience row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Gender */}
            <ChartCard title="AUDIENCE GENDER">
              {genderAvg.length === 0 ? (
                <div className="text-muted text-sm">No data yet</div>
              ) : (
                <div className="flex items-center gap-16">
                  <DonutChart segments={genderAvg} size={80} />
                  <div style={{ flex: 1 }}>
                    {genderAvg.map(g => (
                      <div key={g.label} className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 6 }}>
                        <div className="flex items-center gap-6">
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} />
                          <span>{g.label}</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>{g.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Top countries */}
            <ChartCard title="TOP COUNTRIES">
              {topCountries.length === 0 ? (
                <div className="text-muted text-sm">No data yet</div>
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

            {/* Peak hours */}
            <ChartCard title={`PEAK POSTING HOURS · Best: ${peakHour.label}`}>
              <BarChart
                data={hourlyAvg}
                color="var(--accent)"
                height={90}
                valueFormatter={v => v.toFixed(2)}
              />
            </ChartCard>
          </div>

          {/* Campaign performance */}
          <CampaignPerformanceTable campaignStats={data?.campaignStats} />

          {/* Top videos */}
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

  return (
    <ChartCard title="SPONSORED CAMPAIGN PERFORMANCE">
      <div className="table-wrap" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Platform</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Engagement Rate</th>
              <th>Avg Watch Time</th>
              <th>Completion</th>
              <th>Reach</th>
            </tr>
          </thead>
          <tbody>
            {campaignStats.map(d => (
              <tr key={d.id} onClick={() => {}}>
                <td>
                  <div style={{ fontWeight: 500 }}>{d.campaign?.campaign_name || '—'}</div>
                  <div className="text-muted text-xs">{d.campaign?.brand_name}</div>
                </td>
                <td>
                  {d.post_url ? (
                    <a href={d.post_url} target="_blank" rel="noreferrer" className="link text-sm" onClick={e => e.stopPropagation()}>
                      View ↗
                    </a>
                  ) : '—'}
                </td>
                <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtNum(d.views)}</td>
                <td>{fmtNum(d.likes)}</td>
                <td>{fmtNum(d.comments)}</td>
                <td>{fmtNum(d.shares)}</td>
                <td>
                  {d.engagement_rate != null ? (
                    <span style={{ color: d.engagement_rate > 5 ? 'var(--green)' : d.engagement_rate > 2 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {d.engagement_rate}%
                    </span>
                  ) : '—'}
                </td>
                <td>{fmtSecs(d.average_time_watched)}</td>
                <td>{fmtPct(d.full_video_watched_rate)}</td>
                <td>{fmtNum(d.reach)}</td>
              </tr>
            ))}
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
              <th>Video</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Avg Watch</th>
              <th>Completion</th>
              <th>Reach</th>
            </tr>
          </thead>
          <tbody>
            {videos.map(v => (
              <tr key={v.video_id}>
                <td style={{ maxWidth: 200 }}>
                  <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.video_title || v.video_id}
                  </div>
                  {v.create_time && (
                    <div className="text-muted text-xs">
                      {format(new Date(v.create_time), 'MMM d, yyyy')}
                    </div>
                  )}
                </td>
                <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtNum(v.total_play)}</td>
                <td>{fmtNum(v.total_like)}</td>
                <td>{fmtNum(v.total_comment)}</td>
                <td>{fmtNum(v.total_share)}</td>
                <td>{fmtSecs(v.average_time_watched)}</td>
                <td>
                  {v.full_video_watched_rate != null ? (
                    <div className="flex items-center gap-8">
                      <div style={{ width: 40, height: 4, background: 'var(--surface3)', borderRadius: 2 }}>
                        <div style={{ width: `${v.full_video_watched_rate * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{fmtPct(v.full_video_watched_rate)}</span>
                    </div>
                  ) : '—'}
                </td>
                <td>{fmtNum(v.reach)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ============================================================
// No data state
// ============================================================
function NoDataState({ username }) {
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="empty-state" style={{ padding: '30px 20px' }}>
        <div className="empty-state-icon">◈</div>
        <div className="empty-state-title">No TikTok data yet for @{username}</div>
        <div className="empty-state-text" style={{ maxWidth: 380, margin: '8px auto 0' }}>
          Coupler.io hasn't synced data yet, or the sync hasn't been configured for this account. Check your Coupler.io importer setup.
        </div>
      </div>
    </div>
  );
}
