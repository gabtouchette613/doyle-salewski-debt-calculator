import json

from pipeline.connectors.meta import transforms
from pipeline.connectors.meta.actions import split_actions
from pipeline.models import schemas

MAPPING = {
    "lead": {"category": "lead", "counts_as_lead": True},
    "offsite_conversion.fb_pixel_lead": {"category": "form", "counts_as_lead": True},
    "click_to_call_call_confirm": {"category": "call", "counts_as_lead": True},
    "purchase": {"category": "purchase", "counts_as_lead": False},
    "landing_page_view": {"category": "other", "counts_as_lead": False},
}


def test_split_actions_categories_and_lead_rollup():
    actions = [
        {"action_type": "lead", "value": "3"},
        {"action_type": "offsite_conversion.fb_pixel_lead", "value": "2"},
        {"action_type": "click_to_call_call_confirm", "value": "1"},
        {"action_type": "landing_page_view", "value": "50"},
    ]
    totals, conversion_value, unmapped = split_actions(actions, [], MAPPING)
    assert totals["leads"] == 6.0  # all three counts_as_lead
    assert totals["forms"] == 2.0
    assert totals["calls"] == 1.0
    assert totals["conversions"] == 6.0  # 'other' excluded
    assert unmapped == set()


def test_unmapped_actions_are_collected_not_dropped():
    actions = [{"action_type": "onsite_conversion.messaging_first_reply", "value": "4"}]
    totals, _, unmapped = split_actions(actions, [], MAPPING)
    assert totals["leads"] == 0.0
    assert unmapped == {"onsite_conversion.messaging_first_reply"}


def test_conversion_value_only_from_purchase_action_values():
    action_values = [
        {"action_type": "purchase", "value": "199.99"},
        {"action_type": "lead", "value": "55"},  # lead "values" are not revenue
    ]
    _, conversion_value, _ = split_actions([], action_values, MAPPING)
    assert conversion_value == 199.99


def test_empty_actions_are_safe():
    totals, conversion_value, unmapped = split_actions(None, None, MAPPING)
    assert totals["conversions"] == 0.0 and conversion_value == 0.0 and unmapped == set()


def _insight():
    return {
        "date_start": "2026-06-15",
        "campaign_id": "c1",
        "campaign_name": "Leads - ON",
        "spend": "42.50",
        "impressions": "9000",
        "clicks": "120",
        "inline_link_clicks": "80",
        "reach": "5000",
        "frequency": "1.8",
        "actions": [{"action_type": "lead", "value": "2"}],
        "action_values": [],
    }


def test_campaign_transform_matches_schema_and_keeps_raw_json():
    metadata = {"c1": {"status": "ACTIVE", "objective": "OUTCOME_LEADS", "daily_budget": "5000"}}
    row, unmapped = transforms.campaign_row(_insight(), "123", metadata, MAPPING)
    expected = {n for n, _ in schemas.META_CAMPAIGN_DAILY.columns} - {"synced_at"}
    assert set(row) == expected
    assert row["clicks"] == 120 and row["link_clicks"] == 80  # both stored
    assert row["daily_budget"] == 50.0  # minor units -> currency
    assert row["leads"] == 2.0
    parsed = json.loads(row["raw_actions_json"])
    assert parsed["actions"][0]["action_type"] == "lead"
    assert unmapped == set()


def test_ad_transform_missing_metadata_is_tolerated():
    insight = _insight() | {"adset_id": "as1", "adset_name": "AS", "ad_id": "ad1", "ad_name": "Ad"}
    row, _ = transforms.ad_row(insight, "123", {}, MAPPING)
    expected = {n for n, _ in schemas.META_AD_DAILY.columns} - {"synced_at"}
    assert set(row) == expected
    assert row["ad_status"] is None and row["creative_id"] is None
