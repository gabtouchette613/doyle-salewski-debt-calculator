"""Meta sync units: fetch insights + metadata → map actions → validate →
delete+insert → log. Unmapped action types are upserted into the map."""
from __future__ import annotations

import datetime as dt

from pipeline.config.jsonlog import log
from pipeline.connectors import base
from pipeline.connectors.meta import client as mclient
from pipeline.connectors.meta import transforms
from pipeline.connectors.warehouse import Warehouse
from pipeline.models import schemas

# level -> (transform, table spec)
ENTITIES = {
    "campaign": (transforms.campaign_row, schemas.META_CAMPAIGN_DAILY),
    "adset": (transforms.adset_row, schemas.META_ADSET_DAILY),
    "ad": (transforms.ad_row, schemas.META_AD_DAILY),
}

_api_initialized = False


def _ensure_api(creds: dict[str, str]) -> None:
    global _api_initialized
    if not _api_initialized:
        mclient.init_api(creds)
        _api_initialized = True


def load_action_mapping(wh: Warehouse, account_id: str) -> dict[str, dict]:
    rows = wh.query(
        """
        SELECT source_key, category, counts_as_lead
        FROM `{project}.{core}.conversion_action_map`
        WHERE platform = 'meta' AND account_id = @account_id
        """,
        {"account_id": account_id},
    )
    return {
        r["source_key"]: {
            "category": r["category"],
            "counts_as_lead": bool(r["counts_as_lead"]),
        }
        for r in rows
    }


def sync_unit(
    wh: Warehouse,
    account_id: str,
    level: str,
    window_start: dt.date,
    window_end: dt.date,
    run_id: str,
    metadata: dict,
    mapping: dict[str, dict],
) -> tuple[base.SyncResult, set[str]]:
    transform, spec = ENTITIES[level]
    entity = f"{level}_daily"
    result = base.SyncResult(
        platform="meta",
        account_id=account_id,
        entity=entity,
        window_start=window_start,
        window_end=window_end,
    )
    unmapped_all: set[str] = set()
    try:
        synced_at = dt.datetime.now(dt.timezone.utc).isoformat()
        since, until = window_start.isoformat(), window_end.isoformat()

        attempts = {"n": 0}

        def fetch() -> list[dict]:
            # Fall back to the async report job after the first sync failure.
            attempts["n"] += 1
            return mclient.fetch_insights(
                account_id, level, since, until, use_async=attempts["n"] > 1
            )

        insights = base.call_with_retry(fetch, context=f"meta:{account_id}:{entity}")

        rows = []
        for insight in insights:
            row, unmapped = transform(insight, account_id, metadata[level], mapping)
            row["synced_at"] = synced_at
            rows.append(row)
            unmapped_all |= unmapped

        valid, rejected, reasons = base.validate_rows(
            rows, spec.key, window_start, window_end
        )
        wh.replace_window(spec, account_id, window_start, window_end, valid)
        result.rows_written = len(valid)
        result.rows_rejected = rejected
        result.status = "partial" if rejected else "success"
        if rejected:
            result.error_message = f"rejected rows: {reasons}"
        log(
            "sync_unit_done",
            platform="meta",
            account_id=account_id,
            entity=entity,
            rows_written=len(valid),
            rows_rejected=rejected,
            unmapped_action_types=len(unmapped_all),
        )
    except base.AuthAPIError as exc:
        result.status = "failed"
        result.error_message = f"auth_error: {exc}"
        wh.touch_credential("meta", error=str(exc))
        log(
            "sync_unit_auth_error",
            level="error",
            platform="meta",
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
            platform="meta",
            account_id=account_id,
            entity=entity,
            error=str(exc)[:500],
        )
    result.finish()
    wh.insert_sync_log(result.to_log_row(run_id))
    return result, unmapped_all


def sync_account(
    wh: Warehouse,
    creds: dict[str, str],
    account_id: str,
    window_start: dt.date,
    window_end: dt.date,
    run_id: str,
) -> list[base.SyncResult]:
    _ensure_api(creds)
    results: list[base.SyncResult] = []
    unmapped_all: set[str] = set()

    try:
        mapping = load_action_mapping(wh, account_id)
        metadata = base.call_with_retry(
            lambda: mclient.fetch_entity_metadata(account_id),
            context=f"meta:{account_id}:metadata",
        )
    except Exception as exc:
        # Without metadata no level can be synced; log one failed unit per level.
        for level in ENTITIES:
            result = base.SyncResult(
                platform="meta",
                account_id=account_id,
                entity=f"{level}_daily",
                window_start=window_start,
                window_end=window_end,
                status="failed",
                error_message=f"metadata fetch failed: {exc}",
            ).finish()
            wh.insert_sync_log(result.to_log_row(run_id))
            results.append(result)
        if isinstance(exc, base.AuthAPIError):
            wh.touch_credential("meta", error=str(exc))
        log(
            "meta_account_failed",
            level="error",
            account_id=account_id,
            error=str(exc)[:500],
        )
        return results

    for level in ENTITIES:
        result, unmapped = sync_unit(
            wh, account_id, level, window_start, window_end, run_id, metadata, mapping
        )
        results.append(result)
        unmapped_all |= unmapped

    if unmapped_all:
        wh.upsert_conversion_actions("meta", account_id, unmapped_all)
    if all(r.status != "failed" for r in results):
        wh.touch_credential("meta")
    return results
