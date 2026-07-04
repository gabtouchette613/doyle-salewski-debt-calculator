"""GAQL queries for the five MVP Google Ads entities.

Explicit field lists only — a removed field must fail loudly, never silently.
{start}/{end} are ISO dates injected by the pull layer.
"""
from __future__ import annotations

CAMPAIGN_DAILY = """
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign_budget.amount_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date BETWEEN '{start}' AND '{end}'
"""

AD_GROUP_DAILY = """
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group.status,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM ad_group
WHERE segments.date BETWEEN '{start}' AND '{end}'
"""

KEYWORD_DAILY = """
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.status,
  metrics.historical_quality_score,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM keyword_view
WHERE segments.date BETWEEN '{start}' AND '{end}'
"""

SEARCH_TERMS_DAILY = """
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  search_term_view.search_term,
  search_term_view.status,
  segments.search_term_match_type,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM search_term_view
WHERE segments.date BETWEEN '{start}' AND '{end}'
"""

# Campaign stats segmented by conversion action. Only conversion metrics are
# selectable with this segment; all_conversions captures secondary actions.
CONVERSION_ACTION_DAILY = """
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  segments.conversion_action,
  segments.conversion_action_name,
  segments.conversion_action_category,
  metrics.conversions,
  metrics.conversions_value,
  metrics.all_conversions
FROM campaign
WHERE segments.date BETWEEN '{start}' AND '{end}'
"""
