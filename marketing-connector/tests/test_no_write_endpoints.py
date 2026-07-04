"""Read-only guard: the pipeline must never gain the ability to write to the
ad platforms. Fails if any source file references a write/mutation surface of
the Google Ads or Meta SDKs, or requests a Meta write scope."""
import re
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1] / "pipeline"

FORBIDDEN_PATTERNS = [
    r"mutate",                # Google Ads mutate services/requests
    r"MutateOperation",
    r"ads_management",        # Meta write scope
    r"remote_create",         # facebook_business write helpers
    r"remote_update",
    r"remote_delete",
    r"\bapi_create\b",
    r"\bapi_update\b",
    r"\bapi_delete\b",
]


def test_no_platform_write_surface_referenced():
    offenders = []
    for path in PIPELINE_DIR.rglob("*.py"):
        text = path.read_text()
        for pattern in FORBIDDEN_PATTERNS:
            if re.search(pattern, text, flags=re.IGNORECASE):
                offenders.append(f"{path.relative_to(PIPELINE_DIR.parent)}: {pattern}")
    assert not offenders, "write-capable API usage found:\n" + "\n".join(offenders)
