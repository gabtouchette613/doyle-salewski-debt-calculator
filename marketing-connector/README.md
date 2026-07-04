# Marketing Dashboard Connector

Read-only reporting ETL: **Google Ads + Meta Marketing API → BigQuery → Looker Studio**, multi-client, daily rolling 30-day refresh. Architecture and all design decisions: [`docs/STEP1_ARCHITECTURE.md`](docs/STEP1_ARCHITECTURE.md).

**This system never writes to the ad platforms.** Only reporting endpoints are used; `tests/test_no_write_endpoints.py` enforces it.

## Layout

```
pipeline/
  config/       settings (env), JSON logging, paths
  models/       schemas.py — source of truth for every BigQuery table
  connectors/
    base.py     error taxonomy, retry, validation, SyncResult
    warehouse.py BigQuery: idempotent delete+insert window loads, logs, upserts
    google_ads/ client, GAQL queries, transforms, pull (5 entities)
    meta/       client, actions mapping, transforms, pull (3 levels)
  jobs/         run_daily (main entrypoint), backfill, create_all, windows, normalize
  alerts/       runner for the SQL QA checks
  auth/         refresh-token generator + credential smoke tests
sql/
  ddl/tables.sql        generated reference DDL
  etl/rebuild_normalized.sql
  views/*.sql           7 dashboard views (dataset: dash)
  alerts/*.sql          5 QA checks + unmapped-action merge
  seeds/doyle_salewski.sql
tests/          pytest, no network required
```

Datasets: `raw` (platform-native daily tables), `core` (clients, platform_accounts, conversion_action_map, normalized_daily_performance), `ops` (data_sync_logs, qa_alerts, api_credentials_metadata), `dash` (views only — point Looker Studio here).

## How a daily run works

1. Load active accounts from `core.platform_accounts` (client must be active too; `TODO` placeholder ids are skipped with a warning).
2. Per account: compute the rolling window `today-30 → yesterday` **in the account's timezone**; per entity: fetch → transform → validate/dedupe → `DELETE` that account+window slice → batch-load fresh rows. Each (account, entity) is isolated; every unit logs to `ops.data_sync_logs`.
3. Rebuild `core.normalized_daily_performance` from raw for the synced window (Google leads/calls/forms come from the conversion-action breakdown × `conversion_action_map`; Meta rows are mapped at load time; Meta clicks normalize to **link clicks**).
4. Run QA alerts into `ops.qa_alerts` (spend-no-conversions, CPL spike, campaign stopped spending, no recent data, unmapped conversion action).
5. Exit non-zero if any unit failed (the Actions run shows red). Re-running is always safe — every write is idempotent.

## Local development

```bash
cd marketing-connector
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env        # fill in what you have; BQ_PROJECT_ID is the only hard requirement
python -m pytest            # runs without any credentials or network

# One-time infrastructure (needs GOOGLE_APPLICATION_CREDENTIALS with BigQuery
# Data Editor + Job User on the project):
python -m pipeline.jobs.create_all --seed

# Smoke-test credentials as you get them:
python -m pipeline.auth.check_meta <meta_account_id>
python -m pipeline.auth.check_google <google_customer_id>

# After replacing the TODO account ids in core.platform_accounts and flipping
# status to 'active', pull one client for one platform:
python -m pipeline.jobs.run_daily --platform meta --client doyle_salewski
```

To add a client: insert rows into `core.clients`, `core.platform_accounts`, and `core.conversion_action_map`. No code changes.

## Deployment (GitHub Actions)

Workflow: [`.github/workflows/marketing-etl.yml`](../.github/workflows/marketing-etl.yml) — daily 09:00 UTC cron + manual dispatch with backfill inputs.

Repository secrets to set (Settings → Secrets and variables → Actions):

| Secret | Contents |
|---|---|
| `GCP_SERVICE_ACCOUNT_JSON` | Full JSON key of the BigQuery service account |
| `BQ_PROJECT_ID` | GCP project id |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | From MCC API Center (Basic access) |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth client |
| `GOOGLE_ADS_REFRESH_TOKEN` | From `pipeline/auth/generate_google_refresh_token.py` |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC id, digits only |
| `META_APP_ID` / `META_APP_SECRET` | Meta developer app |
| `META_ACCESS_TOKEN` | System-user token, `ads_read` scope |

**First backfill** (after the daily run has succeeded once): trigger the workflow manually with `start_date`/`end_date` covering ~90 days, one platform at a time. Windows are chunked to ≤31 days automatically; if a chunk fails, just re-run — idempotent writes make repeats safe.

**Promotion to Cloud Run Jobs later**: `docker build` this directory, push to Artifact Registry, create a Cloud Run Job with the same env vars (secrets via Secret Manager), trigger with Cloud Scheduler at `0 9 * * *`. No code changes — the Dockerfile entrypoint is already `python -m pipeline.jobs.run_daily`.

## Dashboards

Connect Looker Studio to the `dash` dataset only: `client_summary`, `campaign_performance`, `platform_comparison`, `google_search_terms`, `keyword_performance`, `meta_ad_performance`, `conversion_actions`. Ratio metrics are precomputed with SAFE_DIVIDE (CPL is NULL, never 0, on zero-lead days).

## Operational notes

- **Unmapped conversion actions are the thing to watch.** New platform conversion actions land as `category='other'`, `counts_as_lead=false` and fire an info alert. Until categorized in `core.conversion_action_map`, they are excluded from Leads/CPL. Review `ops.qa_alerts` after onboarding any account.
- Numbers for the most recent ~3 days will keep moving (attribution lag); the rolling window makes them converge. Don't reconcile against the platform UI until a date is ≥4–7 days old.
- Google search terms won't sum to campaign totals (low-volume terms are omitted by Google).
- What still needs real credentials/manual setup: [`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md).
