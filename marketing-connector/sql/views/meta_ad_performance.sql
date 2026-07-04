-- Meta ad/creative performance incl. frequency (creative-fatigue signal).
CREATE OR REPLACE VIEW `{project}.{dash}.meta_ad_performance` AS
SELECT
  a.date,
  pa.client_id,
  c.client_name,
  a.account_id,
  a.campaign_id,
  a.campaign_name,
  a.adset_id,
  a.adset_name,
  a.ad_id,
  a.ad_name,
  a.ad_status,
  a.creative_id,
  a.spend,
  a.impressions,
  a.clicks,
  a.link_clicks,
  a.reach,
  a.frequency,
  a.conversions,
  a.leads,
  a.calls,
  a.forms,
  SAFE_DIVIDE(a.link_clicks, a.impressions) AS link_ctr,
  SAFE_DIVIDE(a.spend, a.link_clicks) AS cpc,
  SAFE_DIVIDE(a.spend * 1000, a.impressions) AS cpm,
  SAFE_DIVIDE(a.spend, NULLIF(a.leads, 0)) AS cpl
FROM `{project}.{raw}.meta_ad_daily` a
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'meta' AND pa.account_id = a.account_id
JOIN `{project}.{core}.clients` c USING (client_id);
