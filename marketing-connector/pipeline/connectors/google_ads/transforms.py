"""Pure row transforms: GoogleAdsRow (proto) -> flat dicts matching schemas.

Kept free of SDK imports so they are unit-testable with SimpleNamespace rows.
"""
from __future__ import annotations


def micros_to_currency(value) -> float:
    return round((value or 0) / 1_000_000, 6)


def enum_name(value) -> str | None:
    """Proto-plus enums expose .name; tolerate plain strings/ints for tests."""
    if value is None:
        return None
    name = getattr(value, "name", None)
    if name:
        return str(name)
    return str(value)


def resource_id(resource_name: str) -> str:
    """'customers/123/conversionActions/456' -> '456'."""
    return str(resource_name).rstrip("/").split("/")[-1]


def _google_metrics(row) -> dict:
    m = row.metrics
    return {
        "impressions": int(m.impressions or 0),
        "clicks": int(m.clicks or 0),
        "cost": micros_to_currency(m.cost_micros),
        "conversions": float(m.conversions or 0.0),
        "conversion_value": float(m.conversions_value or 0.0),
    }


def campaign_row(row, account_id: str) -> dict:
    return {
        "date": row.segments.date,
        "account_id": account_id,
        "campaign_id": str(row.campaign.id),
        "campaign_name": row.campaign.name,
        "campaign_status": enum_name(row.campaign.status),
        "advertising_channel_type": enum_name(row.campaign.advertising_channel_type),
        "budget_amount": micros_to_currency(row.campaign_budget.amount_micros),
        **_google_metrics(row),
    }


def ad_group_row(row, account_id: str) -> dict:
    return {
        "date": row.segments.date,
        "account_id": account_id,
        "campaign_id": str(row.campaign.id),
        "campaign_name": row.campaign.name,
        "ad_group_id": str(row.ad_group.id),
        "ad_group_name": row.ad_group.name,
        "ad_group_status": enum_name(row.ad_group.status),
        **_google_metrics(row),
    }


def keyword_row(row, account_id: str) -> dict:
    quality = getattr(row.metrics, "historical_quality_score", None)
    return {
        "date": row.segments.date,
        "account_id": account_id,
        "campaign_id": str(row.campaign.id),
        "campaign_name": row.campaign.name,
        "ad_group_id": str(row.ad_group.id),
        "ad_group_name": row.ad_group.name,
        "criterion_id": str(row.ad_group_criterion.criterion_id),
        "keyword_text": row.ad_group_criterion.keyword.text,
        "match_type": enum_name(row.ad_group_criterion.keyword.match_type),
        "keyword_status": enum_name(row.ad_group_criterion.status),
        "quality_score": int(quality) if quality else None,
        **_google_metrics(row),
    }


def search_term_row(row, account_id: str) -> dict:
    return {
        "date": row.segments.date,
        "account_id": account_id,
        "campaign_id": str(row.campaign.id),
        "campaign_name": row.campaign.name,
        "ad_group_id": str(row.ad_group.id),
        "ad_group_name": row.ad_group.name,
        "search_term": row.search_term_view.search_term,
        "search_term_match_type": enum_name(row.segments.search_term_match_type),
        "search_term_status": enum_name(row.search_term_view.status),
        **_google_metrics(row),
    }


def conversion_action_row(row, account_id: str) -> dict:
    return {
        "date": row.segments.date,
        "account_id": account_id,
        "campaign_id": str(row.campaign.id),
        "campaign_name": row.campaign.name,
        "conversion_action_id": resource_id(row.segments.conversion_action),
        "conversion_action_name": row.segments.conversion_action_name,
        "conversion_action_category": enum_name(row.segments.conversion_action_category),
        "conversions": float(row.metrics.conversions or 0.0),
        "conversion_value": float(row.metrics.conversions_value or 0.0),
        "all_conversions": float(row.metrics.all_conversions or 0.0),
    }
