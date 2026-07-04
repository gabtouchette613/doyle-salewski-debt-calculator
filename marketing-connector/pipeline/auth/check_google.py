"""Smoke test for Google Ads credentials.

  python -m pipeline.auth.check_google [customer_id]

Lists accessible customers; with a customer id, also pulls yesterday's
campaign spend to prove reporting access end to end.
"""
from __future__ import annotations

import datetime as dt
import sys

from pipeline.config.settings import Settings
from pipeline.connectors.google_ads.client import build_client, search_stream


def main() -> int:
    settings = Settings.from_env()
    creds = settings.require_google()
    client = build_client(creds)

    customer_service = client.get_service("CustomerService")
    accessible = customer_service.list_accessible_customers()
    print("Accessible customer resource names:")
    for name in accessible.resource_names:
        print(f"  {name}")

    if len(sys.argv) > 1:
        customer_id = sys.argv[1].replace("-", "")
        yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
        gaql = (
            "SELECT segments.date, campaign.name, metrics.cost_micros "
            f"FROM campaign WHERE segments.date = '{yesterday}'"
        )
        print(f"\nYesterday's campaigns for {customer_id}:")
        total = 0.0
        for row in search_stream(client, customer_id, gaql):
            cost = (row.metrics.cost_micros or 0) / 1_000_000
            total += cost
            print(f"  {row.campaign.name}: {cost:.2f}")
        print(f"  TOTAL: {total:.2f}")
    print("\nGoogle Ads credentials OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
