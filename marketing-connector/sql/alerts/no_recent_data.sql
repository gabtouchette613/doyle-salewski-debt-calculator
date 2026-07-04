-- Critical: an active account either has no successful sync in 36 hours, or
-- synced fine but produced zero rows yesterday despite spending in the prior
-- 7 days (silence is a signal).
INSERT INTO `{project}.{ops}.qa_alerts`
  (alert_id, detected_at, alert_date, client_id, platform, account_id,
   campaign_id, campaign_name, alert_type, severity, metric_value,
   threshold_value, message, status)
WITH active_accounts AS (
  SELECT pa.client_id, pa.platform, pa.account_id
  FROM `{project}.{core}.platform_accounts` pa
  JOIN `{project}.{core}.clients` c USING (client_id)
  WHERE pa.status = 'active' AND c.status = 'active'
    AND pa.account_id NOT LIKE 'TODO%'
),
last_sync AS (
  SELECT platform, account_id, MAX(finished_at) AS last_success
  FROM `{project}.{ops}.data_sync_logs`
  WHERE status IN ('success', 'partial')
  GROUP BY 1, 2
),
week_spend AS (
  SELECT platform, account_id, SUM(spend) AS spend_7d
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                 AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  GROUP BY 1, 2
),
yesterday_rows AS (
  SELECT platform, account_id, COUNT(*) AS n
  FROM `{project}.{core}.normalized_daily_performance`
  WHERE date = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  GROUP BY 1, 2
),
cand AS (
  SELECT
    a.client_id, a.platform, a.account_id,
    DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AS alert_date,
    CASE
      WHEN ls.last_success IS NULL
        OR ls.last_success < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 36 HOUR)
        THEN 'no successful sync in the last 36 hours'
      WHEN COALESCE(ws.spend_7d, 0) > 0 AND COALESCE(yr.n, 0) = 0
        THEN 'zero rows for yesterday despite spend in the prior 7 days'
    END AS reason
  FROM active_accounts a
  LEFT JOIN last_sync ls USING (platform, account_id)
  LEFT JOIN week_spend ws USING (platform, account_id)
  LEFT JOIN yesterday_rows yr USING (platform, account_id)
)
SELECT
  GENERATE_UUID(), CURRENT_TIMESTAMP(), c.alert_date, c.client_id, c.platform,
  c.account_id, NULL, NULL, 'no_recent_data', 'critical', NULL, NULL,
  FORMAT('Account %s (%s): %s.', c.account_id, c.platform, c.reason),
  'open'
FROM cand c
WHERE c.reason IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `{project}.{ops}.qa_alerts` q
    WHERE q.alert_type = 'no_recent_data' AND q.status = 'open'
      AND q.account_id = c.account_id
      AND q.alert_date = c.alert_date
  );
