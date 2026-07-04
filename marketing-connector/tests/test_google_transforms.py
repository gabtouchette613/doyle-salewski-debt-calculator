import enum
from types import SimpleNamespace

from pipeline.connectors.google_ads import transforms
from pipeline.models import schemas


class Status(enum.Enum):
    ENABLED = 2


class Channel(enum.Enum):
    SEARCH = 2


class MatchType(enum.Enum):
    PHRASE = 3


def _campaign_proto():
    return SimpleNamespace(
        segments=SimpleNamespace(date="2026-06-15"),
        campaign=SimpleNamespace(
            id=111, name="Brand", status=Status.ENABLED,
            advertising_channel_type=Channel.SEARCH,
        ),
        campaign_budget=SimpleNamespace(amount_micros=50_000_000),
        metrics=SimpleNamespace(
            impressions=1000, clicks=50, cost_micros=123_456_789,
            conversions=3.5, conversions_value=0.0,
        ),
    )


def test_campaign_row_mapping_and_micros():
    row = transforms.campaign_row(_campaign_proto(), "9998887777")
    assert row["account_id"] == "9998887777"
    assert row["campaign_id"] == "111"
    assert row["campaign_status"] == "ENABLED"
    assert row["advertising_channel_type"] == "SEARCH"
    assert row["cost"] == 123.456789  # micros / 1e6
    assert row["budget_amount"] == 50.0
    assert row["conversions"] == 3.5  # fractional conversions preserved


def test_campaign_row_matches_table_schema():
    row = transforms.campaign_row(_campaign_proto(), "1")
    expected = {n for n, _ in schemas.GOOGLE_ADS_CAMPAIGN_DAILY.columns} - {"synced_at"}
    assert set(row) == expected


def test_keyword_row_matches_schema_and_handles_null_quality():
    proto = SimpleNamespace(
        segments=SimpleNamespace(date="2026-06-15"),
        campaign=SimpleNamespace(id=1, name="C"),
        ad_group=SimpleNamespace(id=2, name="AG"),
        ad_group_criterion=SimpleNamespace(
            criterion_id=333,
            keyword=SimpleNamespace(text="debt help", match_type=MatchType.PHRASE),
            status=Status.ENABLED,
        ),
        metrics=SimpleNamespace(
            impressions=10, clicks=1, cost_micros=2_000_000,
            conversions=0.0, conversions_value=0.0,
            historical_quality_score=0,  # unset proto default -> NULL
        ),
    )
    row = transforms.keyword_row(proto, "1")
    expected = {n for n, _ in schemas.GOOGLE_ADS_KEYWORD_DAILY.columns} - {"synced_at"}
    assert set(row) == expected
    assert row["quality_score"] is None
    assert row["match_type"] == "PHRASE"


def test_conversion_action_row_extracts_resource_id():
    proto = SimpleNamespace(
        segments=SimpleNamespace(
            date="2026-06-15",
            conversion_action="customers/999/conversionActions/456",
            conversion_action_name="Form submit",
            conversion_action_category="SUBMIT_LEAD_FORM",
        ),
        campaign=SimpleNamespace(id=1, name="C"),
        metrics=SimpleNamespace(conversions=2.0, conversions_value=0.0, all_conversions=3.0),
    )
    row = transforms.conversion_action_row(proto, "1")
    assert row["conversion_action_id"] == "456"
    assert row["all_conversions"] == 3.0
    expected = {
        n for n, _ in schemas.GOOGLE_ADS_CONVERSION_ACTION_DAILY.columns
    } - {"synced_at"}
    assert set(row) == expected


def test_zero_metrics_do_not_break():
    proto = _campaign_proto()
    proto.metrics = SimpleNamespace(
        impressions=0, clicks=0, cost_micros=0, conversions=0.0, conversions_value=0.0
    )
    row = transforms.campaign_row(proto, "1")
    assert row["cost"] == 0 and row["clicks"] == 0
