-- Info: conversion actions auto-registered as category='other' in the last
-- 48h need a human to categorize them in core.conversion_action_map.
-- Dedupe note: campaign_id carries the source_key here so multiple unmapped
-- actions on the same account/day each get their own alert.
INSERT INTO `{project}.{ops}.qa_alerts`
  (alert_id, detected_at, alert_date, client_id, platform, account_id,
   campaign_id, campaign_name, alert_type, severity, metric_value,
   threshold_value, message, status)
WITH cand AS (
  SELECT
    pa.client_id, m.platform, m.account_id,
    m.source_key, m.source_name,
    DATE(m.updated_at) AS alert_date
  FROM `{project}.{core}.conversion_action_map` m
  JOIN `{project}.{core}.platform_accounts` pa
    ON pa.platform = m.platform AND pa.account_id = m.account_id
  WHERE m.category = 'other'
    AND m.counts_as_lead = FALSE
    AND m.updated_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 48 HOUR)
)
SELECT
  GENERATE_UUID(), CURRENT_TIMESTAMP(), c.alert_date, c.client_id, c.platform,
  c.account_id, c.source_key, c.source_name, 'unmapped_conversion_action',
  'info', NULL, NULL,
  FORMAT('Unmapped conversion action "%s" (%s) on %s account %s — categorize it in conversion_action_map or Leads will understate.',
         c.source_name, c.source_key, c.platform, c.account_id),
  'open'
FROM cand c
WHERE NOT EXISTS (
  SELECT 1 FROM `{project}.{ops}.qa_alerts` q
  WHERE q.alert_type = 'unmapped_conversion_action' AND q.status = 'open'
    AND q.account_id = c.account_id
    AND COALESCE(q.campaign_id, '') = c.source_key
    AND q.alert_date = c.alert_date
);
