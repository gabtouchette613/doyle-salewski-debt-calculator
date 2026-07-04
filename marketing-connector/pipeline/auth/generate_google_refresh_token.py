"""One-time helper: mint the long-lived Google Ads refresh token.

Run locally (needs a browser), signed in as a user with admin access to the
MCC. Requires GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET in the env.

  pip install google-auth-oauthlib
  python -m pipeline.auth.generate_google_refresh_token

Paste the printed refresh token into your secret store — never commit it.
"""
from __future__ import annotations

import os
import sys

SCOPES = ["https://www.googleapis.com/auth/adwords"]


def main() -> int:
    client_id = os.environ.get("GOOGLE_ADS_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_ADS_CLIENT_SECRET")
    if not (client_id and client_secret):
        print("Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET first.", file=sys.stderr)
        return 2

    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
    credentials = flow.run_local_server(port=0, prompt="consent")
    print("\nGOOGLE_ADS_REFRESH_TOKEN (store as a secret, do not commit):\n")
    print(credentials.refresh_token)
    return 0


if __name__ == "__main__":
    sys.exit(main())
