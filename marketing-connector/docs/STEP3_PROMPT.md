# STEP 3 PROMPT — paste this after reviewing the Step 2 build

You are acting as a senior DevOps engineer, analytics engineer, QA lead, and
marketing operations consultant. Steps 1 and 2 are complete: the architecture
is in `marketing-connector/docs/STEP1_ARCHITECTURE.md` and the full MVP
codebase is built and unit-tested (44 tests passing) under
`marketing-connector/`. Your job now is to turn that build into an
operationally usable internal reporting system. Do not rewrite the codebase;
work against what exists.

## The system as actually built (ground truth)

- **Entrypoints:** `python -m pipeline.jobs.run_daily` (daily + backfill via
  `--start/--end`, `--platform`, `--client`, `--lookback`, `--skip-alerts`),
  `pipeline.jobs.create_all` (`--seed`, `--print`), `pipeline.jobs.backfill`,
  `pipeline.auth.generate_google_refresh_token`, `pipeline.auth.check_google`,
  `pipeline.auth.check_meta`.
- **Scheduler:** `.github/workflows/marketing-etl.yml` — cron 09:00 UTC,
  manual dispatch inputs `start_date`, `end_date`, `platform`, `client_id`;
  runs pytest before the ETL; concurrency-guarded; exits red if any sync unit
  failed.
- **Secrets (GitHub Actions names):** `GCP_SERVICE_ACCOUNT_JSON`,
  `BQ_PROJECT_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
  `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `META_APP_ID`, `META_APP_SECRET`,
  `META_ACCESS_TOKEN`. Optional env: `BQ_LOCATION`, dataset name overrides,
  `DEFAULT_LOOKBACK_DAYS`, `ALERT_SPEND_NO_CONV_MIN`, `ALERT_CPL_SPIKE_MULT`,
  `ALERT_STOPPED_MIN_DAILY` (thresholds are global, not per-client — a known
  deferral).
- **BigQuery datasets/tables:** `raw` (google_ads_campaign_daily,
  google_ads_ad_group_daily, google_ads_keyword_daily,
  google_ads_search_terms_daily, google_ads_conversion_action_daily,
  meta_campaign_daily, meta_adset_daily, meta_ad_daily — all partitioned by
  date, clustered by account + entity id), `core` (clients, platform_accounts,
  conversion_action_map, normalized_daily_performance), `ops` (data_sync_logs,
  api_credentials_metadata, qa_alerts), `dash` views: `client_summary`,
  `campaign_performance`, `platform_comparison`, `google_search_terms`,
  `keyword_performance`, `meta_ad_performance`, `conversion_actions`.
- **Semantics to respect in all QA/dashboard work:** Meta clicks are
  normalized to link clicks; Google leads/calls/forms derive from
  `all_conversions` on the conversion-action breakdown joined to
  `conversion_action_map`; CPL is NULL when leads=0; fractional conversions
  are preserved; rolling 30-day delete+insert window per account; Meta raw
  actions preserved as JSON (`raw_actions_json`); unmapped conversion actions
  auto-insert as `category='other'` + info alert; ROAS is hidden for Doyle
  Salewski (no conversion value).
- **QA alerts implemented (in `ops.qa_alerts`):** `spend_no_conversions`
  (warning), `cpl_spike` (warning), `campaign_stopped_spending` (warning),
  `no_recent_data` (critical), `unmapped_conversion_action` (info). No
  delivery channel yet — they only land in the table and job logs.
- **Seed state:** client `doyle_salewski` seeded; both platform_accounts rows
  are `status='paused'` with `TODO_GOOGLE_CID` / `TODO_MCC_CID` /
  `TODO_META_ACCOUNT_ID` placeholders; Meta action mappings seeded for
  lead/lead_grouped/fb_pixel_lead/click_to_call; Google mappings arrive via
  auto-discovery and need manual recategorization after first sync.
- **Open gaps (docs/KNOWN_GAPS.md):** Google developer token approval pending;
  Meta app/system user not yet created; GCP project/service account not yet
  created; Meta usage-header pre-emptive throttling not implemented; all
  BigQuery SQL unexecuted against a live dataset; no reconciliation performed.

## Deliverables for Step 3

Write these as markdown docs under `marketing-connector/docs/` (one file per
numbered item unless noted), practical and specific to THIS build — refer to
the real table, view, env var, and command names above.

1. **`DEPLOYMENT_CHECKLIST.md`** — ordered checklist from zero to first green
   daily run: GCP project/BQ/service account, Google Ads API access chain,
   Meta app/BM/system user, all 10 GitHub secrets, `create_all --seed`,
   replacing seed placeholders, flipping accounts active, smoke tests, first
   manual workflow dispatch, first backfill.
2. **`SETUP_GOOGLE_ADS.md`** — step-by-step: MCC linking, developer token
   application (what to write in the use-case form), OAuth consent screen +
   client, minting the refresh token with the provided script, finding
   customer IDs, manager-client hierarchy, `check_google` test call,
   production-readiness checklist.
3. **`SETUP_META.md`** — step-by-step: developer app creation, BM attachment,
   system user + Analyst asset access, token generation and scoping
   (`ads_read`), token longevity/rotation, `check_meta` test call, the common
   permission failures ((#10, #200, #294, OAuth 190) and what each means).
4. **`SECRETS.md`** — storage locations (GitHub secrets now, Secret Manager on
   Cloud Run promotion), rotation procedures per credential, what
   `ops.api_credentials_metadata` tracks, incident steps for a leaked token.
5. **`BACKFILL_PLAN.md`** — exact dispatch commands for 30/90/365-day
   backfills, client-by-client and platform-by-platform sequencing, expected
   durations/quotas, failure recovery (idempotent re-runs), and how to verify
   completeness with `ops.data_sync_logs` row-count queries (write the SQL).
6. **`MONITORING.md`** — what to watch and the SQL for each: sync
   success/failure rates, stale data, row-count anomalies vs trailing average,
   credential expiry signals (`last_error`), schema-drift symptoms, plus how
   to read the GitHub Actions run history; recommend the cheapest alerting
   hookup (Actions failure email now, Slack webhook later).
7. **`QA_TESTING_PLAN.md`** — the reconciliation framework: dashboard vs
   platform UI totals (account/campaign level, spend and conversions), with
   tolerance rules (±1–2% on dates ≥7 days old; recent dates excluded and
   why), currency and timezone validation, attribution-window caveats,
   conversion-action mapping validation via the `conversion_actions` view,
   and edge-case tests (empty account, paused campaigns, renamed campaigns —
   note the raw tables keep the name per day, so renames show both).
8. **`DASHBOARD_DESIGN.md`** — page-by-page Looker Studio spec on the `dash`
   views: Executive Summary, Client Overview, Google Ads Performance, Meta
   Ads Performance, Cross-Platform Summary, Search Terms, Keywords,
   Ads/Creatives, Conversion Actions, QA Alerts (from `ops.qa_alerts` —
   internal page only), plus a Budget Pacing placeholder (flag that it needs
   the future `client_budgets` table). For each page: KPIs, charts, tables,
   filters, default date ranges, comparisons, and the decision it supports.
   Include client-facing conventions: hide platform jargon and `_id` fields,
   label leads as platform-attributed, never sum Google+Meta leads without a
   footnote, hide ROAS for lead-gen clients.
9. **`ALERT_PLAYBOOK.md`** — for each of the 5 implemented alert types:
   trigger logic (as built, with thresholds), severity, first-response steps,
   escalation, and how to acknowledge/resolve (UPDATE status in
   `ops.qa_alerts` — provide the SQL).
10. **`OPERATING_PLAYBOOK.md`** — weekly/monthly cadence: Monday QA pass
    (alerts + sync logs), midweek pacing eyeball, monthly report prep,
    search-term/negative review, creative-fatigue check via
    `meta_ad_performance` frequency, conversion-tracking review
    (`conversion_actions` view + unmapped alerts), plus data governance:
    naming conventions for clients/accounts, retention, access, privacy
    (no PII is stored — only aggregates).
11. **`LIMITATIONS.md`** — blunt: platform attribution differences, delayed
    conversions and the 30-day freeze horizon, modeled Meta metrics, search
    terms undersum, API version deprecations, no offline/CRM/CallRail data
    until integrated, single-maintainer risk.
12. **`HANDOFF.md`** — the one doc a new developer reads first: system map,
    where every decision lives, how to run/deploy/extend (add a client, add a
    metric, add an alert, add a platform), and the expansion roadmap in
    priority order (budget pacing → alert delivery → CallRail → GA4 → ...).

Finish with a **Final Build Summary** in chat: what is production-ready, what
requires manual setup, and the single next highest-value build.

Do not invent credentials or pretend API access exists. Where a step requires
an approval you can't verify, say so explicitly.
