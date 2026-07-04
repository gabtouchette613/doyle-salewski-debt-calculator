-- Seed: first client (Doyle Salewski) + account placeholders + starter
-- conversion-action mappings + credential metadata rows.
-- Idempotent (MERGE). Placeholders:
--   1. Replace TODO_GOOGLE_CID with the client's Google Ads customer id
--      (digits only) and TODO_MCC_CID with your manager account id.
--   2. Replace TODO_META_ACCOUNT_ID with the numeric Meta ad account id
--      (no act_ prefix) — including in conversion_action_map rows.
--   3. Flip platform_accounts.status from 'paused' to 'active' to start syncing.

MERGE `{project}.{core}.clients` t
USING (SELECT 'doyle_salewski' AS client_id) s
ON t.client_id = s.client_id
WHEN NOT MATCHED THEN INSERT
  (client_id, client_name, status, currency, timezone, vertical, created_at, notes)
VALUES
  ('doyle_salewski', 'Doyle Salewski', 'active', 'CAD', 'America/Toronto',
   'insolvency', CURRENT_TIMESTAMP(),
   'Lead gen via forms + calls. No conversion value tracking (hide ROAS).');

MERGE `{project}.{core}.platform_accounts` t
USING (
  SELECT 'google_ads:TODO_GOOGLE_CID' AS account_key, 'doyle_salewski' AS client_id,
         'google_ads' AS platform, 'TODO_GOOGLE_CID' AS account_id,
         'Doyle Salewski - Google Ads' AS account_name, 'CAD' AS currency,
         'America/Toronto' AS timezone, 'paused' AS status,
         'TODO_MCC_CID' AS login_customer_id
  UNION ALL
  SELECT 'meta:TODO_META_ACCOUNT_ID', 'doyle_salewski', 'meta', 'TODO_META_ACCOUNT_ID',
         'Doyle Salewski - Meta Ads', 'CAD', 'America/Toronto', 'paused', NULL
) s
ON t.account_key = s.account_key
WHEN NOT MATCHED THEN INSERT
  (account_key, client_id, platform, account_id, account_name, currency,
   timezone, status, login_customer_id, created_at)
VALUES
  (s.account_key, s.client_id, s.platform, s.account_id, s.account_name,
   s.currency, s.timezone, s.status, s.login_customer_id, CURRENT_TIMESTAMP());

-- Meta action types typical for a form+call lead-gen account. Google rows are
-- auto-discovered from the API and land as category='other' — recategorize
-- them after the first sync (see docs/KNOWN_GAPS.md).
MERGE `{project}.{core}.conversion_action_map` t
USING (
  SELECT 'meta' AS platform, 'TODO_META_ACCOUNT_ID' AS account_id,
         'lead' AS source_key, 'Leads (grouped)' AS source_name,
         'lead' AS category, TRUE AS counts_as_lead
  UNION ALL
  SELECT 'meta', 'TODO_META_ACCOUNT_ID', 'onsite_conversion.lead_grouped',
         'On-Facebook leads', 'form', TRUE
  UNION ALL
  SELECT 'meta', 'TODO_META_ACCOUNT_ID', 'offsite_conversion.fb_pixel_lead',
         'Website leads (pixel)', 'form', TRUE
  UNION ALL
  SELECT 'meta', 'TODO_META_ACCOUNT_ID', 'click_to_call_call_confirm',
         'Click-to-call confirmed', 'call', TRUE
) s
ON t.platform = s.platform AND t.account_id = s.account_id AND t.source_key = s.source_key
WHEN NOT MATCHED THEN INSERT
  (platform, account_id, source_key, source_name, category, counts_as_lead,
   is_primary, updated_at)
VALUES
  (s.platform, s.account_id, s.source_key, s.source_name, s.category,
   s.counts_as_lead, FALSE, CURRENT_TIMESTAMP());

-- Credential metadata (no secret values — locations only).
MERGE `{project}.{ops}.api_credentials_metadata` t
USING (
  SELECT 'google_ads_oauth' AS credential_id, 'google_ads' AS platform,
         'oauth_refresh_token' AS credential_type,
         'github_actions:GOOGLE_ADS_REFRESH_TOKEN (+ developer token, client id/secret)' AS secret_location,
         'https://www.googleapis.com/auth/adwords' AS scopes,
         'Mint via pipeline/auth/generate_google_refresh_token.py as an MCC admin.' AS notes
  UNION ALL
  SELECT 'meta_system_user', 'meta', 'system_user_token',
         'github_actions:META_ACCESS_TOKEN (+ app id/secret)',
         'ads_read,business_management',
         'BM system user token; does not expire but rotate on staff changes.'
) s
ON t.credential_id = s.credential_id
WHEN NOT MATCHED THEN INSERT
  (credential_id, platform, credential_type, secret_location, scopes,
   expires_at, last_validated_at, last_error, notes)
VALUES
  (s.credential_id, s.platform, s.credential_type, s.secret_location, s.scopes,
   NULL, NULL, NULL, s.notes);
