"""Pytest hooks — self-provision ephemeral PostgreSQL for race gate tests."""

import atexit
import glob
import os
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path

_PG = {}  # holds ephemeral cluster state for teardown


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _find_bin(name: str):
    """Locate a Postgres server binary without requiring Docker.

    Prefer full server installs (Cellar) over client-only libpq shims on PATH."""
    for pat in (
        "/opt/homebrew/Cellar/postgresql@*/*/bin/",
        "/usr/local/Cellar/postgresql@*/*/bin/",
        "/usr/lib/postgresql/*/bin/",
    ):
        for d in sorted(glob.glob(pat), reverse=True):
            cand = Path(d) / name
            if cand.exists():
                return str(cand)
    found = shutil.which(name)
    if found and "/opt/libpq/" not in found:
        return found
    return None


def _bootstrap_ephemeral_postgres():
    """initdb + pg_ctl start an ephemeral cluster from local binaries.

    Returns a SQLAlchemy URL, or None if binaries are unavailable
    (tests then skip gracefully — same as before)."""
    initdb, pg_ctl, psql = _find_bin("initdb"), _find_bin("pg_ctl"), _find_bin("psql")
    if not (initdb and pg_ctl and psql):
        return None
    datadir = tempfile.mkdtemp(prefix="benngoan_pg_")
    subprocess.run(
        [initdb, "-D", datadir, "-U", "postgres", "--auth=trust", "-E", "UTF8"],
        check=True,
        capture_output=True,
    )
    port = _free_port()
    logfile = os.path.join(datadir, "server.log")
    subprocess.run(
        [
            pg_ctl,
            "-D",
            datadir,
            "-l",
            logfile,
            "-w",
            "-o",
            f"-p {port} -k {datadir} -c listen_addresses=127.0.0.1",
            "start",
        ],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        [
            psql,
            "-h",
            "127.0.0.1",
            "-p",
            str(port),
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-c",
            "CREATE DATABASE benngoan",
        ],
        check=True,
        capture_output=True,
    )
    _PG.update(datadir=datadir, pg_ctl=pg_ctl)
    return f"postgresql+psycopg2://postgres@127.0.0.1:{port}/benngoan"


def _teardown_ephemeral_postgres():
    if not _PG:
        return
    subprocess.run(
        [_PG["pg_ctl"], "-D", _PG["datadir"], "-m", "immediate", "stop"],
        capture_output=True,
    )
    shutil.rmtree(_PG["datadir"], ignore_errors=True)
    _PG.clear()


def pytest_configure(config):
    # Respect an externally-provided DB (e.g. CI service). Otherwise
    # self-provision so `pytest` reproducibly runs the race gate.
    if os.environ.get("TEST_DATABASE_URL"):
        return
    url = _bootstrap_ephemeral_postgres()
    if url:
        os.environ["TEST_DATABASE_URL"] = url
        atexit.register(_teardown_ephemeral_postgres)


def pytest_unconfigure(config):
    _teardown_ephemeral_postgres()
