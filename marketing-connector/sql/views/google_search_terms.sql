-- Search terms with cost/conversions. Note: Google omits low-volume terms,
-- so totals here will be lower than campaign spend — by design.
CREATE OR REPLACE VIEW `{project}.{dash}.google_search_terms` AS
SELECT
  st.date,
  pa.client_id,
  c.client_name,
  st.account_id,
  st.campaign_id,
  st.campaign_name,
  st.ad_group_id,
  st.ad_group_name,
  st.search_term,
  st.search_term_match_type,
  st.search_term_status,
  st.impressions,
  st.clicks,
  st.cost,
  st.conversions,
  SAFE_DIVIDE(st.clicks, st.impressions) AS ctr,
  SAFE_DIVIDE(st.cost, st.clicks) AS cpc,
  SAFE_DIVIDE(st.cost, NULLIF(st.conversions, 0)) AS cpa
FROM `{project}.{raw}.google_ads_search_terms_daily` st
JOIN `{project}.{core}.platform_accounts` pa
  ON pa.platform = 'google_ads' AND pa.account_id = st.account_id
JOIN `{project}.{core}.clients` c USING (client_id);
