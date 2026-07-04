-- Trailing-3-day CPL more than @cpl_mult x the trailing-28-day baseline CPL
-- (baseline needs >= 3 leads to be meaningful).
INSERT INTO `{project}.{ops}.qa_alerts`
  (alert_id, detected_at, alert_date, client_id, platform, account_id,
   campaign_id, campaign_name, alert_type, severity, metric_value,
   threshold_value, message, status)
WITH recent AS (
  SELECT client_id, platform, account_id, campaign_id,
         ANY_VALUE(campaign_name) AS campaign_name,
         ANY_VALUE(currency) AS currency,
         SUM(spend) AS spend, SUM(leads) AS leads
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
                 AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  GROUP BY 1, 2, 3, 4
),
baseline AS (
  SELECT account_id, campaign_id, SUM(spend) AS spend, SUM(leads) AS leads
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 31 DAY)
                 AND DATE_SUB(CURRENT_DATE(), INTERVAL 4 DAY)
  GROUP BY 1, 2
),
cand AS (
  SELECT
    r.client_id, r.platform, r.account_id, r.campaign_id, r.campaign_name,
    r.currency,
    SAFE_DIVIDE(r.spend, NULLIF(r.leads, 0)) AS recent_cpl,
    SAFE_DIVIDE(b.spend, NULLIF(b.leads, 0)) AS baseline_cpl,
    DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AS alert_date
  FROM recent r
  JOIN baseline b USING (account_id, campaign_id)
  WHERE b.leads >= 3
    AND r.leads > 0
    AND SAFE_DIVIDE(r.spend, NULLIF(r.leads, 0)) >
        @cpl_mult * SAFE_DIVIDE(b.spend, NULLIF(b.leads, 0))
)
SELECT
  GENERATE_UUID(), CURRENT_TIMESTAMP(), c.alert_date, c.client_id, c.platform,
  c.account_id, c.campaign_id, c.campaign_name, 'cpl_spike', 'warning',
  CAST(ROUND(c.recent_cpl, 2) AS FLOAT64),
  CAST(ROUND(@cpl_mult * c.baseline_cpl, 2) AS FLOAT64),
  FORMAT('Campaign "%s" CPL is %s %s over the last 3 days vs %s baseline (28d).',
         c.campaign_name, CAST(ROUND(c.recent_cpl, 2) AS STRING), c.currency,
         CAST(ROUND(c.baseline_cpl, 2) AS STRING)),
  'open'
FROM cand c
WHERE NOT EXISTS (
  SELECT 1 FROM `{project}.{ops}.qa_alerts` q
  WHERE q.alert_type = 'cpl_spike' AND q.status = 'open'
    AND q.account_id = c.account_id
    AND COALESCE(q.campaign_id, '') = COALESCE(c.campaign_id, '')
    AND q.alert_date = c.alert_date
);
