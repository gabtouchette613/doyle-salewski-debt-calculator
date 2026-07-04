"""JSON-lines logging to stdout — readable in GitHub Actions, parseable in Cloud Logging."""
from __future__ import annotations

import datetime as dt
import json


def log(event: str, level: str = "info", **fields) -> None:
    record = {
        "ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "level": level,
        "event": event,
    }
    record.update(fields)
    print(json.dumps(record, default=str), flush=True)
