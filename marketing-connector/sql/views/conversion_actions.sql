-- Per-conversion-action performance, both platforms in one shape.
-- Google side: the conversion-action breakdown table (all_conversions included
-- so secondary actions are visible). Meta side: unnested from the preserved
-- raw actions JSON so every action type appears even if unmapped.
CREATE OR REPLACE VIEW `{project}.{dash}.conversion_actions` AS
SELECT
  d.date,
  pa.client_id,
  c.client_name,
  'google_ads' AS platform,
  d.account_id,
  d.campaign_id,
  d.campaign_name,
  d.conversion_action_name AS action_name,
  d.conversion_action_id AS action_key,
  COALESCE(m.category, 'unmapped') AS category,
  COALESCE(m.counts_as_lead, FALSE) AS counts_as_lead,
  d.conversions,
  d.all_conversions,
  CAST(d.conversion_value AS FLOAT64) AS conversion_value
FROM `{project}.{raw}.google_ads_conversion_action_daily` d
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'google_ads' AND pa.account_id = d.account_id
JOIN `{project}.{core}.clients` c USING (client_id)
LEFT JOIN `{project}.{core}.conversion_action_map` m
  ON m.platform = 'google_ads' AND m.account_id = d.account_id
 AND m.source_key = d.conversion_action_id

UNION ALL

SELECT
  r.date,
  pa.client_id,
  c.client_name,
  'meta',
  r.account_id,
  r.campaign_id,
  r.campaign_name,
  COALESCE(m.source_name, JSON_VALUE(action, '$.action_type')) AS action_name,
  JSON_VALUE(action, '$.action_type') AS action_key,
  COALESCE(m.category, 'unmapped'),
  COALESCE(m.counts_as_lead, FALSE),
  CAST(JSON_VALUE(action, '$.value') AS FLOAT64),
  CAST(JSON_VALUE(action, '$.value') AS FLOAT64),
  NULL
FROM `{project}.{raw}.meta_campaign_daily` r
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'meta' AND pa.account_id = r.account_id
JOIN `{project}.{core}.clients` c USING (client_id),
UNNEST(JSON_QUERY_ARRAY(r.raw_actions_json, '$.actions')) AS action
LEFT JOIN `{project}.{core}.conversion_action_map` m
  ON m.platform = 'meta' AND m.account_id = r.account_id
 AND m.source_key = JSON_VALUE(action, '$.action_type');
