import datetime as dt

from pipeline.connectors.base import validate_rows

WINDOW = (dt.date(2026, 6, 1), dt.date(2026, 6, 30))
KEY = ("date", "account_id", "campaign_id")


def _row(**overrides):
    row = {
        "date": "2026-06-15",
        "account_id": "123",
        "campaign_id": "c1",
        "impressions": 100,
        "clicks": 10,
        "cost": 25.5,
    }
    row.update(overrides)
    return row


def test_accepts_clean_rows():
    valid, rejected, reasons = validate_rows([_row()], KEY, *WINDOW)
    assert len(valid) == 1 and rejected == 0 and reasons == {}


def test_rejects_date_outside_window():
    valid, rejected, reasons = validate_rows([_row(date="2026-07-01")], KEY, *WINDOW)
    assert valid == [] and reasons == {"date_out_of_window": 1}


def test_rejects_unparseable_date():
    _, _, reasons = validate_rows([_row(date="not-a-date")], KEY, *WINDOW)
    assert reasons == {"bad_date": 1}


def test_rejects_missing_key_field():
    _, _, reasons = validate_rows([_row(campaign_id="")], KEY, *WINDOW)
    assert reasons == {"missing_key_field": 1}


def test_rejects_negative_metric():
    _, _, reasons = validate_rows([_row(clicks=-5)], KEY, *WINDOW)
    assert reasons == {"negative_metric": 1}


def test_deduplicates_on_key_first_wins():
    rows = [_row(clicks=10), _row(clicks=99), _row(campaign_id="c2")]
    valid, rejected, reasons = validate_rows(rows, KEY, *WINDOW)
    assert len(valid) == 2
    assert reasons == {"duplicate_key": 1}
    kept = next(r for r in valid if r["campaign_id"] == "c1")
    assert kept["clicks"] == 10


def test_normalizes_date_objects_to_iso_strings():
    valid, _, _ = validate_rows([_row(date=dt.date(2026, 6, 15))], KEY, *WINDOW)
    assert valid[0]["date"] == "2026-06-15"
