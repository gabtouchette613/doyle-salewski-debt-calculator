"""Main scheduled job.

Default (no args): re-pull the rolling 30-day window for every active account,
rebuild the normalized window, run QA alerts, exit non-zero if any unit failed.
With --start/--end it becomes the backfill runner (chunked <= 31 days).

Usage:
  python -m pipeline.jobs.run_daily
  python -m pipeline.jobs.run_daily --platform google_ads --client doyle_salewski
  python -m pipeline.jobs.run_daily --start 2026-04-01 --end 2026-06-30
"""
from __future__ import annotations

import argparse
import sys
import uuid

from pipeline.alerts.runner import run_alerts
from pipeline.config.jsonlog import log
from pipeline.config.settings import ConfigError, Settings
from pipeline.connectors.warehouse import Warehouse
from pipeline.jobs import windows
from pipeline.jobs.normalize import rebuild_normalized


def load_accounts(wh: Warehouse, platform: str, client_id: str | None) -> list[dict]:
    sql = """
    SELECT pa.client_id, pa.platform, pa.account_id, pa.timezone, pa.login_customer_id
    FROM `{project}.{core}.platform_accounts` pa
    JOIN `{project}.{core}.clients` c USING (client_id)
    WHERE pa.status = 'active' AND c.status = 'active'
      AND (@platform = 'all' OR pa.platform = @platform)
      AND (@client_id = '' OR pa.client_id = @client_id)
    ORDER BY pa.platform, pa.client_id, pa.account_id
    """
    return wh.query(sql, {"platform": platform, "client_id": client_id or ""})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Daily ETL / backfill runner")
    parser.add_argument("--start", type=windows.parse_date, help="Backfill start date (ISO)")
    parser.add_argument("--end", type=windows.parse_date, help="Backfill end date (ISO)")
    parser.add_argument(
        "--platform", choices=["all", "google_ads", "meta"], default="all"
    )
    parser.add_argument("--client", default=None, help="Limit to one client_id")
    parser.add_argument("--lookback", type=int, default=None, help="Override lookback days")
    parser.add_argument("--skip-alerts", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if bool(args.start) != bool(args.end):
        print("--start and --end must be provided together", file=sys.stderr)
        return 2

    settings = Settings.from_env()
    run_id = uuid.uuid4().hex
    wh = Warehouse(settings)
    log("run_started", run_id=run_id, platform=args.platform, client=args.client)

    accounts = load_accounts(wh, args.platform, args.client)
    if not accounts:
        log("no_active_accounts", level="warning", run_id=run_id)

    results = []
    synced_windows = []
    for account in accounts:
        account_id = str(account["account_id"])
        platform = account["platform"]
        if "TODO" in account_id.upper():
            log(
                "account_skipped_placeholder_id",
                level="warning",
                platform=platform,
                account_id=account_id,
            )
            continue

        if args.start and args.end:
            account_windows = windows.chunk_window(args.start, args.end)
        else:
            lookback = args.lookback or settings.default_lookback_days
            account_windows = [
                windows.rolling_window(account["timezone"] or "UTC", lookback)
            ]

        try:
            if platform == "google_ads":
                creds = settings.require_google()
                from pipeline.connectors.google_ads.pull import sync_account
            else:
                creds = settings.require_meta()
                from pipeline.connectors.meta.pull import sync_account
        except ConfigError as exc:
            log(
                "platform_skipped_missing_credentials",
                level="error",
                platform=platform,
                error=str(exc),
            )
            continue

        for window_start, window_end in account_windows:
            results.extend(
                sync_account(wh, creds, account_id, window_start, window_end, run_id)
            )
            synced_windows.append((window_start, window_end))

    if synced_windows:
        overall_start = min(w[0] for w in synced_windows)
        overall_end = max(w[1] for w in synced_windows)
        rebuild_normalized(wh, overall_start, overall_end)

    if not args.skip_alerts:
        run_alerts(wh, settings)

    failed = [r for r in results if r.status == "failed"]
    log(
        "run_finished",
        run_id=run_id,
        units_total=len(results),
        units_failed=len(failed),
        rows_written=sum(r.rows_written for r in results),
        rows_rejected=sum(r.rows_rejected for r in results),
    )
    if failed:
        for r in failed:
            log(
                "failed_unit",
                level="error",
                platform=r.platform,
                account_id=r.account_id,
                entity=r.entity,
                error=(r.error_message or "")[:300],
            )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
