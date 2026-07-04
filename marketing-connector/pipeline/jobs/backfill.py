"""Backfill wrapper around run_daily: requires an explicit window.

  python -m pipeline.jobs.backfill --start 2025-07-01 --end 2026-06-30 \
      --platform google_ads --client doyle_salewski

Windows are chunked into <= 31-day pieces, oldest first, and every write is
idempotent, so a failed backfill can simply be re-run.
"""
from __future__ import annotations

import sys

from pipeline.jobs.run_daily import build_parser, main


def cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not (args.start and args.end):
        print("backfill requires --start and --end", file=sys.stderr)
        return 2
    return main(argv)


if __name__ == "__main__":
    sys.exit(cli())
