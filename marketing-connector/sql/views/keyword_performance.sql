CREATE OR REPLACE VIEW `{project}.{dash}.keyword_performance` AS
SELECT
  k.date,
  pa.client_id,
  c.client_name,
  k.account_id,
  k.campaign_id,
  k.campaign_name,
  k.ad_group_id,
  k.ad_group_name,
  k.criterion_id,
  k.keyword_text,
  k.match_type,
  k.keyword_status,
  k.quality_score,
  k.impressions,
  k.clicks,
  k.cost,
  k.conversions,
  k.conversion_value,
  SAFE_DIVIDE(k.clicks, k.impressions) AS ctr,
  SAFE_DIVIDE(k.cost, k.clicks) AS cpc,
  SAFE_DIVIDE(k.cost, NULLIF(k.conversions, 0)) AS cpa,
  SAFE_DIVIDE(k.conversions, k.clicks) AS conversion_rate
FROM `{project}.{raw}.google_ads_keyword_daily` k
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'google_ads' AND pa.account_id = k.account_id
JOIN `{project}.{core}.clients` c USING (client_id);
