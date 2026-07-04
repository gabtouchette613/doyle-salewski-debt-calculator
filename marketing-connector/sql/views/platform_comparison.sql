-- Monthly client x platform comparison (Google vs Meta side by side).
CREATE OR REPLACE VIEW `{project}.{dash}.platform_comparison` AS
SELECT
  DATE_TRUNC(n.date, MONTH) AS month,
  n.client_id,
  c.client_name,
  n.platform,
  n.currency,
  SUM(n.spend) AS spend,
  SUM(n.impressions) AS impressions,
  SUM(n.clicks) AS clicks,
  SUM(n.conversions) AS conversions,
  SUM(n.leads) AS leads,
  SUM(n.calls) AS calls,
  SUM(n.forms) AS forms,
  SAFE_DIVIDE(SUM(n.clicks), SUM(n.impressions)) AS ctr,
  SAFE_DIVIDE(SUM(n.spend), SUM(n.clicks)) AS cpc,
  SAFE_DIVIDE(SUM(n.spend), NULLIF(SUM(n.leads), 0)) AS cpl,
  SAFE_DIVIDE(SUM(n.spend), NULLIF(SUM(n.conversions), 0)) AS cpa
FROM `{project}.{core}.normalized_daily_performance` n
JOIN `{project}.{core}.clients` c USING (client_id)
GROUP BY 1, 2, 3, 4, 5;
