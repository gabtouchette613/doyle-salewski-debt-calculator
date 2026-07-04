"""Pure transforms: Meta insights dicts -> flat rows matching schemas."""
from __future__ import annotations

import json

from pipeline.connectors.meta.actions import split_actions


def _budget_units(value) -> float | None:
    """Meta budgets arrive in minor currency units (cents) as strings."""
    if value in (None, ""):
        return None
    return round(float(value) / 100, 2)


def _base_metrics(insight: dict, mapping: dict[str, dict]) -> tuple[dict, set[str]]:
    totals, conversion_value, unmapped = split_actions(
        insight.get("actions"), insight.get("action_values"), mapping
    )
    metrics = {
        "spend": float(insight.get("spend", 0) or 0),
        "impressions": int(insight.get("impressions", 0) or 0),
        "clicks": int(insight.get("clicks", 0) or 0),
        "link_clicks": int(insight.get("inline_link_clicks", 0) or 0),
        "reach": int(insight.get("reach", 0) or 0),
        "frequency": float(insight.get("frequency", 0) or 0),
        "conversions": totals["conversions"],
        "leads": totals["leads"],
        "calls": totals["calls"],
        "forms": totals["forms"],
        "purchases": totals["purchases"],
        "conversion_value": conversion_value,
        "raw_actions_json": json.dumps(
            {
                "actions": insight.get("actions") or [],
                "action_values": insight.get("action_values") or [],
            }
        ),
    }
    return metrics, unmapped


def campaign_row(
    insight: dict, account_id: str, metadata: dict[str, dict], mapping: dict[str, dict]
) -> tuple[dict, set[str]]:
    metrics, unmapped = _base_metrics(insight, mapping)
    meta = metadata.get(insight.get("campaign_id"), {})
    row = {
        "date": insight.get("date_start"),
        "account_id": account_id,
        "campaign_id": insight.get("campaign_id"),
        "campaign_name": insight.get("campaign_name"),
        "campaign_status": meta.get("status"),
        "objective": meta.get("objective"),
        "daily_budget": _budget_units(meta.get("daily_budget")),
        **metrics,
    }
    return row, unmapped


def adset_row(
    insight: dict, account_id: str, metadata: dict[str, dict], mapping: dict[str, dict]
) -> tuple[dict, set[str]]:
    metrics, unmapped = _base_metrics(insight, mapping)
    meta = metadata.get(insight.get("adset_id"), {})
    row = {
        "date": insight.get("date_start"),
        "account_id": account_id,
        "campaign_id": insight.get("campaign_id"),
        "campaign_name": insight.get("campaign_name"),
        "adset_id": insight.get("adset_id"),
        "adset_name": insight.get("adset_name"),
        "adset_status": meta.get("status"),
        "daily_budget": _budget_units(meta.get("daily_budget")),
        **metrics,
    }
    return row, unmapped


def ad_row(
    insight: dict, account_id: str, metadata: dict[str, dict], mapping: dict[str, dict]
) -> tuple[dict, set[str]]:
    metrics, unmapped = _base_metrics(insight, mapping)
    meta = metadata.get(insight.get("ad_id"), {})
    creative = meta.get("creative") or {}
    row = {
        "date": insight.get("date_start"),
        "account_id": account_id,
        "campaign_id": insight.get("campaign_id"),
        "campaign_name": insight.get("campaign_name"),
        "adset_id": insight.get("adset_id"),
        "adset_name": insight.get("adset_name"),
        "ad_id": insight.get("ad_id"),
        "ad_name": insight.get("ad_name"),
        "ad_status": meta.get("status"),
        "creative_id": creative.get("id") if isinstance(creative, dict) else None,
        **metrics,
    }
    return row, unmapped
