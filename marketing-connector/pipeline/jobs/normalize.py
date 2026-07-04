"""Rebuild core.normalized_daily_performance from raw for a date window.

Runs the multi-statement script in sql/etl/rebuild_normalized.sql: the window
is deleted and re-inserted from raw in one job, so raw and normalized can
never disagree for synced dates.
"""
from __future__ import annotations

import datetime as dt

from pipeline.config.jsonlog import log
from pipeline.config.paths import SQL_DIR
from pipeline.connectors.warehouse import Warehouse


def rebuild_normalized(wh: Warehouse, window_start: dt.date, window_end: dt.date) -> None:
    sql = (SQL_DIR / "etl" / "rebuild_normalized.sql").read_text()
    wh.execute(sql, {"window_start": window_start, "window_end": window_end})
    log(
        "normalized_rebuilt",
        window_start=window_start.isoformat(),
        window_end=window_end.isoformat(),
    )
