# Known Gaps — what still needs real credentials, access, or live testing

Everything below is blocked on manual setup or platform approval, not on code.

## Blocked on access/approvals

1. **Google Ads developer token (Basic access)** — must be applied for from the
   MCC API Center; approval takes days. Until then the Google connector cannot
   run against production accounts at all. *This is the critical path.*
2. **Google OAuth client + refresh token** — create the OAuth client in GCP,
   then run `python -m pipeline.auth.generate_google_refresh_token` as an MCC
   admin and store the token as a secret.
3. **Meta developer app + Business Manager system user** — create the app
   (Business type), attach it to the BM, create a system user with Analyst
   access to the Doyle Salewski ad account, and generate an `ads_read` token.
   Standard access to the Marketing API is usually sufficient for own/BM-linked
   ad accounts; no App Review needed while the app stays in this BM.
4. **GCP project + service account** — create project, enable BigQuery, create
   a service account with BigQuery Data Editor + Job User, download the key.

## Placeholders in seed data (sql/seeds/doyle_salewski.sql)

- `TODO_GOOGLE_CID` — Doyle Salewski Google Ads customer id (digits only).
- `TODO_MCC_CID` — your manager account id.
- `TODO_META_ACCOUNT_ID` — Doyle Salewski Meta ad account id (no `act_` prefix),
  also referenced by the seeded `conversion_action_map` rows.
- Both `platform_accounts` rows are seeded `status='paused'`; flip to
  `'active'` once ids and credentials are real.
- Google conversion-action mappings are **not** seeded (ids are per-account);
  after the first sync, recategorize the auto-inserted `category='other'` rows
  (form submits → `form`, call conversions → `call`, both `counts_as_lead=true`).

## Untestable without live API access

- Real GAQL responses: field availability (`metrics.historical_quality_score`
  nullability on keyword_view), enum spellings, and PMAX behavior in the
  search-terms report. Transforms are unit-tested against simulated rows only.
- Meta insights quirks: pagination volume, async-job latency, throttling
  headers (`x-business-use-case-usage` pre-emptive sleep is NOT yet
  implemented — the retry/backoff handles code 17/32/613 reactively).
- BigQuery DML/scripts (`rebuild_normalized.sql`, alert SQL, seed MERGEs) are
  syntax-reviewed but have not executed against a live dataset.
- End-to-end reconciliation vs the platform UIs (the Step 3 QA plan).

## Deliberate deferrals (from Step 1 future scope)

- Budget pacing (needs a `client_budgets` table), alert delivery via
  email/Slack (alerts only land in `ops.qa_alerts` + job logs today),
  geo/device/landing-page breakdowns, creative-fatigue view, per-client
  alert-threshold overrides (thresholds are global env vars for now).
