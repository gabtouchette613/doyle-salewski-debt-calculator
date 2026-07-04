"""Locations of non-Python assets relative to the project root."""
from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = PROJECT_ROOT / "sql"
