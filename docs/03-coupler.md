# 03 — Coupler.io TikTok Analytics Setup

Coupler.io syncs TikTok Organic data directly into your Supabase database on a schedule. Once configured, the Creator Hub analytics dashboard populates automatically with no manual work.

---

## Prerequisites

- Supabase schemas `01` through `04` already run
- TikTok accounts linked in the app: **Setup → TikTok Accounts**
- Supabase **service_role** key (Dashboard → Settings → API)

---

## How the data flows

```
TikTok API
    ↓  (Coupler.io pulls on schedule)
Coupler.io
    ↓  (writes to PostgreSQL)
Supabase database
    ↓  (app reads via Supabase client)
Creator Hub Analytics dashboard
```

The analytics view joins TikTok video stats to campaign deliverables automatically. When a post URL like `https://www.tiktok.com/@mysthegreat/video/7234567890123456789` is saved on a deliverable, the app extracts `7234567890123456789` as the video ID and joins it to the `tiktok_video_insights` table. No manual linking required.

---

## Supabase connection settings for Coupler.io

Use these for every importer you create:

| Field | Value |
|-------|-------|
| Host | `db.YOUR-PROJECT-ID.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| Username | `postgres` |
| Password | Your Supabase **service_role** key |
| SSL | **Required** |

Your project ID is the subdomain in your Supabase URL: `https://PROJECT-ID.supabase.co`

---

## The 6 importers to create

Create one importer per report type. Each connects to one TikTok account. Since you have two creators (Kym and Mys), you create **12 importers total** — 6 per creator.

Alternatively, use Coupler.io's "merge sources" feature to combine both accounts into a single flow per report type (6 importers total), adding a static `tiktok_username` column in the transform step to identify which account each row belongs to.

---

### Importer 1 — Profile Insights

**Report type:** Profile insights

**What it captures:** Daily follower count, video views, profile views, likes, comments, shares, net follower change.

**Transform step — add a static column:**
- Column name: `tiktok_username`
- Value: the creator's TikTok username with no @ (e.g. `mysthegreat` or `kymchi_n_crackers`)

**Destination table:** `tiktok_profile_insights`

**Column mapping:**

| Coupler.io field | Table column |
|-----------------|-------------|
| Date | `date` |
| Video Views | `video_views` |
| Profile Views | `profile_views` |
| Likes | `likes` |
| Comments | `comments` |
| Shares | `shares` |
| Followers Count | `followers_count` |
| Net Followers | `net_followers` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `date`)
**Schedule:** Daily

---

### Importer 2 — Audience Gender

**Report type:** Profile audience genders

**Destination table:** `tiktok_audience_gender`

| Coupler.io field | Table column |
|-----------------|-------------|
| Date | `date` |
| Gender | `gender` |
| Percentage | `percentage` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `date` + `gender`)
**Schedule:** Daily

---

### Importer 3 — Audience Countries

**Report type:** Profile audience countries

**Destination table:** `tiktok_audience_country`

| Coupler.io field | Table column |
|-----------------|-------------|
| Date | `date` |
| Country | `country` |
| Country Code | `country_code` |
| Percentage | `percentage` |
| Follower Count | `follower_count` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `date` + `country`)
**Schedule:** Daily

---

### Importer 4 — Audience Hourly Activity

**Report type:** Profile audience hourly activity

**Destination table:** `tiktok_audience_hourly`

| Coupler.io field | Table column |
|-----------------|-------------|
| Date | `date` |
| Hour | `hour` |
| Activity Score | `activity_score` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `date` + `hour`)
**Schedule:** Daily

---

### Importer 5 — Video Insights ⭐ Most important

**Report type:** Video list insights

This is the table that powers per-campaign performance. It contains lifetime stats for every video on the account and is joined to campaign deliverables via the TikTok video ID.

> **Note:** TikTok's API does not support date filtering for this report. You always get lifetime stats for all videos. This is a TikTok API limitation, not a Coupler.io limitation.

**Destination table:** `tiktok_video_insights`

| Coupler.io field | Table column |
|-----------------|-------------|
| Video ID | `video_id` |
| Video Title | `video_title` |
| Cover Image URL | `cover_image_url` |
| Create Time | `create_time` |
| Total Play / Video Views | `total_play` |
| Total Like | `total_like` |
| Total Comment | `total_comment` |
| Total Share | `total_share` |
| Total Download | `total_download` |
| Average Time Watched | `average_time_watched` |
| Video Duration | `video_duration` |
| Full Video Watched Rate | `full_video_watched_rate` |
| Reach | `reach` |
| Impressions | `impressions` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `video_id`)
**Schedule:** Daily or every 6 hours — this drives campaign stats freshness

---

### Importer 6 — Video Top Countries

**Report type:** Video list top countries

**Destination table:** `tiktok_video_countries`

| Coupler.io field | Table column |
|-----------------|-------------|
| Video ID | `video_id` |
| Country | `country` |
| Country Code | `country_code` |
| Play Count | `play_count` |
| Like Count | `like_count` |
| *(static)* | `tiktok_username` |

**Write mode:** Upsert (conflict on `tiktok_username` + `video_id` + `country`)
**Schedule:** Daily

---

## Critical: tiktok_username must match exactly

The username you enter as the static column in Coupler.io **must exactly match** what you enter in the app under **Setup → TikTok Accounts**. It is case-sensitive.

Example — if Mys's TikTok URL is `https://www.tiktok.com/@mysthegreat`:
- Coupler.io static column value: `mysthegreat`
- App TikTok Accounts entry: `mysthegreat`

A mismatch means her data will be imported but the app cannot match it to her profile.

---

## Recommended sync schedule

| Report | Frequency | Reason |
|--------|-----------|--------|
| Profile insights | Daily | Follower counts update daily |
| Audience gender | Daily | Demographics shift slowly |
| Audience countries | Daily | Demographics shift slowly |
| Audience hourly | Daily | Activity patterns shift slowly |
| Video insights | Daily or 6-hourly | Campaign stats freshness |
| Video top countries | Daily | Geographic data is stable |

---

## Testing the setup

After running your first sync:

1. Supabase Table Editor → `tiktok_video_insights` — should have rows with video IDs and play counts
2. Supabase Table Editor → `tiktok_profile_insights` — should have daily rows with follower counts
3. Creator Hub → Analytics → select Kym or Mys — data should appear
4. Open a campaign that has a post URL → view the Stats panel — view counts should show

**If data is missing:**
- Confirm `tiktok_username` in Coupler.io matches exactly what is in Setup → TikTok Accounts
- Check the Coupler.io importer run log for errors
- Check the Supabase Table Editor to confirm rows were inserted (not just that the sync ran)
- Confirm the Supabase PostgreSQL connection uses the service_role key, not the anon key
