-- Campaign-daily grain across both platforms, ratios precomputed.
CREATE OR REPLACE VIEW `{project}.{dash}.campaign_performance` AS
SELECT
  n.date,
  n.client_id,
  c.client_name,
  n.platform,
  n.account_id,
  n.campaign_id,
  n.campaign_name,
  n.channel,
  n.currency,
  n.spend,
  n.impressions,
  n.clicks,
  n.conversions,
  n.leads,
  n.calls,
  n.forms,
  n.conversion_value,
  SAFE_DIVIDE(n.clicks, n.impressions) AS ctr,
  SAFE_DIVIDE(n.spend, n.clicks) AS cpc,
  SAFE_DIVIDE(n.spend * 1000, n.impressions) AS cpm,
  SAFE_DIVIDE(n.spend, NULLIF(n.leads, 0)) AS cpl,
  SAFE_DIVIDE(n.spend, NULLIF(n.conversions, 0)) AS cpa,
  SAFE_DIVIDE(n.conversions, n.clicks) AS conversion_rate
FROM `{project}.{core}.normalized_daily_performance` n
JOIN `{project}.{core}.clients` c USING (client_id);
