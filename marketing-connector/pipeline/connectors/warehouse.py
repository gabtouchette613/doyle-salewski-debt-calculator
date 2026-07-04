"""BigQuery access: idempotent window loads, queries, sync logs, map upserts."""
from __future__ import annotations

import datetime as dt
from typing import Iterable

from pipeline.config.jsonlog import log
from pipeline.config.settings import Settings
from pipeline.models.schemas import TableSpec


def _query_parameter(name: str, value):
    from google.cloud import bigquery

    if isinstance(value, bool):
        return bigquery.ScalarQueryParameter(name, "BOOL", value)
    if isinstance(value, dt.date) and not isinstance(value, dt.datetime):
        return bigquery.ScalarQueryParameter(name, "DATE", value)
    if isinstance(value, dt.datetime):
        return bigquery.ScalarQueryParameter(name, "TIMESTAMP", value)
    if isinstance(value, int):
        return bigquery.ScalarQueryParameter(name, "INT64", value)
    if isinstance(value, float):
        return bigquery.ScalarQueryParameter(name, "FLOAT64", value)
    if isinstance(value, (list, tuple)):
        return bigquery.ArrayQueryParameter(name, "STRING", [str(v) for v in value])
    return bigquery.ScalarQueryParameter(name, "STRING", str(value))


class Warehouse:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from google.cloud import bigquery

            self._client = bigquery.Client(
                project=self.settings.bq_project_id,
                location=self.settings.bq_location,
            )
        return self._client

    # ── naming helpers ──────────────────────────────────────────────────────

    @property
    def dataset_names(self) -> dict[str, str]:
        s = self.settings
        return {
            "raw": s.dataset_raw,
            "core": s.dataset_core,
            "ops": s.dataset_ops,
            "dash": s.dataset_dash,
        }

    def table_fqn(self, spec: TableSpec) -> str:
        return f"{self.settings.bq_project_id}.{self.dataset_names[spec.dataset]}.{spec.name}"

    def render(self, sql: str) -> str:
        """Substitute {project}/{raw}/{core}/{ops}/{dash} placeholders."""
        s = self.settings
        return sql.format(
            project=s.bq_project_id,
            raw=s.dataset_raw,
            core=s.dataset_core,
            ops=s.dataset_ops,
            dash=s.dataset_dash,
        )

    # ── generic execution ───────────────────────────────────────────────────

    def execute(self, sql: str, params: dict | None = None):
        """Run a rendered statement (or multi-statement script); return the job."""
        from google.cloud import bigquery

        job_config = bigquery.QueryJobConfig()
        if params:
            job_config.query_parameters = [
                _query_parameter(k, v) for k, v in params.items()
            ]
        job = self.client.query(self.render(sql), job_config=job_config)
        job.result()
        return job

    def query(self, sql: str, params: dict | None = None) -> list[dict]:
        job = self.execute(sql, params)
        return [dict(row) for row in job.result()]

    # ── dataset / table management ──────────────────────────────────────────

    def ensure_datasets(self) -> None:
        from google.cloud import bigquery

        for name in self.dataset_names.values():
            dataset = bigquery.Dataset(f"{self.settings.bq_project_id}.{name}")
            dataset.location = self.settings.bq_location
            self.client.create_dataset(dataset, exists_ok=True)
            log("dataset_ready", dataset=name)

    # ── idempotent window load ──────────────────────────────────────────────

    @staticmethod
    def window_delete_sql(table_fqn: str) -> str:
        return (
            f"DELETE FROM `{table_fqn}` "
            "WHERE account_id = @account_id AND date BETWEEN @window_start AND @window_end"
        )

    def replace_window(
        self,
        spec: TableSpec,
        account_id: str,
        window_start: dt.date,
        window_end: dt.date,
        rows: list[dict],
    ) -> None:
        """Delete the (account, window) slice, then batch-load fresh rows.

        Callers must fetch and validate the full window before calling this —
        a partial window must never be written.
        """
        from google.cloud import bigquery

        fqn = self.table_fqn(spec)
        self.execute(
            self.window_delete_sql(fqn),
            {
                "account_id": account_id,
                "window_start": window_start,
                "window_end": window_end,
            },
        )
        if not rows:
            return
        schema = [bigquery.SchemaField(name, typ) for name, typ in spec.columns]
        job_config = bigquery.LoadJobConfig(
            schema=schema,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        )
        load_job = self.client.load_table_from_json(rows, fqn, job_config=job_config)
        load_job.result()

    # ── operational writes ──────────────────────────────────────────────────

    def insert_sync_log(self, row: dict) -> None:
        from pipeline.models.schemas import DATA_SYNC_LOGS

        errors = self.client.insert_rows_json(self.table_fqn(DATA_SYNC_LOGS), [row])
        if errors:
            log("sync_log_insert_failed", level="error", errors=str(errors)[:500])

    def upsert_conversion_actions(
        self, platform: str, account_id: str, source_keys: Iterable[str]
    ) -> int:
        """Insert unseen conversion actions as category='other' (never map-drop)."""
        keys = sorted({k for k in source_keys if k})
        if not keys:
            return 0
        sql = """
        MERGE `{project}.{core}.conversion_action_map` m
        USING (
          SELECT @platform AS platform, @account_id AS account_id,
                 k AS source_key, k AS source_name
          FROM UNNEST(@keys) AS k
        ) s
        ON m.platform = s.platform AND m.account_id = s.account_id
           AND m.source_key = s.source_key
        WHEN NOT MATCHED THEN INSERT
          (platform, account_id, source_key, source_name, category,
           counts_as_lead, is_primary, updated_at)
        VALUES (s.platform, s.account_id, s.source_key, s.source_name, 'other',
                FALSE, FALSE, CURRENT_TIMESTAMP())
        """
        job = self.execute(
            sql, {"platform": platform, "account_id": account_id, "keys": keys}
        )
        inserted = job.num_dml_affected_rows or 0
        if inserted:
            log(
                "unmapped_conversion_actions_added",
                level="warning",
                platform=platform,
                account_id=account_id,
                count=inserted,
                keys=keys[:20],
            )
        return inserted

    def touch_credential(self, platform: str, error: str | None = None) -> None:
        """Record credential health; never stores secret values."""
        if error:
            sql = """
            UPDATE `{project}.{ops}.api_credentials_metadata`
            SET last_error = @error
            WHERE platform = @platform
            """
            self.execute(sql, {"platform": platform, "error": error[:1000]})
        else:
            sql = """
            UPDATE `{project}.{ops}.api_credentials_metadata`
            SET last_validated_at = CURRENT_TIMESTAMP(), last_error = NULL
            WHERE platform = @platform
            """
            self.execute(sql, {"platform": platform})
