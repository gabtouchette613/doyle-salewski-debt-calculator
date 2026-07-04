"""Google Ads API client: auth, streaming search, error classification.

Reporting-only: the sole service used is GoogleAdsService.SearchStream.
"""
from __future__ import annotations

from pipeline.connectors.base import AuthAPIError, FatalAPIError, TransientAPIError

_AUTH_ERROR_FIELDS = ("authentication_error", "authorization_error", "access_token_error")
_TRANSIENT_ERROR_FIELDS = ("internal_error", "quota_error")


def build_client(creds: dict[str, str]):
    """creds: output of Settings.require_google()."""
    from google.ads.googleads.client import GoogleAdsClient

    return GoogleAdsClient.load_from_dict(
        {
            "developer_token": creds["GOOGLE_ADS_DEVELOPER_TOKEN"],
            "client_id": creds["GOOGLE_ADS_CLIENT_ID"],
            "client_secret": creds["GOOGLE_ADS_CLIENT_SECRET"],
            "refresh_token": creds["GOOGLE_ADS_REFRESH_TOKEN"],
            "login_customer_id": creds["GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
            "use_proto_plus": True,
        }
    )


def classify_google_error(exc: Exception) -> Exception:
    """Map SDK/gRPC exceptions onto the shared error taxonomy."""
    failure = getattr(exc, "failure", None)
    if failure is not None:
        for error in getattr(failure, "errors", []):
            code = getattr(error, "error_code", None)
            if code is None:
                continue
            for f in _AUTH_ERROR_FIELDS:
                if getattr(code, f, 0):
                    return AuthAPIError(str(exc)[:1000])
            for f in _TRANSIENT_ERROR_FIELDS:
                if getattr(code, f, 0):
                    return TransientAPIError(str(exc)[:1000])
        return FatalAPIError(str(exc)[:1000])

    name = type(exc).__name__
    if name in ("ServiceUnavailable", "DeadlineExceeded", "InternalServerError", "TooManyRequests"):
        return TransientAPIError(str(exc)[:1000])
    if name in ("Unauthenticated", "PermissionDenied", "RefreshError"):
        return AuthAPIError(str(exc)[:1000])
    return FatalAPIError(str(exc)[:1000])


def search_stream(client, customer_id: str, gaql: str):
    """Yield rows from a streaming GAQL search (no manual pagination needed)."""
    service = client.get_service("GoogleAdsService")
    try:
        for batch in service.search_stream(customer_id=customer_id, query=gaql):
            yield from batch.results
    except Exception as exc:  # classified and re-raised in our taxonomy
        raise classify_google_error(exc) from exc
