"""Create datasets, tables (from pipeline.models.schemas), and dashboard views.

  python -m pipeline.jobs.create_all            # create everything
  python -m pipeline.jobs.create_all --seed     # ...and run the Doyle Salewski seed
  python -m pipeline.jobs.create_all --print    # print DDL without connecting

The committed sql/ddl/tables.sql is the rendered reference copy of this DDL.
"""
from __future__ import annotations

import argparse
import sys

from pipeline.config.jsonlog import log
from pipeline.config.paths import SQL_DIR
from pipeline.config.settings import Settings
from pipeline.models.schemas import ALL_TABLES, build_ddl


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="Run sql/seeds/doyle_salewski.sql")
    parser.add_argument("--print", dest="print_only", action="store_true")
    args = parser.parse_args(argv)

    settings = Settings.from_env()
    dataset_names = {
        "raw": settings.dataset_raw,
        "core": settings.dataset_core,
        "ops": settings.dataset_ops,
        "dash": settings.dataset_dash,
    }

    ddl_statements = [
        build_ddl(settings.bq_project_id, dataset_names, spec) for spec in ALL_TABLES
    ]
    view_files = sorted((SQL_DIR / "views").glob("*.sql"))

    if args.print_only:
        for stmt in ddl_statements:
            print(stmt + "\n")
        for f in view_files:
            print(f.read_text() + "\n")
        return 0

    from pipeline.connectors.warehouse import Warehouse

    wh = Warehouse(settings)
    wh.ensure_datasets()
    for spec, stmt in zip(ALL_TABLES, ddl_statements):
        wh.execute(stmt)
        log("table_ready", table=spec.name, dataset=dataset_names[spec.dataset])
    for f in view_files:
        wh.execute(f.read_text())
        log("view_ready", view=f.stem)
    if args.seed:
        wh.execute((SQL_DIR / "seeds" / "doyle_salewski.sql").read_text())
        log("seed_applied", seed="doyle_salewski")
    return 0


if __name__ == "__main__":
    sys.exit(main())
