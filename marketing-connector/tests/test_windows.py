import datetime as dt

import pytest

from pipeline.jobs import windows

# 2026-07-04 02:00 UTC = 2026-07-03 22:00 in Toronto: the account-local date
# differs from the UTC date, which is exactly the case that must be handled.
FIXED_NOW = dt.datetime(2026, 7, 4, 2, 0, tzinfo=dt.timezone.utc)


def test_rolling_window_uses_account_timezone():
    start, end = windows.rolling_window("America/Toronto", 30, now=FIXED_NOW)
    assert end == dt.date(2026, 7, 2)  # yesterday in Toronto, not UTC
    assert start == dt.date(2026, 6, 3)
    assert (end - start).days == 29  # inclusive 30-day window


def test_rolling_window_utc():
    start, end = windows.rolling_window("UTC", 14, now=FIXED_NOW)
    assert end == dt.date(2026, 7, 3)
    assert start == dt.date(2026, 6, 20)


def test_chunk_window_covers_range_contiguously():
    start, end = dt.date(2026, 1, 1), dt.date(2026, 3, 31)  # 90 days
    chunks = windows.chunk_window(start, end)
    assert chunks[0][0] == start
    assert chunks[-1][1] == end
    for (s, e) in chunks:
        assert (e - s).days + 1 <= windows.MAX_CHUNK_DAYS
    for prev, nxt in zip(chunks, chunks[1:]):
        assert nxt[0] == prev[1] + dt.timedelta(days=1)


def test_chunk_window_single_day():
    day = dt.date(2026, 5, 5)
    assert windows.chunk_window(day, day) == [(day, day)]


def test_chunk_window_rejects_inverted_range():
    with pytest.raises(ValueError):
        windows.chunk_window(dt.date(2026, 2, 2), dt.date(2026, 2, 1))
