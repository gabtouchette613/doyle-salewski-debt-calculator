"""Guard the SQL metric conventions: every ratio is computed with SAFE_DIVIDE
(NULL, never divide-by-zero errors) and CPL/CPA use NULLIF so zero-lead days
read as NULL rather than 0 or infinity."""
import re
from pathlib import Path

VIEWS_DIR = Path(__file__).resolve().parents[1] / "sql" / "views"
RATIO_COLUMNS = ("ctr", "cpc", "cpm", "cpl", "cpa", "conversion_rate")


def _view_files():
    files = sorted(VIEWS_DIR.glob("*.sql"))
    assert files, "no view SQL files found"
    return files


def test_expected_views_exist():
    names = {f.stem for f in _view_files()}
    assert names == {
        "client_summary",
        "campaign_performance",
        "platform_comparison",
        "google_search_terms",
        "keyword_performance",
        "meta_ad_performance",
        "conversion_actions",
    }


def test_ratio_columns_use_safe_divide():
    for f in _view_files():
        text = f.read_text()
        for line in text.splitlines():
            for col in RATIO_COLUMNS:
                if re.search(rf"\bAS\s+{col}\b", line, flags=re.IGNORECASE):
                    assert "SAFE_DIVIDE" in line, f"{f.name}: {col} not SAFE_DIVIDE"


def test_cpl_is_null_when_no_leads():
    for f in _view_files():
        for line in f.read_text().splitlines():
            if re.search(r"\bAS\s+cpl\b", line, flags=re.IGNORECASE):
                assert "NULLIF" in line, f"{f.name}: cpl must NULLIF(leads, 0)"


def test_views_only_read_core_and_raw():
    # Views must not reference ops tables (dashboards never see internals).
    for f in _view_files():
        assert "{ops}" not in f.read_text(), f"{f.name} references ops dataset"
