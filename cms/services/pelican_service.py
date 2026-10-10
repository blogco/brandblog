"""Pelican build + local preview server management."""

from __future__ import annotations

import shutil
import subprocess
import sys
import threading
from pathlib import Path

from cms import config

_lock = threading.Lock()
_preview: subprocess.Popen | None = None
_log_buffer: list[str] = []
PREVIEW_PORT = 8000


def pelican_bin() -> str:
    """Locate a usable Pelican executable."""
    candidate = Path(sys.executable).parent / "pelican"
    if candidate.exists():
        return str(candidate)
    found = shutil.which("pelican")
    if found:
        return found
    # Fall back to the blog's own virtualenv, if present.
    fallback = config.PROJECT_ROOT / ".venv" / "bin" / "pelican"
    if fallback.exists():
        return str(fallback)
    return "pelican"


def run_pelican(args: list[str], timeout: int = 180) -> dict:
    cmd = [pelican_bin(), *args]
    proc = subprocess.run(
        cmd,
        cwd=str(config.PROJECT_ROOT),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    return {"ok": proc.returncode == 0, "code": proc.returncode, "output": output.strip(), "cmd": " ".join(cmd)}


def build() -> dict:
    """Production build into output/."""
    return run_pelican(["content", "-s", "publishconf.py", "-o", "output"])


def version() -> dict:
    """Report the resolved Pelican executable and version."""
    try:
        proc = subprocess.run([pelican_bin(), "--version"], capture_output=True, text=True, timeout=30)
        text = (proc.stdout + proc.stderr).strip()
        return {"ok": proc.returncode == 0, "version": text or "(unknown)", "path": pelican_bin()}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "version": str(exc), "path": pelican_bin()}


# --------------------------------------------------------------------------- #
# Live preview server (pelican --listen --autoreload)
# --------------------------------------------------------------------------- #
def preview_running() -> bool:
    return _preview is not None and _preview.poll() is None


def start_preview(port: int = PREVIEW_PORT) -> dict:
    global _preview
    with _lock:
        if preview_running():
            return {"ok": True, "already_running": True, "url": f"http://localhost:{port}"}
        cmd = [pelican_bin(), "content", "-s", "pelicanconf.py", "-l", "-r", "--port", str(port)]
        log_path = config.PROJECT_ROOT / ".cms_preview.log"
        log_file = open(log_path, "w", encoding="utf-8")  # noqa: SIM115 - held for process lifetime
        _preview = subprocess.Popen(
            cmd,
            cwd=str(config.PROJECT_ROOT),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )
    return {"ok": True, "url": f"http://localhost:{port}"}


def stop_preview() -> dict:
    global _preview
    with _lock:
        if _preview and _preview.poll() is None:
            _preview.terminate()
            try:
                _preview.wait(timeout=5)
            except subprocess.TimeoutExpired:  # pragma: no cover
                _preview.kill()
        _preview = None
    return {"ok": True}


def preview_status() -> dict:
    return {"running": preview_running(), "url": f"http://localhost:{PREVIEW_PORT}"}


def preview_output(tail: int = 40) -> str:
    log_path = config.PROJECT_ROOT / ".cms_preview.log"
    if not log_path.exists():
        return ""
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:  # pragma: no cover
        return ""
    return "\n".join(lines[-tail:])
