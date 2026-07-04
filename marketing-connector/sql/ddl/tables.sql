-- Reference DDL, generated from pipeline/models/schemas.py (the source of
-- truth used by the loaders). Regenerate with:
--   python -m pipeline.jobs.create_all --print
-- Placeholders: YOUR_PROJECT and the default dataset names raw/core/ops.

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.core.clients` (
  client_id STRING,
  client_name STRING,
  status STRING,
  currency STRING,
  timezone STRING,
  vertical STRING,
  created_at TIMESTAMP,
  notes STRING
);

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.core.platform_accounts` (
  account_key STRING,
  client_id STRING,
  platform STRING,
  account_id STRING,
  account_name STRING,
  currency STRING,
  timezone STRING,
  status STRING,
  login_customer_id STRING,
  created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.core.conversion_action_map` (
  platform STRING,
  account_id STRING,
  source_key STRING,
  source_name STRING,
  category STRING,
  counts_as_lead BOOL,
  is_primary BOOL,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.google_ads_campaign_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  campaign_status STRING,
  advertising_channel_type STRING,
  budget_amount NUMERIC,
  impressions INT64,
  clicks INT64,
  cost NUMERIC,
  conversions FLOAT64,
  conversion_value NUMERIC,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, campaign_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.google_ads_ad_group_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  ad_group_id STRING,
  ad_group_name STRING,
  ad_group_status STRING,
  impressions INT64,
  clicks INT64,
  cost NUMERIC,
  conversions FLOAT64,
  conversion_value NUMERIC,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, ad_group_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.google_ads_keyword_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  ad_group_id STRING,
  ad_group_name STRING,
  criterion_id STRING,
  keyword_text STRING,
  match_type STRING,
  keyword_status STRING,
  quality_score INT64,
  impressions INT64,
  clicks INT64,
  cost NUMERIC,
  conversions FLOAT64,
  conversion_value NUMERIC,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, ad_group_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.google_ads_search_terms_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  ad_group_id STRING,
  ad_group_name STRING,
  search_term STRING,
  search_term_match_type STRING,
  search_term_status STRING,
  impressions INT64,
  clicks INT64,
  cost NUMERIC,
  conversions FLOAT64,
  conversion_value NUMERIC,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, ad_group_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.google_ads_conversion_action_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  conversion_action_id STRING,
  conversion_action_name STRING,
  conversion_action_category STRING,
  conversions FLOAT64,
  conversion_value NUMERIC,
  all_conversions FLOAT64,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, campaign_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.meta_campaign_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  campaign_status STRING,
  objective STRING,
  daily_budget NUMERIC,
  spend NUMERIC,
  impressions INT64,
  clicks INT64,
  link_clicks INT64,
  reach INT64,
  frequency FLOAT64,
  conversions FLOAT64,
  leads FLOAT64,
  calls FLOAT64,
  forms FLOAT64,
  purchases FLOAT64,
  conversion_value NUMERIC,
  raw_actions_json JSON,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, campaign_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.meta_adset_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  adset_id STRING,
  adset_name STRING,
  adset_status STRING,
  daily_budget NUMERIC,
  spend NUMERIC,
  impressions INT64,
  clicks INT64,
  link_clicks INT64,
  reach INT64,
  frequency FLOAT64,
  conversions FLOAT64,
  leads FLOAT64,
  calls FLOAT64,
  forms FLOAT64,
  purchases FLOAT64,
  conversion_value NUMERIC,
  raw_actions_json JSON,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, adset_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.raw.meta_ad_daily` (
  date DATE,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  adset_id STRING,
  adset_name STRING,
  ad_id STRING,
  ad_name STRING,
  ad_status STRING,
  creative_id STRING,
  spend NUMERIC,
  impressions INT64,
  clicks INT64,
  link_clicks INT64,
  reach INT64,
  frequency FLOAT64,
  conversions FLOAT64,
  leads FLOAT64,
  calls FLOAT64,
  forms FLOAT64,
  purchases FLOAT64,
  conversion_value NUMERIC,
  raw_actions_json JSON,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY account_id, ad_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.core.normalized_daily_performance` (
  date DATE,
  client_id STRING,
  platform STRING,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  channel STRING,
  currency STRING,
  spend NUMERIC,
  impressions INT64,
  clicks INT64,
  conversions FLOAT64,
  leads FLOAT64,
  calls FLOAT64,
  forms FLOAT64,
  conversion_value NUMERIC,
  synced_at TIMESTAMP
)
PARTITION BY date
CLUSTER BY client_id, platform;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.ops.data_sync_logs` (
  sync_id STRING,
  run_id STRING,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  platform STRING,
  account_id STRING,
  entity STRING,
  window_start DATE,
  window_end DATE,
  status STRING,
  rows_written INT64,
  rows_rejected INT64,
  error_message STRING
)
PARTITION BY DATE(started_at);

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.ops.api_credentials_metadata` (
  credential_id STRING,
  platform STRING,
  credential_type STRING,
  secret_location STRING,
  scopes STRING,
  expires_at TIMESTAMP,
  last_validated_at TIMESTAMP,
  last_error STRING,
  notes STRING
);

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT.ops.qa_alerts` (
  alert_id STRING,
  detected_at TIMESTAMP,
  alert_date DATE,
  client_id STRING,
  platform STRING,
  account_id STRING,
  campaign_id STRING,
  campaign_name STRING,
  alert_type STRING,
  severity STRING,
  metric_value FLOAT64,
  threshold_value FLOAT64,
  message STRING,
  status STRING
)
PARTITION BY alert_date;
