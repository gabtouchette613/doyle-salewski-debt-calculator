"""The delete+insert contract: the window delete must be scoped to exactly the
account and date range being reloaded, so re-runs can never duplicate rows and
can never touch other accounts' data."""
from pipeline.connectors.warehouse import Warehouse
from pipeline.models import schemas


def test_window_delete_is_scoped_to_account_and_window():
    sql = Warehouse.window_delete_sql("p.raw.google_ads_campaign_daily")
    assert "DELETE FROM `p.raw.google_ads_campaign_daily`" in sql
    assert "account_id = @account_id" in sql
    assert "date BETWEEN @window_start AND @window_end" in sql


def test_every_daily_table_key_includes_date_and_account():
    daily = [s for s in schemas.ALL_TABLES if s.name.endswith("_daily") or s.name == "normalized_daily_performance"]
    assert daily, "expected daily tables"
    for spec in daily:
        assert "date" in spec.key, spec.name
        assert "account_id" in spec.key, spec.name


def test_every_daily_table_is_partitioned_and_clustered():
    for spec in schemas.ALL_TABLES:
        if spec.dataset == "raw" or spec.name == "normalized_daily_performance":
            assert spec.partition == "date", spec.name
            assert spec.cluster, spec.name


def test_key_fields_exist_in_columns():
    for spec in schemas.ALL_TABLES:
        colnames = {n for n, _ in spec.columns}
        for k in spec.key:
            assert k in colnames, f"{spec.name}: key field {k} missing from columns"
