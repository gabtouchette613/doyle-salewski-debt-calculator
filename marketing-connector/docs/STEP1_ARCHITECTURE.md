# Marketing Dashboard Connector — Step 1: Architecture & Implementation Plan

**Status:** Design approved pending review · **Date:** 2026-07-04
**First client:** Doyle Salewski (insolvency/debt-relief, Ottawa — lead gen via forms + calls, CAD, America/Toronto)

---

## 1. Executive Summary

We are building a **read-only, multi-client marketing reporting pipeline**:

> Google Ads API + Meta Marketing API → scheduled daily ETL (Python) → BigQuery (raw + normalized tables) → SQL dashboard views → Looker Studio client dashboards → SQL-driven QA alerts.

It is **not** an ad optimizer. It never writes to the ad platforms. Its job is to make client performance data trustworthy, current, and queryable in one place.

**The minimum viable version:**

- One Python codebase with two independent connectors (Google Ads, Meta Ads).
- Daily scheduled run (GitHub Actions cron) that re-pulls a rolling **30-day window** per account, so delayed conversions and attribution restatements self-heal.
- BigQuery storage: platform-specific raw daily tables (lossless), plus one **normalized cross-platform daily performance table** with consistent metric definitions (spend, leads, calls, forms, CPL, etc.).
- A `clients` / `platform_accounts` mapping layer so every row is attributable to a client (starting with Doyle Salewski).
- A `conversion_action_map` that classifies each platform conversion action into `lead` / `call` / `form` / `purchase` / `other` — this is what makes "Leads" mean the same thing on both platforms.
- Sync logging, idempotent writes (delete+insert per account/date-window), and a handful of SQL QA alerts.
- Looker Studio dashboards reading from views, not base tables.

---

## 2. Recommended Technical Stack

### Comparisons

**BigQuery vs Supabase/Postgres**

| | BigQuery | Supabase/Postgres |
|---|---|---|
| Ops burden | Zero (serverless) | Low but nonzero (instance, backups, connection limits) |
| Cost at this scale | Effectively free (<10 GB, <1 TB queried/mo free tier) | Free tier OK, paid tier ~$25/mo when you outgrow it |
| Looker Studio | Native, free, fast connector | Needs Postgres connector; connection pooling issues with many viewers |
| Upserts | MERGE / delete+insert (fine for batch) | Native `ON CONFLICT` (nicer for row-level upsert) |
| Analytical SQL | Excellent (partitioning, window fns at scale) | Fine at this data volume |
| Future GA4 / other GCP data | Native (GA4 exports land in BigQuery) | Requires extra pipes |

**Verdict: BigQuery.** Ad reporting data is append-heavy, batch-written, read by dashboards — BigQuery's exact sweet spot. The GA4-native-export and free Looker Studio connector are decisive for a marketing agency. Postgres's row-level upsert advantage doesn't matter because our write pattern is "replace a 30-day window per account," which is a clean batch delete+insert.

**Cloud Run vs Cloud Functions vs GitHub Actions**

| | Cloud Run Jobs | Cloud Functions | GitHub Actions |
|---|---|---|---|
| Setup effort | Medium (Docker, Artifact Registry, Scheduler, IAM) | Medium (timeout limits bite) | Minimal (cron in YAML, secrets built in) |
| Runtime limits | 24h | 9–60 min (risky for backfills) | 6h per job (plenty) |
| Secrets | Secret Manager (best) | Secret Manager | GitHub encrypted secrets (good) |
| Logs | Cloud Logging | Cloud Logging | Actions UI (90-day retention) |
| Cost | ~Free at this scale | ~Free | Free (public/private repo minutes) |

**Verdict: GitHub Actions for the MVP**, with the code containerized from day one (Dockerfile in repo) so promotion to **Cloud Run Jobs + Cloud Scheduler** later is a config change, not a rewrite. GitHub Actions gives us cron, secret storage, retry via re-run, and visible logs with zero infrastructure. Cloud Functions is eliminated by timeout risk during backfills.

**Looker Studio vs Metabase vs custom dashboard**

- **Looker Studio**: free, native BigQuery, trivially shareable with clients, familiar to marketers. Weaknesses (versioning, slow with bad data models) are mitigated by pointing it only at pre-aggregated views.
- **Metabase**: nicer internal analytics, but you must host it (~$10–25/mo + ops) and client sharing is clunkier.
- **Custom dashboard**: highest effort, zero MVP payoff. Only justified later if you productize.

**Verdict: Looker Studio.** One template report, duplicated per client with a client filter — standard agency pattern.

**Python vs Node.js**

- `google-ads` (Python) is the best-maintained Google Ads client library; GAQL examples in docs are Python-first.
- `facebook_business` (Python) is Meta's official SDK.
- BigQuery's Python client (`google-cloud-bigquery`) is first-class; data-shaping ergonomics are better in Python.
- Node is viable but every reference implementation for this exact pipeline is Python.

**Verdict: Python 3.11+.**

### Recommended primary stack

| Layer | Choice |
|---|---|
| Language | Python 3.11+ |
| Connectors | `google-ads`, `facebook_business` official SDKs |
| Storage | BigQuery (datasets: `raw`, `core`, `ops`; views in `dash`) |
| Scheduler (MVP) | GitHub Actions cron, daily · promote to Cloud Run Jobs + Cloud Scheduler later |
| Secrets (MVP) | GitHub Actions secrets · promote to GCP Secret Manager with Cloud Run |
| Dashboards | Looker Studio on `dash.*` views |
| Alerts (MVP) | SQL checks writing to `ops.qa_alerts` + summary in job log; email/Slack later |

---

## 3. System Architecture

```
                ┌──────────────────────────── daily cron (GitHub Actions, ~09:00 UTC) ─┐
                │                                                                      │
┌───────────────▼──────────────┐        ┌─────────────────────────┐                    │
│ Google Ads API (v-latest)    │        │ Meta Marketing API       │                    │
│ OAuth2 refresh token + dev   │        │ (Graph API, insights)    │                    │
│ token, login-customer-id=MCC │        │ System-user token,       │                    │
│ GAQL search_stream           │        │ ads_read                 │                    │
└───────────────┬──────────────┘        └───────────┬─────────────┘                    │
                │ per active account: pull rolling 30-day window                       │
                ▼                                    ▼                                 │
        ┌──────────────────────────────────────────────────┐                           │
        │ Connector layer (Python)                         │                           │
        │ - auth/token refresh, retry w/ backoff           │                           │
        │ - pagination/streaming                           │                           │
        │ - field normalization (micros→currency, actions  │                           │
        │   array→columns)                                 │                           │
        │ - row validation (types, non-negative, date in   │                           │
        │   window)                                        │                           │
        └──────────────┬───────────────────────────────────┘                           │
                       │ idempotent write: DELETE window rows → INSERT fresh           │
                       ▼                                                               │
        ┌──────────────────────────────────────────────────┐                           │
        │ BigQuery                                         │                           │
        │  raw.google_ads_* / raw.meta_* (lossless daily)  │                           │
        │  core.clients, core.platform_accounts,           │                           │
        │  core.conversion_action_map                      │                           │
        │  core.normalized_daily_performance (rebuilt from │                           │
        │  raw for the same window)                        │                           │
        │  ops.data_sync_logs, ops.qa_alerts,              │                           │
        │  ops.api_credentials_metadata                    │                           │
        └──────────────┬───────────────────────────────────┘                           │
                       ▼                                                               │
        ┌──────────────────────────┐   ┌──────────────────────────┐                    │
        │ dash.* SQL views         │   │ QA alert SQL (post-ETL)  │◄───────────────────┘
        │ (client summary,         │   │ writes ops.qa_alerts,    │
        │ campaign, keywords,      │   │ prints summary to log    │
        │ search terms, ads…)      │   └──────────────────────────┘
        └───────────┬──────────────┘
                    ▼
        Looker Studio client dashboards (read-only service account / viewer creds)
```

**Auth/token management.** Google Ads: developer token + OAuth client + long-lived refresh token generated once against the MCC login; access tokens are refreshed automatically by the SDK. Meta: Business Manager **system user** token (non-expiring, `ads_read` only). All secrets live in the scheduler's secret store; BigQuery only ever stores non-secret metadata (which credential, when last used/validated, expiry) in `ops.api_credentials_metadata`.

**Data validation.** Before writing: schema/type checks, dates within requested window, metrics non-negative, account currency matches `platform_accounts`. Rows failing validation are dropped and counted in `data_sync_logs.rows_rejected` (never silently).

**Raw vs normalized.** Raw tables keep platform vocabulary and enough platform-specific fields to re-derive anything (e.g., Meta `actions` broken into mapped columns *plus* a `raw_actions_json` column). The normalized table is rebuilt from raw for the same window in the same run — so raw and normalized never disagree.

**Read-only guarantee.** Connectors only use reporting/read endpoints; Google Ads mutate services and Meta write endpoints are never imported. Meta token is scoped `ads_read` (not `ads_management`).

---

## 4. MVP Scope

**In:**

1. Google Ads: campaign daily, ad group daily, keyword daily, search terms daily, conversion-action daily (segmented by conversion action).
2. Meta: campaign daily, ad set daily, ad daily (insights incl. actions, frequency, reach).
3. `clients` + `platform_accounts` mapping (seeded with Doyle Salewski and its Google Ads + Meta account IDs).
4. `conversion_action_map` classification (lead/call/form/purchase/other) — seeded manually per client.
5. Daily scheduled refresh; rolling 30-day re-pull; idempotent delete+insert.
6. `core.normalized_daily_performance` + dashboard views + one Looker Studio template.
7. Sync logs and 5 starter QA alerts.
8. CLI backfill mode (`--start/--end`, chunked).

**Out of MVP** (see §5): geo/device/landing-page breakdowns, budget pacing, alert delivery (email/Slack), hourly data, GA4/CallRail/CRM joins, demographic breakdowns, creative asset-level reporting.

---

## 5. Future Scope (ordered by expected value)

1. **Budget pacing** — needs a `client_budgets` table (monthly budget per client/platform); pacing view = MTD spend vs. day-of-month expectation. Cheap to add, high client value.
2. **Alert delivery** — email (SendGrid/SES) or Slack webhook digest of new `qa_alerts`.
3. **Location & device breakdowns** — new segmented raw tables (`google_ads_geo_daily`, `google_ads_device_daily`, Meta breakdowns). Beware: breakdown rows don't sum exactly to totals on Meta.
4. **Landing page performance** — Google Ads `landing_page_view` resource; Meta needs UTM discipline + GA4.
5. **Creative fatigue** — Meta frequency + CTR trend per ad (frequency already captured in MVP raw table, so this is just a view).
6. **Client-specific dashboards** — Looker Studio template duplication per client, or row-level filtering.
7. **Anomaly detection** — z-score on 28-day trailing window per metric; only after 60+ days of history exists.
8. **Slack/email weekly summaries** — templated from `dashboard_client_summary`.
9. **GA4, Google Search Console, CallRail, HubSpot/CRM** — CallRail matters early for Doyle Salewski (call-heavy lead flow) if calls aren't already imported as platform conversions.

---

## 6. Database Schema

**Datasets:** `raw` (platform-specific), `core` (mapping + normalized), `ops` (logs/alerts/meta), `dash` (views only).
**Conventions:** all money in account currency as `NUMERIC`; all dates are the platform-reported stat date in the **ad account's timezone**; every raw table carries `synced_at TIMESTAMP` (run watermark). BigQuery has no enforced PKs — "primary key" below means the logical uniqueness contract enforced by the delete+insert window pattern.

### 6.1 `core.clients`

| Column | Type | Description |
|---|---|---|
| client_id | STRING | Slug, e.g. `doyle_salewski` |
| client_name | STRING | Display name, e.g. "Doyle Salewski" |
| status | STRING | `active` / `paused` / `offboarded` |
| currency | STRING | Reporting currency, e.g. `CAD` |
| timezone | STRING | e.g. `America/Toronto` |
| vertical | STRING | e.g. `insolvency` (optional) |
| created_at | TIMESTAMP | Row created |
| notes | STRING | Free text |

PK: `client_id`. Tiny table — no partitioning.

### 6.2 `core.platform_accounts`

| Column | Type | Description |
|---|---|---|
| account_key | STRING | `{platform}:{account_id}` surrogate |
| client_id | STRING | FK → clients |
| platform | STRING | `google_ads` / `meta` |
| account_id | STRING | Google CID (digits, no dashes) or Meta `act_` numeric id |
| account_name | STRING | Platform account name |
| currency | STRING | Account currency (validated against API) |
| timezone | STRING | Account timezone from platform |
| status | STRING | `active` / `paused` (controls whether ETL pulls it) |
| login_customer_id | STRING | Google only: MCC id to use |
| created_at | TIMESTAMP | |

PK: `account_key`. Unique: (`platform`,`account_id`). No partitioning.

### 6.3 `core.conversion_action_map`

The semantic layer that makes leads/calls/forms consistent.

| Column | Type | Description |
|---|---|---|
| platform | STRING | `google_ads` / `meta` |
| account_id | STRING | Scope mapping per account |
| source_key | STRING | Google: conversion_action resource id. Meta: `action_type` string (e.g. `lead`, `onsite_conversion.lead_grouped`, `offsite_conversion.fb_pixel_lead`, `click_to_call_call_confirm`) |
| source_name | STRING | Human-readable platform name |
| category | STRING | `lead` / `call` / `form` / `purchase` / `other` |
| counts_as_lead | BOOL | Whether it rolls into the headline "Leads" metric |
| is_primary | BOOL | Google: primary-for-bidding flag (informational) |
| updated_at | TIMESTAMP | |

PK: (`platform`,`account_id`,`source_key`). Unmapped actions found by ETL are auto-inserted with `category='other'`, `counts_as_lead=false` and raised as a QA alert — nothing is silently dropped.

### 6.4 Google Ads raw tables — shared columns

All five tables share: `date DATE`, `account_id STRING`, `impressions INT64`, `clicks INT64`, `cost NUMERIC` (converted from micros), `conversions FLOAT64` (Google reports fractional), `conversion_value NUMERIC`, `synced_at TIMESTAMP`.
**Partition:** by `date`. **Cluster:** by `account_id`, then the entity id column.

**`raw.google_ads_campaign_daily`** — adds: `campaign_id STRING`, `campaign_name STRING`, `campaign_status STRING`, `advertising_channel_type STRING` (SEARCH/PMAX/DISPLAY/…), `budget_amount NUMERIC` (daily budget snapshot). PK: (`date`,`account_id`,`campaign_id`).

**`raw.google_ads_ad_group_daily`** — adds: `campaign_id`, `campaign_name`, `ad_group_id STRING`, `ad_group_name STRING`, `ad_group_status STRING`. PK: (`date`,`account_id`,`ad_group_id`).

**`raw.google_ads_keyword_daily`** — adds: `campaign_id`, `campaign_name`, `ad_group_id`, `ad_group_name`, `criterion_id STRING`, `keyword_text STRING`, `match_type STRING`, `keyword_status STRING`, `quality_score INT64 (nullable)`. PK: (`date`,`account_id`,`ad_group_id`,`criterion_id`).

**`raw.google_ads_search_terms_daily`** — adds: `campaign_id`, `campaign_name`, `ad_group_id`, `ad_group_name`, `search_term STRING`, `search_term_match_type STRING`, `search_term_status STRING` (ADDED/EXCLUDED/NONE). PK: (`date`,`account_id`,`ad_group_id`,`search_term`,`search_term_match_type`). Note: low-volume terms are omitted by Google, so totals < campaign totals.

**`raw.google_ads_conversion_action_daily`** — campaign stats segmented by conversion action; only conversion columns are meaningful. Columns: `date`, `account_id`, `campaign_id`, `campaign_name`, `conversion_action_id STRING`, `conversion_action_name STRING`, `conversion_action_category STRING` (Google's own category, e.g. `SUBMIT_LEAD_FORM`, `PHONE_CALL_LEAD`), `conversions FLOAT64`, `conversion_value NUMERIC`, `all_conversions FLOAT64`, `synced_at`. PK: (`date`,`account_id`,`campaign_id`,`conversion_action_id`).

### 6.5 Meta raw tables — shared columns

All three share: `date DATE`, `account_id STRING`, `impressions INT64`, `clicks INT64` (link clicks stored separately as `link_clicks INT64`), `spend NUMERIC`, `reach INT64`, `frequency FLOAT64`, `leads FLOAT64`, `calls FLOAT64`, `forms FLOAT64`, `purchases FLOAT64`, `conversion_value NUMERIC`, `raw_actions_json JSON` (full untouched `actions`/`action_values` arrays), `synced_at TIMESTAMP`.
Lead/call/form columns are derived at load time via `conversion_action_map`; the JSON preserves everything for re-derivation. **Partition:** `date`. **Cluster:** `account_id` + entity id.

**`raw.meta_campaign_daily`** — adds `campaign_id STRING`, `campaign_name STRING`, `campaign_status STRING`, `objective STRING`, `daily_budget NUMERIC (nullable)`. PK: (`date`,`account_id`,`campaign_id`).

**`raw.meta_adset_daily`** — adds `campaign_id`, `campaign_name`, `adset_id STRING`, `adset_name STRING`, `adset_status STRING`, `daily_budget NUMERIC (nullable)`. PK: (`date`,`account_id`,`adset_id`).

**`raw.meta_ad_daily`** — adds `campaign_id`, `campaign_name`, `adset_id`, `adset_name`, `ad_id STRING`, `ad_name STRING`, `ad_status STRING`, `creative_id STRING (nullable)`. PK: (`date`,`account_id`,`ad_id`).

### 6.6 `core.normalized_daily_performance`

Campaign-grain, cross-platform. Rebuilt from raw for the synced window each run.

| Column | Type | Description |
|---|---|---|
| date | DATE | Stat date (account TZ) |
| client_id | STRING | From platform_accounts join |
| platform | STRING | `google_ads` / `meta` |
| account_id | STRING | |
| campaign_id | STRING | |
| campaign_name | STRING | |
| channel | STRING | Derived: `search`, `pmax`, `display`, `video`, `social`, `other` |
| currency | STRING | |
| spend | NUMERIC | |
| impressions | INT64 | |
| clicks | INT64 | Google clicks; Meta **link clicks** (see §7) |
| conversions | FLOAT64 | Mapped primary conversions |
| leads | FLOAT64 | Sum of actions where `counts_as_lead` |
| calls | FLOAT64 | category=`call` |
| forms | FLOAT64 | category=`form` |
| conversion_value | NUMERIC | |
| synced_at | TIMESTAMP | |

PK: (`date`,`platform`,`account_id`,`campaign_id`). Partition `date`, cluster (`client_id`,`platform`). Derived ratios (CPL, CTR…) live in **views only** so they're always computed from re-aggregated sums, never averaged.

### 6.7 `ops.data_sync_logs`

| Column | Type | Description |
|---|---|---|
| sync_id | STRING | UUID per (run, account, entity) |
| run_id | STRING | UUID per scheduler run |
| started_at / finished_at | TIMESTAMP | |
| platform | STRING | |
| account_id | STRING | |
| entity | STRING | e.g. `campaign_daily`, `search_terms_daily` |
| window_start / window_end | DATE | Requested window |
| status | STRING | `success` / `failed` / `partial` |
| rows_written | INT64 | |
| rows_rejected | INT64 | Failed validation |
| error_message | STRING | Truncated exception text |

PK: `sync_id`. Partition by `DATE(started_at)`.

### 6.8 `ops.api_credentials_metadata`

**No secret values ever.** Columns: `credential_id STRING` (PK), `platform STRING`, `credential_type STRING` (`oauth_refresh_token` / `system_user_token` / `developer_token`), `secret_location STRING` (e.g. `github_actions:META_ACCESS_TOKEN`), `scopes STRING`, `expires_at TIMESTAMP (nullable)`, `last_validated_at TIMESTAMP`, `last_error STRING`, `notes STRING`.

### 6.9 `ops.qa_alerts`

| Column | Type | Description |
|---|---|---|
| alert_id | STRING | UUID |
| detected_at | TIMESTAMP | |
| alert_date | DATE | Stat date the condition refers to |
| client_id / platform / account_id | STRING | Scope (nullable below client) |
| campaign_id / campaign_name | STRING | Nullable |
| alert_type | STRING | e.g. `spend_no_conversions`, `cpl_spike` |
| severity | STRING | `info` / `warning` / `critical` |
| metric_value / threshold_value | FLOAT64 | What fired vs. limit |
| message | STRING | Human-readable |
| status | STRING | `open` / `acknowledged` / `resolved` |

PK: `alert_id`. Unique-ish contract: one open alert per (`alert_type`,`account_id`,`campaign_id`,`alert_date`) — checker skips duplicates. Partition by `alert_date`.

### 6.10 `dash.client_summary` (view, not table)

`dashboard_client_summary` is a **view** over `normalized_daily_performance` joined to `clients`: date, client, platform totals + computed CTR/CPC/CPM/CPL/CPA/conv-rate. Materialize later only if Looker Studio gets slow (it won't at this volume).

---

## 7. Metric Definitions

All ratio metrics are computed **after aggregation** (`SUM(cost)/SUM(clicks)`, never `AVG(cpc)`).

| Metric | Definition | Notes |
|---|---|---|
| Spend | Google `metrics.cost_micros / 1e6`; Meta `spend` | Account currency |
| Impressions | Platform impressions | |
| Clicks | Google `metrics.clicks`; Meta **`inline_link_clicks`** | Meta's default "clicks (all)" counts likes/expands; link clicks are the comparable number. Store both in raw; normalize to link clicks. |
| CTR | clicks / impressions | Meta CTR = link CTR by the same choice |
| CPC | spend / clicks | Null when clicks=0 |
| CPM | spend / impressions × 1000 | |
| Conversions | Google `metrics.conversions` (primary, fractional); Meta: sum of mapped action types | |
| Leads | Sum of conversions where `conversion_action_map.counts_as_lead` | The headline metric |
| Calls | category=`call` (Google call conversions / Meta click-to-call & call confirms) | Platform call tracking only — CallRail later |
| Forms | category=`form` (form submits / Meta lead-form + pixel lead) | |
| CPL | spend / leads | Null when leads=0 (never 0) |
| Conversion rate | conversions / clicks | Link-click based on Meta |
| Cost per conversion (CPA) | spend / conversions | |
| ROAS | conversion_value / spend | Only shown if the account tracks value; hidden for lead-gen clients like Doyle Salewski |

**Attribution caveats (put these in client-facing footnotes):**

- **Numbers move after the fact.** Google attributes conversions to the **click date**, so yesterday's conversions keep rising for days (30-day repull handles this). Meta restates too, and view-through conversions arrive late.
- **Google vs Meta will never tie to GA4 or to each other.** Google default: data-driven attribution, click-date reporting. Meta default: 7-day click + 1-day view, impression/click-date reporting, with modeled/estimated conversions post-iOS14. Both self-attribute the same real-world lead if the user touched both.
- **Meta "leads" can include modeled values**; small accounts see fractional or delayed counts.
- **Fractional conversions are normal** on Google (data-driven attribution splits credit). Don't round in storage; round only in display.
- Recommendation: dashboards report **platform-reported conversions clearly labeled per platform**, and never sum Google + Meta leads into one number without a "platform-attributed, may overlap" footnote.

---

## 8. API Strategy

### Google Ads API

- **Access chain:** Google Ads **Manager account (MCC)** linking every client account → **developer token** (from MCC API Center; Basic access application required — apply early, takes days) → **GCP OAuth client** (Web/Desktop app) → one-time OAuth consent as an MCC-admin user → long-lived **refresh token**.
- **Credentials needed:** `developer_token`, `client_id`, `client_secret`, `refresh_token`, `login_customer_id` (MCC CID). All in scheduler secrets; SDK auto-refreshes access tokens.
- **Querying:** GAQL via `GoogleAdsService.SearchStream` (streaming — no manual pagination). One query per entity per account per window, e.g. `SELECT segments.date, campaign.id, ... FROM campaign WHERE segments.date BETWEEN '{start}' AND '{end}'`. Conversion-action table uses `segments.conversion_action` on the campaign resource.
- **Read-only:** we only call search/reporting services. Recommended scope is the standard `adwords` scope; read-only is enforced by our code (no mutate imports) and by CI grep for mutate service usage.
- **Rate limits:** generous for reporting at this account count; SDK retries transient errors; we add exponential backoff on `RESOURCE_EXHAUSTED`.

### Meta Marketing API

- **Access chain:** Meta **developer app** (Business type) owned by your Business Manager → app added to BM → **system user** in BM with access to each client ad account (Analyst/read role) → generate **system-user access token** scoped **`ads_read`** (+ `business_management` for account listing). System-user tokens don't expire, but treat them as rotatable (§ Step 3).
- **Credentials needed:** `app_id`, `app_secret` (for appsecret_proof), `system_user_access_token`, list of `act_<id>` account ids (kept in `platform_accounts`, not in secrets).
- **Querying:** `/{act_id}/insights` with `level=campaign|adset|ad`, `time_range` + `time_increment=1` (daily rows), fields: `spend, impressions, clicks, inline_link_clicks, reach, frequency, actions, action_values, campaign_id, campaign_name, ...`. Use cursor pagination (`paging.next`); for large pulls, async insights jobs (`POST` then poll) to avoid timeout errors.
- **Rate limits:** BM/ad-account-level throttling via `x-business-use-case-usage` header — read it, sleep when near cap. Insights calls are the most throttled thing we do; per-account serial pulls with modest concurrency are fine at this scale.

---

## 9. Refresh Strategy

- **Cadence:** daily at 09:00 UTC (~04:00 Toronto = after both platforms have materialized yesterday). A second optional midday run costs nothing and freshens intraday if wanted later.
- **Window:** rolling **30 days** (`today-30 → today-1`), both platforms. Covers Google's 30-day click-attribution tail and Meta restatements. Yesterday's data is always partially immature — the window makes it converge.
- **Duplicate prevention:** every write is `DELETE FROM t WHERE account_id=X AND date BETWEEN a AND b` then `INSERT` fresh rows, in that order, per entity table. Fully idempotent: re-running a failed job is always safe. (BigQuery DML on partitioned tables makes the delete cheap.)
- **Late conversions:** handled automatically by the window. Data older than 30 days is treated as frozen.
- **Failed syncs:** each (account, entity) is an independent unit — one client's expired token doesn't block others. Failures are logged `status='failed'` with the error; the run exits non-zero if any unit failed (GitHub Actions shows red); re-running the whole job is safe due to idempotency. No partial-window writes: delete+insert happens only after the full window's rows are fetched and validated.
- **Backfill:** same code path with `--start/--end` flags, chunked into ≤31-day windows executed sequentially (oldest first). Search terms backfill is the slow one; run it per-account. Recommend 90 days at launch for Doyle Salewski, 12 months later if needed.

---

## 10. Error Handling & Logging

- **Structured logs:** JSON lines to stdout (`run_id`, `account_id`, `entity`, `event`, `level`) — readable in Actions, machine-parseable in Cloud Logging later. Summary row per unit into `ops.data_sync_logs`.
- **Retry policy:** exponential backoff + jitter, max 4 tries, on: HTTP 5xx, timeouts, Google `INTERNAL`/`RESOURCE_EXHAUSTED`, Meta codes 1/2/4/17/32/613 (transient + throttle). **No retry** on auth errors (Google `AUTHENTICATION_ERROR`/`AUTHORIZATION_ERROR`, Meta 190) — fail the unit, log `token_error`, and write `last_error` to `api_credentials_metadata` so it's visible.
- **Rate limits:** honor `retry-after` where given; Meta: watch usage headers and pre-emptively sleep at >85%.
- **Partial failures:** unit isolation (above). Exit code reflects worst status.
- **Schema changes:** connectors select **explicit field lists** (never `*`); unknown/new fields on Meta land in `raw_actions_json` anyway; a removed field raises a clear error naming the field. Pin API versions (`google-ads` vN, Graph vX.Y) and upgrade deliberately.
- **Missing accounts / permission changes:** account fetch failing with a permission error → `status='failed'`, alert type `account_access_lost`, and the account is *not* auto-deactivated (human decides).
- **Zero-row weirdness:** a previously-spending account returning 0 rows for yesterday logs `success` but triggers the `no_recent_data` QA check — silence is a signal.

---

## 11. QA Alert Ideas (MVP: first 5; rest later)

| # | Alert | Logic sketch | Severity |
|---|---|---|---|
| 1 | **Spend, zero conversions** | Campaign spend ≥ $150 (configurable/client) over trailing 3 days with 0 leads | warning |
| 2 | **CPL spike** | Trailing-3-day CPL > 2× trailing-28-day CPL, min 3 leads baseline | warning |
| 3 | **Campaign stopped spending** | Campaign averaged > $20/day over prior 7 days, spent $0 yesterday, status still active | warning |
| 4 | **No recent data pulled** | Active account with no successful sync in 36h, or 0 rows for an account that spent in prior 7 days | critical |
| 5 | **Unmapped conversion action** | ETL saw a conversion action/action_type absent from `conversion_action_map` | info |
| 6 | Spend up, conversions down | WoW spend +30% and leads −30% at account level | warning (later) |
| 7 | High-spend search term, no leads | Search term ≥ $75 in 14 days, 0 conversions, not excluded | info (later) |
| 8 | Meta frequency too high | Ad set frequency > 4 over trailing 7 days | info (later) |
| 9 | Tracking outage | Account leads = 0 for 3 consecutive days with spend > $100/day, where baseline had daily leads | critical (later) |
| 10 | No calls on call campaign | Call-focused campaign (tagged) with 7 days spend and 0 call conversions | warning (later) |

Landing-page checks (HTTP 200 pings on final URLs) are cheap and valuable but out of MVP.

---

## 12. Implementation Roadmap

| Milestone | Deliverable | Effort |
|---|---|---|
| M0 Environment | Repo layout, pyproject, Dockerfile, BigQuery project/datasets, service account, GitHub secrets scaffolding | 0.5 day |
| M1 Auth | Google refresh-token generation script; Meta system-user token; smoke-test scripts (`check_google.py`, `check_meta.py`) | 0.5–1 day (+ days of waiting on Google dev-token approval — **apply first**) |
| M2 Schema | All DDL in `sql/ddl/`, `create_all.py`, seed `clients`/`platform_accounts`/`conversion_action_map` for Doyle Salewski | 0.5 day |
| M3 Google connector | 5 GAQL pulls → validated rows → delete+insert loaders + sync logs | 1.5 days |
| M4 Meta connector | 3 insights pulls incl. actions mapping → loaders + sync logs | 1.5 days |
| M5 Normalization | `normalized_daily_performance` rebuild + channel derivation | 0.5 day |
| M6 Views | `dash.*` views (client summary, campaign, platform comparison, keywords, search terms, meta ads, conversion actions) | 0.5 day |
| M7 QA checks | Alerts 1–5 as SQL + writer | 0.5 day |
| M8 Scheduler | GitHub Actions workflow (daily cron + manual dispatch w/ backfill inputs) | 0.5 day |
| M9 Testing | Unit tests (mapping, metrics, windows, dedupe) + reconciliation vs platform UI for Doyle Salewski | 1 day |
| M10 Dashboard + docs | Looker Studio template on views; README + runbook | 1 day |

~8–9 focused build days; calendar time dominated by Google developer-token approval and Meta app/BM setup.

## 13. Risks & Tradeoffs (blunt)

- **Google developer token approval is the #1 schedule risk.** Basic access requires an application with a use-case description. Apply on day 1. Test-token mode only reads test accounts — useless for real data.
- **The conversion_action_map is manual curation and it is load-bearing.** If a client adds a new conversion action and nobody maps it, "Leads" silently understates until the unmapped-action alert is seen. This is a process risk, not a code risk — the alert mitigates but doesn't eliminate it.
- **Meta insights quirks:** attribution restatements, modeled conversions, breakdown-vs-total mismatches, occasional async-job flakiness, and throttling that appears only when you add accounts. Retry + async jobs + 30-day window keep it manageable, not perfect.
- **Numbers won't match the platform UI to the penny** on recent dates (attribution lag) and won't match GA4 ever. Set client expectations in writing; the QA reconciliation test defines "close enough" (±1–2% on mature dates).
- **Search terms volume** can be large for big accounts; low-volume-term omission means totals won't reconcile to campaign spend — by design, document it.
- **GitHub Actions** limits: 90-day log retention, secrets are repo-scoped, cron can start minutes late. All acceptable for MVP; Cloud Run Jobs is the escape hatch already containerized for.
- **Looker Studio** can get slow with bad data models; mitigated by views over a partitioned normalized table, plus BI Engine later if needed.
- **Single-maintainer risk:** you. The runbook + handoff doc in Step 3 is the mitigation.

## 14. Final Recommendation — smartest MVP path

1. **Today:** apply for the Google Ads developer token (Basic access) and create the Meta app + system user. These are the long poles.
2. While waiting: build M0/M2 (repo, BigQuery datasets, full DDL, Doyle Salewski seeds) and the Meta connector (Meta access is fast to get).
3. Then the Google connector, normalization, views, five alerts, GitHub Actions cron.
4. Launch with **Doyle Salewski only**, 90-day backfill, and run a reconciliation week: compare dashboard vs platform UI daily before showing a client anything.
5. Add the second client by inserting rows in `clients`/`platform_accounts`/`conversion_action_map` — zero code changes. That's the test that the multi-client design worked.
6. Resist the temptation to add breakdowns/pacing/Slack until the daily pipeline has run clean for two weeks.

---
---

# UPDATED STEP 2 PROMPT

The fully revised Step 2 prompt — incorporating every decision above — is saved as
**`marketing-connector/docs/STEP2_PROMPT.md`**. Review this document, then paste that
prompt to begin Step 2.
