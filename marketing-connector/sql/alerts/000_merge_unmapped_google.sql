-- Auto-register Google conversion actions seen in raw but absent from the map,
-- as category='other' / counts_as_lead=false. Nothing is ever silently dropped;
-- the unmapped_conversion_action alert then asks a human to categorize them.
MERGE `{project}.{core}.conversion_action_map` m
USING (
  SELECT
    'google_ads' AS platform,
    d.account_id,
    d.conversion_action_id AS source_key,
    ANY_VALUE(d.conversion_action_name) AS source_name
  FROM `{project}.{raw}.google_ads_conversion_action_daily` d
  WHERE d.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 35 DAY)
  GROUP BY d.account_id, d.conversion_action_id
) s
ON m.platform = s.platform AND m.account_id = s.account_id
   AND m.source_key = s.source_key
WHEN NOT MATCHED THEN INSERT
  (platform, account_id, source_key, source_name, category, counts_as_lead,
   is_primary, updated_at)
VALUES
  (s.platform, s.account_id, s.source_key, s.source_name, 'other', FALSE,
   FALSE, CURRENT_TIMESTAMP());
