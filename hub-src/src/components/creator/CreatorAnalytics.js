import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { SparkLine, HBar, StatTile, ChartCard, fmtNum, fmtSecs, fmtPct } from '../shared/Charts';
import { fmtDate } from '../../utils/format';
import { format, parseISO, subDays } from 'date-fns';

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

    const [profileRes, genderRes, countryRes, videoRes, campaignRes] = await Promise.all([
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
      supabase.from('tiktok_video_insights_view')
        .select('*')
        .eq('tiktok_username', username)
        .order('total_play', { ascending: false })
        .limit(10),
      supabase.from('campaign_deliverables_with_stats')
        .select('*, campaign:campaigns(campaign_name, brand_name)')
        .eq('campaigns.creator_profile_id', profile.id)
        .not('post_url', 'is', null)
        .not('views', 'is', null)
        .order('views', { ascending: false }),
    ]);

    setData({
      profile: profileRes.data || [],
      gender: genderRes.data || [],
      country: countryRes.data || [],
      videos: videoRes.data || [],
      campaignStats: campaignRes.data || [],
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
  const latest = profileData[profileData.length - 1];
  const earliest = profileData[0];
  const followerGrowth = latest && earliest ? latest.followers_count - earliest.followers_count : null;
  const totalViews = profileData.reduce((s, d) => s + (d.video_views || 0), 0);
  const totalLikes = profileData.reduce((s, d) => s + (d.likes || 0), 0);

  // Gender
  const genderMap = {};
  data?.gender?.forEach(g => {
    if (!genderMap[g.gender]) genderMap[g.gender] = [];
    genderMap[g.gender].push(g.percentage * 100);
  });
  const genderAvg = Object.entries(genderMap).map(([k, vals]) => ({
    label: k,
    value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
  }));

  // Countries
  const topCountries = [...(data?.country || [])]
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
    .slice(0, 6)
    .map(c => ({ ...c, percentage: Math.round((c.percentage || 0) * 100 * 10) / 10 }));
  const maxPct = Math.max(...topCountries.map(c => c.percentage || 0), 1);

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
        </select>
      </div>

      {loading ? (
        <div className="text-muted">Loading your analytics...</div>
      ) : profileData.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">◈</div>
            <div className="empty-state-title">No data yet</div>
            <div className="empty-state-text">Analytics will appear here once Coupler.io starts syncing your TikTok data.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatTile label="Followers" value={fmtNum(latest?.followers_count)} trend={followerGrowth} color="stat-accent" />
            <StatTile label={`Views (${dateRange}d)`} value={fmtNum(totalViews)} color="stat-green" />
            <StatTile label={`Likes (${dateRange}d)`} value={fmtNum(totalLikes)} />
            <StatTile label="Profile Views" value={fmtNum(profileData.reduce((s, d) => s + (d.profile_views || 0), 0))} />
          </div>

          <ChartCard title={`FOLLOWER GROWTH — LAST ${dateRange} DAYS`}>
            <SparkLine data={profileData.map(d => d.net_followers || 0)} color="var(--orange)" height={80} />
            <div className="flex mt-8" style={{ fontSize: 11, color: 'var(--text-dim)', justifyContent: 'space-between' }}>
              <span>{earliest && format(parseISO(earliest.date), 'MMM d')}</span>
              <span>{latest && format(parseISO(latest.date), 'MMM d')}</span>
            </div>
          </ChartCard>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <ChartCard title="DAILY VIDEO VIEWS">
              <SparkLine data={profileData.map(d => d.video_views || 0)} color="var(--blue)" height={70} />
            </ChartCard>
            <ChartCard title="AUDIENCE BREAKDOWN">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Gender</div>
              {genderAvg.map(g => (
                <div key={g.label} className="flex items-center justify-between mb-8" style={{ fontSize: 13 }}>
                  <span>{g.label}</span>
                  <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{g.value}%</span>
                </div>
              ))}
            </ChartCard>
          </div>

          {topCountries.length > 0 && (
            <ChartCard title="TOP COUNTRIES">
              <div style={{ columns: 2, gap: 24 }}>
                {topCountries.map(c => (
                  <div key={c.country} style={{ breakInside: 'avoid', marginBottom: 4 }}>
                    <HBar label={c.country} value={c.percentage || 0} max={maxPct} suffix="%" />
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Sponsored campaign stats */}
          {data?.campaignStats?.length > 0 && (
            <ChartCard title="MY SPONSORED POST PERFORMANCE">
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Views</th>
                      <th>Likes</th>
                      <th>Engagement</th>
                      <th>Avg Watch</th>
                      <th>Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaignStats.map(d => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{d.campaign?.campaign_name}</div>
                          <div className="text-muted text-xs">{d.campaign?.brand_name}</div>
                        </td>
                        <td style={{ color: 'var(--orange)', fontWeight: 600 }}>{fmtNum(d.views)}</td>
                        <td>{fmtNum(d.likes)}</td>
                        <td>{d.engagement_rate != null ? `${d.engagement_rate}%` : '—'}</td>
                        <td>{fmtSecs(d.average_time_watched)}</td>
                        <td>{fmtPct(d.full_video_watched_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Top videos */}
          {data?.videos?.length > 0 && (
            <ChartCard title="MY TOP VIDEOS">
              <div className="table-wrap" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr><th>Video</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Watch Time</th></tr>
                  </thead>
                  <tbody>
                    {data.videos.map(v => (
                      <tr key={v.video_id}>
                        <td style={{ maxWidth: 180 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.video_title || v.video_id}
                          </div>
                          {v.create_time && <div className="text-muted text-xs">{fmtDate(v.create_time, 'MMM d')}</div>}
                        </td>
                        <td style={{ color: 'var(--orange)', fontWeight: 600 }}>{fmtNum(v.total_play)}</td>
                        <td>{fmtNum(v.total_like)}</td>
                        <td>{fmtNum(v.total_comment)}</td>
                        <td>{fmtNum(v.total_share)}</td>
                        <td>{fmtSecs(v.average_time_watched)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
