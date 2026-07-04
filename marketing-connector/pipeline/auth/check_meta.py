"""Smoke test for Meta credentials.

  python -m pipeline.auth.check_meta <account_id_without_act_prefix>

Fetches the account name and yesterday's spend with the ads_read token.
"""
from __future__ import annotations

import datetime as dt
import sys

from pipeline.config.settings import Settings
from pipeline.connectors.meta.client import init_api


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python -m pipeline.auth.check_meta <account_id>", file=sys.stderr)
        return 2
    account_id = sys.argv[1].removeprefix("act_")

    settings = Settings.from_env()
    init_api(settings.require_meta())

    from facebook_business.adobjects.adaccount import AdAccount

    account = AdAccount(f"act_{account_id}")
    info = account.api_get(fields=["name", "currency", "timezone_name"])
    print(f"Account: {info.get('name')} ({info.get('currency')}, {info.get('timezone_name')})")

    yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    insights = account.get_insights(
        fields=["spend", "impressions"],
        params={"time_range": {"since": yesterday, "until": yesterday}},
    )
    for row in insights:
        print(f"Yesterday: spend={row.get('spend')} impressions={row.get('impressions')}")
    print("Meta credentials OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
