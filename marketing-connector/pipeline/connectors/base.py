"""Shared connector infrastructure: error taxonomy, retry, validation, results.

Read-only by design: this codebase only ever calls reporting endpoints on the
ad platforms. Nothing here or in the connectors writes to Google Ads or Meta.
"""
from __future__ import annotations

import datetime as dt
import random
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from typing import Callable, Iterable

from pipeline.config.jsonlog import log


class TransientAPIError(Exception):
    """Retryable: 5xx, timeouts, throttling."""


class AuthAPIError(Exception):
    """Not retryable: expired/invalid token, revoked permission."""


class FatalAPIError(Exception):
    """Not retryable: bad request, removed field, unknown account."""


def call_with_retry(
    fn: Callable,
    *,
    max_attempts: int = 4,
    base_delay: float = 2.0,
    max_delay: float = 60.0,
    sleep: Callable[[float], None] = time.sleep,
    context: str = "",
):
    """Run fn(), retrying TransientAPIError with exponential backoff + jitter.

    AuthAPIError and FatalAPIError propagate immediately.
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            return fn()
        except TransientAPIError as exc:
            if attempt >= max_attempts:
                raise
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            delay += random.uniform(0, delay * 0.25)
            log(
                "retrying_transient_error",
                level="warning",
                context=context,
                attempt=attempt,
                max_attempts=max_attempts,
                delay_seconds=round(delay, 1),
                error=str(exc)[:300],
            )
            sleep(delay)


@dataclass
class SyncResult:
    platform: str
    account_id: str
    entity: str
    window_start: dt.date
    window_end: dt.date
    status: str = "success"  # success | failed | partial
    rows_written: int = 0
    rows_rejected: int = 0
    error_message: str | None = None
    started_at: dt.datetime = field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc)
    )
    finished_at: dt.datetime | None = None
    sync_id: str = field(default_factory=lambda: uuid.uuid4().hex)

    def finish(self) -> "SyncResult":
        self.finished_at = dt.datetime.now(dt.timezone.utc)
        return self

    def to_log_row(self, run_id: str) -> dict:
        return {
            "sync_id": self.sync_id,
            "run_id": run_id,
            "started_at": self.started_at.isoformat(),
            "finished_at": (self.finished_at or dt.datetime.now(dt.timezone.utc)).isoformat(),
            "platform": self.platform,
            "account_id": self.account_id,
            "entity": self.entity,
            "window_start": self.window_start.isoformat(),
            "window_end": self.window_end.isoformat(),
            "status": self.status,
            "rows_written": self.rows_written,
            "rows_rejected": self.rows_rejected,
            "error_message": (self.error_message or "")[:1500] or None,
        }


# Metric fields that must be >= 0 when present.
_NON_NEGATIVE_FIELDS = (
    "impressions",
    "clicks",
    "link_clicks",
    "reach",
    "cost",
    "spend",
    "conversions",
    "all_conversions",
)


def validate_rows(
    rows: Iterable[dict],
    key_fields: tuple[str, ...],
    window_start: dt.date,
    window_end: dt.date,
) -> tuple[list[dict], int, dict[str, int]]:
    """Validate and de-duplicate rows before load.

    Checks: parseable date within the requested window, non-empty key fields,
    non-negative metrics, uniqueness on key_fields (first occurrence wins).
    Returns (valid_rows, rejected_count, rejection_reasons).
    """
    valid: list[dict] = []
    reasons: Counter = Counter()
    seen: set[tuple] = set()

    for row in rows:
        raw_date = row.get("date")
        try:
            row_date = (
                raw_date
                if isinstance(raw_date, dt.date)
                else dt.date.fromisoformat(str(raw_date))
            )
        except (TypeError, ValueError):
            reasons["bad_date"] += 1
            continue
        if not (window_start <= row_date <= window_end):
            reasons["date_out_of_window"] += 1
            continue

        if any(row.get(k) in (None, "") for k in key_fields):
            reasons["missing_key_field"] += 1
            continue

        bad_metric = False
        for f in _NON_NEGATIVE_FIELDS:
            v = row.get(f)
            if v is not None and float(v) < 0:
                bad_metric = True
                break
        if bad_metric:
            reasons["negative_metric"] += 1
            continue

        key = tuple(str(row[k]) for k in key_fields)
        if key in seen:
            reasons["duplicate_key"] += 1
            continue
        seen.add(key)

        row["date"] = row_date.isoformat()
        valid.append(row)

    return valid, sum(reasons.values()), dict(reasons)
