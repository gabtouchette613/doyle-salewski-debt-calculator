# STEP 2 PROMPT — paste this after reviewing Step 1

You are acting as the lead developer and data engineer. Step 1 (architecture) is complete
and approved — see `marketing-connector/docs/STEP1_ARCHITECTURE.md` in this repo. Do not
re-litigate architecture decisions; build to them exactly.

## Locked decisions from Step 1

- **Language:** Python 3.11+, official SDKs: `google-ads`, `facebook-business`, `google-cloud-bigquery`.
- **Storage:** BigQuery. Datasets: `raw` (platform tables), `core` (mapping + normalized), `ops` (logs/alerts/credential metadata), `dash` (views only).
- **Scheduler:** GitHub Actions daily cron at 09:00 UTC with `workflow_dispatch` inputs for manual runs and backfills (`start_date`, `end_date`, `platform`, `client_id`). Include a Dockerfile so the same image can later run as a Cloud Run Job without code changes.
- **Secrets:** GitHub Actions secrets for MVP: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `GCP_SERVICE_ACCOUNT_JSON` (BigQuery writer), `BQ_PROJECT_ID`. No secrets in BigQuery — only metadata in `ops.api_credentials_metadata`.
- **Read-only guarantee:** never import or call any mutate/write endpoint on either ads platform. Meta token scope is `ads_read`. Add a test that greps the codebase for mutate service usage.
- **Refresh strategy:** daily rolling window `today-30 → today-1` in the ad account's timezone. Idempotent writes: per (account, entity, window) do `DELETE ... WHERE account_id = X AND date BETWEEN a AND b` then `INSERT` — never write a partial window; fetch and validate all rows first.
- **Unit isolation:** each (account, entity) pull is independent; one failure never blocks others; every unit writes a row to `ops.data_sync_logs` (run_id, sync_id, window, status success/failed/partial, rows_written, rows_rejected, error_message); the process exits non-zero if any unit failed.
- **Schema:** implement exactly the tables from Step 1 §6 —
  `core.clients`, `core.platform_accounts` (account_key = `{platform}:{account_id}`, google `login_customer_id` column), `core.conversion_action_map` (platform, account_id, source_key, source_name, category ∈ lead/call/form/purchase/other, counts_as_lead, is_primary),
  `raw.google_ads_campaign_daily`, `raw.google_ads_ad_group_daily`, `raw.google_ads_keyword_daily`, `raw.google_ads_search_terms_daily`, `raw.google_ads_conversion_action_daily`,
  `raw.meta_campaign_daily`, `raw.meta_adset_daily`, `raw.meta_ad_daily` (each with leads/calls/forms/purchases derived via conversion_action_map at load time PLUS untouched `raw_actions_json`),
  `core.normalized_daily_performance` (campaign grain; channel derived: search/pmax/display/video/social/other; ratio metrics live in views only),
  `ops.data_sync_logs`, `ops.api_credentials_metadata`, `ops.qa_alerts`.
  All daily tables: partition by `date`, cluster by `account_id` + entity id. Money as NUMERIC (convert Google micros/1e6). Google conversions are FLOAT64 (fractional is normal). Dates are platform stat dates in account timezone. Every raw row carries `synced_at`.
- **Metric normalization:** Meta clicks in normalized table = `inline_link_clicks` (store both raw). Ratios (CTR/CPC/CPM/CPL/CPA/conv-rate) computed only in views from re-aggregated sums. CPL is NULL when leads = 0, never 0.
- **Google Ads querying:** GAQL via `SearchStream`, explicit field lists (never select-all), one query per entity per account per window. Conversion-action table = campaign stats segmented by `segments.conversion_action`.
- **Meta querying:** `/{act_id}/insights` with `level=campaign|adset|ad`, `time_increment=1`, cursor pagination; use async insights jobs for windows > 30 days or on timeout; honor `x-business-use-case-usage` (sleep at >85%); send `appsecret_proof`.
- **Unmapped conversion actions:** auto-insert into `conversion_action_map` with `category='other'`, `counts_as_lead=false`, and raise an `unmapped_conversion_action` QA alert (info). Never silently drop actions.
- **Retry policy:** exponential backoff + jitter, max 4 attempts, on HTTP 5xx/timeouts, Google INTERNAL/RESOURCE_EXHAUSTED, Meta transient codes (1, 2, 4, 17, 32, 613). No retry on auth errors (Meta 190, Google AUTHENTICATION/AUTHORIZATION errors) — fail the unit and update `ops.api_credentials_metadata.last_error`.
- **Logging:** JSON lines to stdout with run_id/account_id/entity/event/level.
- **MVP QA alerts (SQL, post-ETL, write to `ops.qa_alerts`, dedupe on open alert per alert_type+account+campaign+alert_date):**
  1. spend ≥ threshold (default $150, per-client configurable) over trailing 3 days with 0 leads;
  2. CPL spike: trailing-3-day CPL > 2× trailing-28-day CPL (min 3 baseline leads);
  3. campaign stopped spending: >$20/day prior 7 days, $0 yesterday, still active;
  4. no recent data: active account with no successful sync in 36h or 0 rows despite prior-7-day spend;
  5. unmapped conversion action (from ETL).
- **Seed data:** first client is `doyle_salewski` ("Doyle Salewski", currency CAD, timezone America/Toronto, vertical insolvency — lead gen via forms + calls, no ROAS). Seed `clients`, placeholder rows for its Google Ads + Meta accounts in `platform_accounts` (account IDs marked TODO), and example `conversion_action_map` rows (Google: form submit + call conversions; Meta: `lead`, `onsite_conversion.lead_grouped`, `offsite_conversion.fb_pixel_lead`, `click_to_call_call_confirm`).
- **Repo location:** everything under `marketing-connector/` in this repository (the rest of the repo is an unrelated WordPress plugin — don't touch it).

## Deliverables for Step 2

Produce the actual build artifacts, committed to the repo:

1. **Project structure** under `marketing-connector/`: `connectors/` (google_ads, meta), `auth/` (token generation helper scripts + smoke tests `check_google.py`, `check_meta.py`), `sql/ddl/`, `sql/views/`, `sql/alerts/`, `models/` (dataclasses / field maps), `jobs/` (main scheduled entrypoint, backfill), `config/` (client/account config loading), `tests/`, `docs/`, plus `pyproject.toml`, `Dockerfile`, `.env.example`, `README.md`, and `.github/workflows/etl.yml`.
2. **Environment variables** — full list wired through a single typed config module; `.env.example` documenting each.
3. **Google Ads connector** — auth from env, the 5 GAQL queries, SearchStream handling, micros conversion, row validation, delete+insert loader, sync logging.
4. **Meta connector** — auth from env, 3 insights pulls, pagination + async job fallback, actions→lead/call/form mapping via `conversion_action_map`, `raw_actions_json` preservation, loader, sync logging.
5. **Database SQL** — DDL for every table (partitioning/clustering as specified), a `create_all` runner, and seed SQL/script for Doyle Salewski.
6. **ETL logic** — window computation (account-timezone aware), normalization rebuild of `core.normalized_daily_performance` from raw for the synced window, channel derivation, client/account mapping join.
7. **Dashboard views** in `dash`: client_summary, campaign_performance, platform_comparison, google_search_terms, keyword_performance, meta_ad_performance, conversion_actions. (Pacing view deferred — no budget table yet.)
8. **QA alert SQL + runner** for the 5 MVP alerts.
9. **Scheduler job** — `jobs/run_daily.py`: load active accounts from `core.platform_accounts`, run Google units then Meta units, rebuild normalized window, run alerts, write logs, exit non-zero on any unit failure. GitHub Actions workflow with daily cron + manual dispatch backfill inputs.
10. **Tests** (pytest, no network): field mapping, metric calc edge cases (zero denominators, fractional conversions), date-window generation incl. timezone, dedupe/idempotency of the delete+insert builder, failed-API-response handling, Meta actions parsing, normalized schema output, and the no-mutate-imports guard test.
11. **Local dev instructions** (README): venv, .env, create datasets/tables, run one account one day, run tests.
12. **Deployment instructions**: GitHub secrets to set, first backfill procedure (90 days, chunked ≤31 days), how to promote to Cloud Run Jobs later.
13. **Known gaps** list: what still requires real credentials, Google developer-token approval status, Meta app review needs, real account IDs for Doyle Salewski, and anything untestable without live API access.

Write real, runnable code — not pseudocode — except where live credentials are strictly required; mark those points clearly with `TODO(credentials)`. Keep modules small and platform connectors fully independent.

## At the end

Generate the fully revised **Step 3 prompt** (save to `marketing-connector/docs/STEP3_PROMPT.md`) incorporating everything built or discovered in Step 2 — actual file paths, actual env var names, actual view names, known gaps — so Step 3 (hardening, deployment, QA, dashboard design, operating playbook) can be executed against the real codebase. Do not begin Step 3.
