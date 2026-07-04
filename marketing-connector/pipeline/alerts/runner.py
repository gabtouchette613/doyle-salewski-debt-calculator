"""Run the SQL QA checks after ETL. Each check inserts rows into ops.qa_alerts,
de-duplicated against alerts already open for the same scope and date.

Before the checks run, Google conversion actions seen in raw but absent from
core.conversion_action_map are merged in as category='other' so the unmapped-
action alert covers both platforms (Meta unmapped actions are merged at load
time by the connector)."""
from __future__ import annotations

from pipeline.config.jsonlog import log
from pipeline.config.paths import SQL_DIR
from pipeline.config.settings import Settings
from pipeline.connectors.warehouse import Warehouse

MERGE_UNMAPPED_GOOGLE = "000_merge_unmapped_google.sql"

# (file, params builder)
ALERT_CHECKS = (
    ("spend_no_conversions.sql", lambda s: {"spend_threshold": s.alert_spend_no_conv_min}),
    ("cpl_spike.sql", lambda s: {"cpl_mult": s.alert_cpl_spike_mult}),
    ("campaign_stopped_spending.sql", lambda s: {"min_daily": s.alert_stopped_min_daily}),
    ("no_recent_data.sql", lambda s: {}),
    ("unmapped_conversion_action.sql", lambda s: {}),
)


def run_alerts(wh: Warehouse, settings: Settings) -> dict[str, int]:
    alerts_dir = SQL_DIR / "alerts"

    merge_job = wh.execute((alerts_dir / MERGE_UNMAPPED_GOOGLE).read_text())
    merged = merge_job.num_dml_affected_rows or 0
    if merged:
        log("unmapped_google_actions_added", level="warning", count=merged)

    fired: dict[str, int] = {}
    for filename, params_builder in ALERT_CHECKS:
        name = filename.removesuffix(".sql")
        try:
            job = wh.execute(
                (alerts_dir / filename).read_text(), params_builder(settings)
            )
            count = job.num_dml_affected_rows or 0
            fired[name] = count
            if count:
                log("qa_alert_fired", level="warning", alert_type=name, count=count)
        except Exception as exc:
            fired[name] = -1
            log(
                "qa_alert_check_failed",
                level="error",
                alert_type=name,
                error=str(exc)[:500],
            )
    log("qa_alerts_done", summary=fired)
    return fired
