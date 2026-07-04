-- Rebuild core.normalized_daily_performance from raw for a date window.
-- Multi-statement script; parameters: @window_start, @window_end (DATE).
-- Google leads/calls/forms come from the conversion-action breakdown joined
-- to conversion_action_map (all_conversions, so secondary actions count).
-- Meta rows already carry mapped lead/call/form columns from load time.

DELETE FROM `{project}.{core}.normalized_daily_performance`
WHERE date BETWEEN @window_start AND @window_end;

-- Google Ads, campaign grain
INSERT INTO `{project}.{core}.normalized_daily_performance`
  (date, client_id, platform, account_id, campaign_id, campaign_name, channel,
   currency, spend, impressions, clicks, conversions, leads, calls, forms,
   conversion_value, synced_at)
SELECT
  g.date,
  pa.client_id,
  'google_ads',
  g.account_id,
  g.campaign_id,
  g.campaign_name,
  CASE g.advertising_channel_type
    WHEN 'SEARCH' THEN 'search'
    WHEN 'PERFORMANCE_MAX' THEN 'pmax'
    WHEN 'DISPLAY' THEN 'display'
    WHEN 'VIDEO' THEN 'video'
    WHEN 'DEMAND_GEN' THEN 'social'
    ELSE 'other'
  END,
  pa.currency,
  g.cost,
  g.impressions,
  g.clicks,
  g.conversions,
  COALESCE(ca.leads, 0),
  COALESCE(ca.calls, 0),
  COALESCE(ca.forms, 0),
  g.conversion_value,
  CURRENT_TIMESTAMP()
FROM `{project}.{raw}.google_ads_campaign_daily` g
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'google_ads' AND pa.account_id = g.account_id
LEFT JOIN (
  SELECT
    d.date,
    d.account_id,
    d.campaign_id,
    SUM(IF(m.counts_as_lead, d.all_conversions, 0)) AS leads,
    SUM(IF(m.category = 'call', d.all_conversions, 0)) AS calls,
    SUM(IF(m.category = 'form', d.all_conversions, 0)) AS forms
  FROM `{project}.{raw}.google_ads_conversion_action_daily` d
  LEFT JOIN `{project}.{core}.conversion_action_map` m
    ON m.platform = 'google_ads'
   AND m.account_id = d.account_id
   AND m.source_key = d.conversion_action_id
  WHERE d.date BETWEEN @window_start AND @window_end
  GROUP BY 1, 2, 3
) ca
  ON ca.date = g.date AND ca.account_id = g.account_id AND ca.campaign_id = g.campaign_id
WHERE g.date BETWEEN @window_start AND @window_end;

-- Meta, campaign grain (clicks normalized to link clicks)
INSERT INTO `{project}.{core}.normalized_daily_performance`
  (date, client_id, platform, account_id, campaign_id, campaign_name, channel,
   currency, spend, impressions, clicks, conversions, leads, calls, forms,
   conversion_value, synced_at)
SELECT
  mc.date,
  pa.client_id,
  'meta',
  mc.account_id,
  mc.campaign_id,
  mc.campaign_name,
  'social',
  pa.currency,
  mc.spend,
  mc.impressions,
  mc.link_clicks,
  mc.conversions,
  mc.leads,
  mc.calls,
  mc.forms,
  mc.conversion_value,
  CURRENT_TIMESTAMP()
FROM `{project}.{raw}.meta_campaign_daily` mc
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'meta' AND pa.account_id = mc.account_id
WHERE mc.date BETWEEN @window_start AND @window_end;
