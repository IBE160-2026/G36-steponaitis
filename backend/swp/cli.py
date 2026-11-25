"""Command line: `swp db upgrade` and `swp openapi`."""

import argparse
import json
import sys

from swp.api.request_log import configure_logging
from swp.app.bootstrap import bootstrap
from swp.app.startup import StartupRefused, check_startup


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="swp")
    sub = parser.add_subparsers(dest="command", required=True)
    db = sub.add_parser("db", help="Database commands")
    db_sub = db.add_subparsers(dest="db_command", required=True)
    db_sub.add_parser("upgrade", help="Run migrations to head")
    sub.add_parser("openapi", help="Print the OpenAPI schema as JSON")

    args = parser.parse_args(argv)
    if args.command == "db" and args.db_command == "upgrade":
        # AD-10/NFR-6: never migrate or seed on settings production would refuse.
        # check_startup logs one `Refusing to start: …` line per problem through the `swp`
        # handler (without it, logging's lastResort would print them to stderr as well).
        configure_logging()
        try:
            check_startup()
        except StartupRefused:
            return 2
        bootstrap(upgrade=True, seed=True)
    elif args.command == "openapi":
        from swp.api.app import create_app

        json.dump(create_app(check_settings=False).openapi(), sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
