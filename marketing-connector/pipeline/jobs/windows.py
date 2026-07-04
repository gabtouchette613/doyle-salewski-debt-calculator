"""Date-window computation: rolling refresh windows and backfill chunking.

All windows are inclusive [start, end]. The rolling window ends yesterday in
the ad account's own timezone, because platforms report stat dates in account
time and today's data is always incomplete.
"""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

MAX_CHUNK_DAYS = 31


def account_today(timezone_name: str, now: dt.datetime | None = None) -> dt.date:
    now = now or dt.datetime.now(dt.timezone.utc)
    return now.astimezone(ZoneInfo(timezone_name)).date()


def rolling_window(
    timezone_name: str,
    lookback_days: int = 30,
    now: dt.datetime | None = None,
) -> tuple[dt.date, dt.date]:
    """[today-lookback_days, yesterday] in the account's timezone."""
    end = account_today(timezone_name, now) - dt.timedelta(days=1)
    start = end - dt.timedelta(days=lookback_days - 1)
    return start, end


def chunk_window(
    start: dt.date, end: dt.date, max_days: int = MAX_CHUNK_DAYS
) -> list[tuple[dt.date, dt.date]]:
    """Split [start, end] into contiguous inclusive chunks of <= max_days."""
    if start > end:
        raise ValueError(f"window start {start} is after end {end}")
    chunks = []
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + dt.timedelta(days=max_days - 1))
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + dt.timedelta(days=1)
    return chunks


def parse_date(value: str) -> dt.date:
    return dt.date.fromisoformat(value)
