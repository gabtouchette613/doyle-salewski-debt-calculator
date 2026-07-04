"""Single source of truth for every BigQuery table: columns, partitioning,
clustering, and the logical uniqueness key enforced by the delete+insert
window pattern. DDL is generated from these specs by pipeline.jobs.create_all
(the committed sql/ddl/tables.sql is the rendered reference copy)."""
from __future__ import annotations

from dataclasses import dataclass, field

Column = tuple[str, str]  # (name, BigQuery type)


@dataclass(frozen=True)
class TableSpec:
    name: str
    dataset: str  # "raw" | "core" | "ops"
    columns: tuple[Column, ...]
    partition: str | None = None  # expression for PARTITION BY
    cluster: tuple[str, ...] = ()
    key: tuple[str, ...] = ()  # logical uniqueness contract


_SYNCED: tuple[Column, ...] = (("synced_at", "TIMESTAMP"),)

_GOOGLE_METRICS: tuple[Column, ...] = (
    ("impressions", "INT64"),
    ("clicks", "INT64"),
    ("cost", "NUMERIC"),
    ("conversions", "FLOAT64"),
    ("conversion_value", "NUMERIC"),
)

_META_METRICS: tuple[Column, ...] = (
    ("spend", "NUMERIC"),
    ("impressions", "INT64"),
    ("clicks", "INT64"),
    ("link_clicks", "INT64"),
    ("reach", "INT64"),
    ("frequency", "FLOAT64"),
    ("conversions", "FLOAT64"),
    ("leads", "FLOAT64"),
    ("calls", "FLOAT64"),
    ("forms", "FLOAT64"),
    ("purchases", "FLOAT64"),
    ("conversion_value", "NUMERIC"),
    ("raw_actions_json", "JSON"),
)


CLIENTS = TableSpec(
    name="clients",
    dataset="core",
    columns=(
        ("client_id", "STRING"),
        ("client_name", "STRING"),
        ("status", "STRING"),
        ("currency", "STRING"),
        ("timezone", "STRING"),
        ("vertical", "STRING"),
        ("created_at", "TIMESTAMP"),
        ("notes", "STRING"),
    ),
    key=("client_id",),
)

PLATFORM_ACCOUNTS = TableSpec(
    name="platform_accounts",
    dataset="core",
    columns=(
        ("account_key", "STRING"),
        ("client_id", "STRING"),
        ("platform", "STRING"),
        ("account_id", "STRING"),
        ("account_name", "STRING"),
        ("currency", "STRING"),
        ("timezone", "STRING"),
        ("status", "STRING"),
        ("login_customer_id", "STRING"),
        ("created_at", "TIMESTAMP"),
    ),
    key=("account_key",),
)

CONVERSION_ACTION_MAP = TableSpec(
    name="conversion_action_map",
    dataset="core",
    columns=(
        ("platform", "STRING"),
        ("account_id", "STRING"),
        ("source_key", "STRING"),
        ("source_name", "STRING"),
        ("category", "STRING"),  # lead | call | form | purchase | other
        ("counts_as_lead", "BOOL"),
        ("is_primary", "BOOL"),
        ("updated_at", "TIMESTAMP"),
    ),
    key=("platform", "account_id", "source_key"),
)

GOOGLE_ADS_CAMPAIGN_DAILY = TableSpec(
    name="google_ads_campaign_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("campaign_status", "STRING"),
        ("advertising_channel_type", "STRING"),
        ("budget_amount", "NUMERIC"),
    )
    + _GOOGLE_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "campaign_id"),
    key=("date", "account_id", "campaign_id"),
)

GOOGLE_ADS_AD_GROUP_DAILY = TableSpec(
    name="google_ads_ad_group_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("ad_group_id", "STRING"),
        ("ad_group_name", "STRING"),
        ("ad_group_status", "STRING"),
    )
    + _GOOGLE_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "ad_group_id"),
    key=("date", "account_id", "ad_group_id"),
)

GOOGLE_ADS_KEYWORD_DAILY = TableSpec(
    name="google_ads_keyword_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("ad_group_id", "STRING"),
        ("ad_group_name", "STRING"),
        ("criterion_id", "STRING"),
        ("keyword_text", "STRING"),
        ("match_type", "STRING"),
        ("keyword_status", "STRING"),
        ("quality_score", "INT64"),
    )
    + _GOOGLE_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "ad_group_id"),
    key=("date", "account_id", "ad_group_id", "criterion_id"),
)

GOOGLE_ADS_SEARCH_TERMS_DAILY = TableSpec(
    name="google_ads_search_terms_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("ad_group_id", "STRING"),
        ("ad_group_name", "STRING"),
        ("search_term", "STRING"),
        ("search_term_match_type", "STRING"),
        ("search_term_status", "STRING"),
    )
    + _GOOGLE_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "ad_group_id"),
    key=("date", "account_id", "ad_group_id", "search_term", "search_term_match_type"),
)

GOOGLE_ADS_CONVERSION_ACTION_DAILY = TableSpec(
    name="google_ads_conversion_action_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("conversion_action_id", "STRING"),
        ("conversion_action_name", "STRING"),
        ("conversion_action_category", "STRING"),
        ("conversions", "FLOAT64"),
        ("conversion_value", "NUMERIC"),
        ("all_conversions", "FLOAT64"),
    )
    + _SYNCED,
    partition="date",
    cluster=("account_id", "campaign_id"),
    key=("date", "account_id", "campaign_id", "conversion_action_id"),
)

META_CAMPAIGN_DAILY = TableSpec(
    name="meta_campaign_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("campaign_status", "STRING"),
        ("objective", "STRING"),
        ("daily_budget", "NUMERIC"),
    )
    + _META_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "campaign_id"),
    key=("date", "account_id", "campaign_id"),
)

META_ADSET_DAILY = TableSpec(
    name="meta_adset_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("adset_id", "STRING"),
        ("adset_name", "STRING"),
        ("adset_status", "STRING"),
        ("daily_budget", "NUMERIC"),
    )
    + _META_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "adset_id"),
    key=("date", "account_id", "adset_id"),
)

META_AD_DAILY = TableSpec(
    name="meta_ad_daily",
    dataset="raw",
    columns=(
        ("date", "DATE"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("adset_id", "STRING"),
        ("adset_name", "STRING"),
        ("ad_id", "STRING"),
        ("ad_name", "STRING"),
        ("ad_status", "STRING"),
        ("creative_id", "STRING"),
    )
    + _META_METRICS
    + _SYNCED,
    partition="date",
    cluster=("account_id", "ad_id"),
    key=("date", "account_id", "ad_id"),
)

NORMALIZED_DAILY_PERFORMANCE = TableSpec(
    name="normalized_daily_performance",
    dataset="core",
    columns=(
        ("date", "DATE"),
        ("client_id", "STRING"),
        ("platform", "STRING"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("channel", "STRING"),  # search | pmax | display | video | social | other
        ("currency", "STRING"),
        ("spend", "NUMERIC"),
        ("impressions", "INT64"),
        ("clicks", "INT64"),
        ("conversions", "FLOAT64"),
        ("leads", "FLOAT64"),
        ("calls", "FLOAT64"),
        ("forms", "FLOAT64"),
        ("conversion_value", "NUMERIC"),
    )
    + _SYNCED,
    partition="date",
    cluster=("client_id", "platform"),
    key=("date", "platform", "account_id", "campaign_id"),
)

DATA_SYNC_LOGS = TableSpec(
    name="data_sync_logs",
    dataset="ops",
    columns=(
        ("sync_id", "STRING"),
        ("run_id", "STRING"),
        ("started_at", "TIMESTAMP"),
        ("finished_at", "TIMESTAMP"),
        ("platform", "STRING"),
        ("account_id", "STRING"),
        ("entity", "STRING"),
        ("window_start", "DATE"),
        ("window_end", "DATE"),
        ("status", "STRING"),  # success | failed | partial
        ("rows_written", "INT64"),
        ("rows_rejected", "INT64"),
        ("error_message", "STRING"),
    ),
    partition="DATE(started_at)",
    key=("sync_id",),
)

API_CREDENTIALS_METADATA = TableSpec(
    name="api_credentials_metadata",
    dataset="ops",
    columns=(
        ("credential_id", "STRING"),
        ("platform", "STRING"),
        ("credential_type", "STRING"),
        ("secret_location", "STRING"),
        ("scopes", "STRING"),
        ("expires_at", "TIMESTAMP"),
        ("last_validated_at", "TIMESTAMP"),
        ("last_error", "STRING"),
        ("notes", "STRING"),
    ),
    key=("credential_id",),
)

QA_ALERTS = TableSpec(
    name="qa_alerts",
    dataset="ops",
    columns=(
        ("alert_id", "STRING"),
        ("detected_at", "TIMESTAMP"),
        ("alert_date", "DATE"),
        ("client_id", "STRING"),
        ("platform", "STRING"),
        ("account_id", "STRING"),
        ("campaign_id", "STRING"),
        ("campaign_name", "STRING"),
        ("alert_type", "STRING"),
        ("severity", "STRING"),  # info | warning | critical
        ("metric_value", "FLOAT64"),
        ("threshold_value", "FLOAT64"),
        ("message", "STRING"),
        ("status", "STRING"),  # open | acknowledged | resolved
    ),
    partition="alert_date",
    key=("alert_id",),
)

ALL_TABLES: tuple[TableSpec, ...] = (
    CLIENTS,
    PLATFORM_ACCOUNTS,
    CONVERSION_ACTION_MAP,
    GOOGLE_ADS_CAMPAIGN_DAILY,
    GOOGLE_ADS_AD_GROUP_DAILY,
    GOOGLE_ADS_KEYWORD_DAILY,
    GOOGLE_ADS_SEARCH_TERMS_DAILY,
    GOOGLE_ADS_CONVERSION_ACTION_DAILY,
    META_CAMPAIGN_DAILY,
    META_ADSET_DAILY,
    META_AD_DAILY,
    NORMALIZED_DAILY_PERFORMANCE,
    DATA_SYNC_LOGS,
    API_CREDENTIALS_METADATA,
    QA_ALERTS,
)


def build_ddl(project: str, dataset_names: dict[str, str], spec: TableSpec) -> str:
    """Render CREATE TABLE IF NOT EXISTS DDL for a spec."""
    dataset = dataset_names[spec.dataset]
    cols = ",\n  ".join(f"{name} {typ}" for name, typ in spec.columns)
    ddl = f"CREATE TABLE IF NOT EXISTS `{project}.{dataset}.{spec.name}` (\n  {cols}\n)"
    if spec.partition:
        ddl += f"\nPARTITION BY {spec.partition}"
    if spec.cluster:
        ddl += f"\nCLUSTER BY {', '.join(spec.cluster)}"
    return ddl + ";"
