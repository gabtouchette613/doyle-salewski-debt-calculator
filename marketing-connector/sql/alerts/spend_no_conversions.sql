-- Campaign spent >= @spend_threshold over the trailing 3 days with 0 leads.
INSERT INTO `{project}.{ops}.qa_alerts`
  (alert_id, detected_at, alert_date, client_id, platform, account_id,
   campaign_id, campaign_name, alert_type, severity, metric_value,
   threshold_value, message, status)
WITH cand AS (
  SELECT
    n.client_id,
    n.platform,
    n.account_id,
    n.campaign_id,
    ANY_VALUE(n.campaign_name) AS campaign_name,
    ANY_VALUE(n.currency) AS currency,
    SUM(n.spend) AS spend,
    DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AS alert_date
  FROM `{project}.{core}.normalized_daily_performance` n
  WHERE n.date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
                   AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  GROUP BY 1, 2, 3, 4
  HAVING SUM(n.spend) >= @spend_threshold AND SUM(n.leads) = 0
)
SELECT
  GENERATE_UUID(), CURRENT_TIMESTAMP(), c.alert_date, c.client_id, c.platform,
  c.account_id, c.campaign_id, c.campaign_name, 'spend_no_conversions',
  'warning', CAST(ROUND(c.spend, 2) AS FLOAT64), @spend_threshold,
  FORMAT('Campaign "%s" spent %s %s over the trailing 3 days with 0 leads.',
         c.campaign_name, CAST(ROUND(c.spend, 2) AS STRING), c.currency),
  'open'
FROM cand c
WHERE NOT EXISTS (
  SELECT 1 FROM `{project}.{ops}.qa_alerts` q
  WHERE q.alert_type = 'spend_no_conversions' AND q.status = 'open'
    AND q.account_id = c.account_id
    AND COALESCE(q.campaign_id, '') = COALESCE(c.campaign_id, '')
    AND q.alert_date = c.alert_date
);
