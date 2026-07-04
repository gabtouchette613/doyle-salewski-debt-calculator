-- Campaign averaged > @min_daily/day over the prior 7 days, spent 0 yesterday,
-- and its latest platform status is still active.
INSERT INTO `{project}.{ops}.qa_alerts`
  (alert_id, detected_at, alert_date, client_id, platform, account_id,
   campaign_id, campaign_name, alert_type, severity, metric_value,
   threshold_value, message, status)
WITH prior AS (
  SELECT client_id, platform, account_id, campaign_id,
         ANY_VALUE(campaign_name) AS campaign_name,
         SUM(spend) / 7 AS avg_daily_spend
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
                 AND DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY)
  GROUP BY 1, 2, 3, 4
  HAVING SUM(spend) / 7 > @min_daily
),
yesterday AS (
  SELECT platform, account_id, campaign_id, SUM(spend) AS spend
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  GROUP BY 1, 2, 3
),
latest_status AS (
  SELECT 'google_ads' AS platform, account_id, campaign_id,
         ARRAY_AGG(campaign_status ORDER BY date DESC LIMIT 1)[OFFSET(0)] AS status
  FROM `{project}.{raw}.google_ads_campaign_daily`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
  GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'meta', account_id, campaign_id,
         ARRAY_AGG(campaign_status ORDER BY date DESC LIMIT 1)[OFFSET(0)]
  FROM `{project}.{raw}.meta_campaign_daily`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
  GROUP BY 1, 2, 3
),
cand AS (
  SELECT p.*, DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AS alert_date
  FROM prior p
  LEFT JOIN yesterday y USING (platform, account_id, campaign_id)
  JOIN latest_status s USING (platform, account_id, campaign_id)
  WHERE COALESCE(y.spend, 0) = 0 AND s.status IN ('ENABLED', 'ACTIVE')
)
SELECT
  GENERATE_UUID(), CURRENT_TIMESTAMP(), c.alert_date, c.client_id, c.platform,
  c.account_id, c.campaign_id, c.campaign_name, 'campaign_stopped_spending',
  'warning', CAST(ROUND(c.avg_daily_spend, 2) AS FLOAT64), @min_daily,
  FORMAT('Campaign "%s" (still active) spent 0 yesterday after averaging %s/day for the prior week.',
         c.campaign_name, CAST(ROUND(c.avg_daily_spend, 2) AS STRING)),
  'open'
FROM cand c
WHERE NOT EXISTS (
  SELECT 1 FROM `{project}.{ops}.qa_alerts` q
  WHERE q.alert_type = 'campaign_stopped_spending' AND q.status = 'open'
    AND q.account_id = c.account_id
    AND COALESCE(q.campaign_id, '') = COALESCE(c.campaign_id, '')
    AND q.alert_date = c.alert_date
);
