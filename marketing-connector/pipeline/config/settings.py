"""Typed configuration loaded from environment variables (.env supported)."""
from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(RuntimeError):
    """A required environment variable is missing or malformed."""


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass


def _get(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is not None and value.strip():
        return value.strip()
    return default


def _get_float(name: str, default: float) -> float:
    raw = _get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number, got {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    bq_project_id: str
    bq_location: str
    dataset_raw: str
    dataset_core: str
    dataset_ops: str
    dataset_dash: str

    google_ads_developer_token: str | None
    google_ads_client_id: str | None
    google_ads_client_secret: str | None
    google_ads_refresh_token: str | None
    google_ads_login_customer_id: str | None

    meta_app_id: str | None
    meta_app_secret: str | None
    meta_access_token: str | None

    default_lookback_days: int
    alert_spend_no_conv_min: float
    alert_cpl_spike_mult: float
    alert_stopped_min_daily: float

    @classmethod
    def from_env(cls) -> "Settings":
        _load_dotenv()
        project = _get("BQ_PROJECT_ID")
        if not project:
            raise ConfigError("Missing required environment variable: BQ_PROJECT_ID")
        return cls(
            bq_project_id=project,
            bq_location=_get("BQ_LOCATION", "US"),
            dataset_raw=_get("BQ_DATASET_RAW", "raw"),
            dataset_core=_get("BQ_DATASET_CORE", "core"),
            dataset_ops=_get("BQ_DATASET_OPS", "ops"),
            dataset_dash=_get("BQ_DATASET_DASH", "dash"),
            google_ads_developer_token=_get("GOOGLE_ADS_DEVELOPER_TOKEN"),
            google_ads_client_id=_get("GOOGLE_ADS_CLIENT_ID"),
            google_ads_client_secret=_get("GOOGLE_ADS_CLIENT_SECRET"),
            google_ads_refresh_token=_get("GOOGLE_ADS_REFRESH_TOKEN"),
            google_ads_login_customer_id=_get("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
            meta_app_id=_get("META_APP_ID"),
            meta_app_secret=_get("META_APP_SECRET"),
            meta_access_token=_get("META_ACCESS_TOKEN"),
            default_lookback_days=int(_get_float("DEFAULT_LOOKBACK_DAYS", 30)),
            alert_spend_no_conv_min=_get_float("ALERT_SPEND_NO_CONV_MIN", 150.0),
            alert_cpl_spike_mult=_get_float("ALERT_CPL_SPIKE_MULT", 2.0),
            alert_stopped_min_daily=_get_float("ALERT_STOPPED_MIN_DAILY", 20.0),
        )

    def require_google(self) -> dict[str, str]:
        creds = {
            "GOOGLE_ADS_DEVELOPER_TOKEN": self.google_ads_developer_token,
            "GOOGLE_ADS_CLIENT_ID": self.google_ads_client_id,
            "GOOGLE_ADS_CLIENT_SECRET": self.google_ads_client_secret,
            "GOOGLE_ADS_REFRESH_TOKEN": self.google_ads_refresh_token,
            "GOOGLE_ADS_LOGIN_CUSTOMER_ID": self.google_ads_login_customer_id,
        }
        missing = sorted(k for k, v in creds.items() if not v)
        if missing:
            raise ConfigError(f"Google Ads credentials missing: {', '.join(missing)}")
        return {k: v for k, v in creds.items() if v}

    def require_meta(self) -> dict[str, str]:
        creds = {
            "META_APP_ID": self.meta_app_id,
            "META_APP_SECRET": self.meta_app_secret,
            "META_ACCESS_TOKEN": self.meta_access_token,
        }
        missing = sorted(k for k, v in creds.items() if not v)
        if missing:
            raise ConfigError(f"Meta credentials missing: {', '.join(missing)}")
        return {k: v for k, v in creds.items() if v}
