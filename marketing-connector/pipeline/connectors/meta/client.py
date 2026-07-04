"""Meta Marketing API client: auth, insights fetch (sync + async), errors.

Read-only: only insights and entity-metadata GET endpoints are called, with a
token scoped ads_read.
"""
from __future__ import annotations

import time

from pipeline.config.jsonlog import log
from pipeline.connectors.base import AuthAPIError, FatalAPIError, TransientAPIError

# Meta error codes that are transient/throttling.
_TRANSIENT_CODES = {1, 2, 4, 17, 32, 613}
_ASYNC_POLL_SECONDS = 10
_ASYNC_TIMEOUT_SECONDS = 900

INSIGHT_FIELDS = [
    "date_start",
    "spend",
    "impressions",
    "clicks",
    "inline_link_clicks",
    "reach",
    "frequency",
    "actions",
    "action_values",
]

LEVEL_ID_FIELDS = {
    "campaign": ["campaign_id", "campaign_name"],
    "adset": ["campaign_id", "campaign_name", "adset_id", "adset_name"],
    "ad": ["campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name"],
}


def init_api(creds: dict[str, str]):
    """creds: output of Settings.require_meta()."""
    from facebook_business.api import FacebookAdsApi

    return FacebookAdsApi.init(
        app_id=creds["META_APP_ID"],
        app_secret=creds["META_APP_SECRET"],
        access_token=creds["META_ACCESS_TOKEN"],
        crash_log=False,
    )


def classify_meta_error(exc: Exception) -> Exception:
    code = None
    http_status = None
    if hasattr(exc, "api_error_code"):
        try:
            code = exc.api_error_code()
            http_status = exc.http_status()
        except Exception:
            pass
    if code == 190:
        return AuthAPIError(str(exc)[:1000])
    if code in _TRANSIENT_CODES or (http_status and http_status >= 500):
        return TransientAPIError(str(exc)[:1000])
    if code in (10, 200, 294):  # permission errors
        return AuthAPIError(str(exc)[:1000])
    return FatalAPIError(str(exc)[:1000])


def _insights_params(level: str, since: str, until: str) -> dict:
    return {
        "level": level,
        "time_range": {"since": since, "until": until},
        "time_increment": 1,
        "limit": 500,
    }


def fetch_insights(
    account_id: str,
    level: str,
    since: str,
    until: str,
    use_async: bool = False,
) -> list[dict]:
    """Daily insight rows for one account/level. Cursor auto-paginates.

    On a sync-call timeout Meta recommends the async report job; callers should
    retry with use_async=True when they see a transient failure on a big pull.
    """
    from facebook_business.adobjects.adaccount import AdAccount

    fields = INSIGHT_FIELDS + LEVEL_ID_FIELDS[level]
    params = _insights_params(level, since, until)
    account = AdAccount(f"act_{account_id}")
    try:
        if use_async:
            job = account.get_insights(fields=fields, params=params, is_async=True)
            deadline = time.monotonic() + _ASYNC_TIMEOUT_SECONDS
            while True:
                job = job.api_get()
                status = job.get("async_status")
                if status == "Job Completed":
                    cursor = job.get_result(params={"limit": 500})
                    break
                if status in ("Job Failed", "Job Skipped"):
                    raise TransientAPIError(f"async insights job {status}")
                if time.monotonic() > deadline:
                    raise TransientAPIError("async insights job timed out")
                time.sleep(_ASYNC_POLL_SECONDS)
        else:
            cursor = account.get_insights(fields=fields, params=params)
        return [dict(row) for row in cursor]
    except (TransientAPIError, AuthAPIError, FatalAPIError):
        raise
    except Exception as exc:
        raise classify_meta_error(exc) from exc


def fetch_entity_metadata(account_id: str) -> dict[str, dict[str, dict]]:
    """Status/objective/budget/creative metadata, keyed by entity id.

    Insights rows don't carry status or budget, so these come from the entity
    endpoints and are joined in the transform layer.
    """
    from facebook_business.adobjects.adaccount import AdAccount

    account = AdAccount(f"act_{account_id}")
    params = {"limit": 500}
    try:
        campaigns = {
            c["id"]: dict(c)
            for c in account.get_campaigns(
                fields=["name", "status", "objective", "daily_budget"], params=params
            )
        }
        adsets = {
            a["id"]: dict(a)
            for a in account.get_ad_sets(
                fields=["name", "status", "daily_budget"], params=params
            )
        }
        ads = {
            a["id"]: dict(a)
            for a in account.get_ads(fields=["name", "status", "creative"], params=params)
        }
    except Exception as exc:
        raise classify_meta_error(exc) from exc
    log(
        "meta_metadata_fetched",
        account_id=account_id,
        campaigns=len(campaigns),
        adsets=len(adsets),
        ads=len(ads),
    )
    return {"campaign": campaigns, "adset": adsets, "ad": ads}
