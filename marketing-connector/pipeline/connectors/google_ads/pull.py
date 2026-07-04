"""Google Ads sync units: fetch → transform → validate → delete+insert → log."""
from __future__ import annotations

import datetime as dt

from pipeline.config.jsonlog import log
from pipeline.connectors import base
from pipeline.connectors.google_ads import client as gclient
from pipeline.connectors.google_ads import queries, transforms
from pipeline.connectors.warehouse import Warehouse
from pipeline.models import schemas

# entity -> (GAQL, transform, table spec)
ENTITIES = {
    "campaign_daily": (
        queries.CAMPAIGN_DAILY,
        transforms.campaign_row,
        schemas.GOOGLE_ADS_CAMPAIGN_DAILY,
    ),
    "ad_group_daily": (
        queries.AD_GROUP_DAILY,
        transforms.ad_group_row,
        schemas.GOOGLE_ADS_AD_GROUP_DAILY,
    ),
    "keyword_daily": (
        queries.KEYWORD_DAILY,
        transforms.keyword_row,
        schemas.GOOGLE_ADS_KEYWORD_DAILY,
    ),
    "search_terms_daily": (
        queries.SEARCH_TERMS_DAILY,
        transforms.search_term_row,
        schemas.GOOGLE_ADS_SEARCH_TERMS_DAILY,
    ),
    "conversion_action_daily": (
        queries.CONVERSION_ACTION_DAILY,
        transforms.conversion_action_row,
        schemas.GOOGLE_ADS_CONVERSION_ACTION_DAILY,
    ),
}

_client_cache: dict[str, object] = {}


def _get_client(creds: dict[str, str]):
    key = creds["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]
    if key not in _client_cache:
        _client_cache[key] = gclient.build_client(creds)
    return _client_cache[key]


def sync_unit(
    wh: Warehouse,
    creds: dict[str, str],
    account_id: str,
    entity: str,
    window_start: dt.date,
    window_end: dt.date,
    run_id: str,
) -> base.SyncResult:
    gaql, transform, spec = ENTITIES[entity]
    result = base.SyncResult(
        platform="google_ads",
        account_id=account_id,
        entity=entity,
        window_start=window_start,
        window_end=window_end,
    )
    try:
        client = _get_client(creds)
        query = gaql.format(start=window_start.isoformat(), end=window_end.isoformat())
        synced_at = dt.datetime.now(dt.timezone.utc).isoformat()

        def fetch() -> list[dict]:
            rows = []
            for proto_row in gclient.search_stream(client, account_id, query):
                row = transform(proto_row, account_id)
                row["synced_at"] = synced_at
                rows.append(row)
            return rows

        raw_rows = base.call_with_retry(
            fetch, context=f"google_ads:{account_id}:{entity}"
        )
        valid, rejected, reasons = base.validate_rows(
            raw_rows, spec.key, window_start, window_end
        )
        # Full window fetched and validated — only now touch the warehouse.
        wh.replace_window(spec, account_id, window_start, window_end, valid)
        result.rows_written = len(valid)
        result.rows_rejected = rejected
        result.status = "partial" if rejected else "success"
        if rejected:
            result.error_message = f"rejected rows: {reasons}"
        log(
            "sync_unit_done",
            platform="google_ads",
            account_id=account_id,
            entity=entity,
            rows_written=len(valid),
            rows_rejected=rejected,
        )
    except base.AuthAPIError as exc:
        result.status = "failed"
        result.error_message = f"auth_error: {exc}"
        wh.touch_credential("google_ads", error=str(exc))
        log(
            "sync_unit_auth_error",
            level="error",
            platform="google_ads",
            account_id=account_id,
            entity=entity,
            error=str(exc)[:500],
        )
    except Exception as exc:
        result.status = "failed"
        result.error_message = str(exc)
        log(
            "sync_unit_failed",
            level="error",
            platform="google_ads",
            account_id=account_id,
            entity=entity,
            error=str(exc)[:500],
        )
    result.finish()
    wh.insert_sync_log(result.to_log_row(run_id))
    return result


def sync_account(
    wh: Warehouse,
    creds: dict[str, str],
    account_id: str,
    window_start: dt.date,
    window_end: dt.date,
    run_id: str,
) -> list[base.SyncResult]:
    results = []
    for entity in ENTITIES:
        results.append(
            sync_unit(wh, creds, account_id, entity, window_start, window_end, run_id)
        )
    if all(r.status != "failed" for r in results):
        wh.touch_credential("google_ads")
    return results
