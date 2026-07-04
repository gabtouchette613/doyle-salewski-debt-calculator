"""Classify Meta `actions` arrays into leads/calls/forms/purchases using the
per-account conversion_action_map. Unmapped action types are surfaced, never
dropped — the raw JSON is preserved alongside the derived columns."""
from __future__ import annotations

MAPPED_CATEGORIES = ("lead", "call", "form", "purchase")


def split_actions(
    actions: list[dict] | None,
    action_values: list[dict] | None,
    mapping: dict[str, dict],
) -> tuple[dict[str, float], float, set[str]]:
    """mapping: action_type -> {"category": str, "counts_as_lead": bool}.

    Returns (totals, conversion_value, unmapped_action_types) where totals has
    keys conversions/leads/calls/forms/purchases. `conversions` sums every
    action mapped to a real category; `leads` sums counts_as_lead actions.
    """
    totals = {"conversions": 0.0, "leads": 0.0, "calls": 0.0, "forms": 0.0, "purchases": 0.0}
    unmapped: set[str] = set()

    for action in actions or []:
        action_type = action.get("action_type")
        value = float(action.get("value", 0) or 0)
        entry = mapping.get(action_type)
        if entry is None:
            if action_type:
                unmapped.add(action_type)
            continue
        category = entry.get("category")
        if category in MAPPED_CATEGORIES:
            totals["conversions"] += value
        if entry.get("counts_as_lead"):
            totals["leads"] += value
        if category == "call":
            totals["calls"] += value
        elif category == "form":
            totals["forms"] += value
        elif category == "purchase":
            totals["purchases"] += value

    conversion_value = 0.0
    for av in action_values or []:
        entry = mapping.get(av.get("action_type"))
        if entry and entry.get("category") == "purchase":
            conversion_value += float(av.get("value", 0) or 0)

    return totals, conversion_value, unmapped
