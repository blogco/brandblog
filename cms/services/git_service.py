"""Git integration: status, commit, push, pull, log — via GitPython."""

from __future__ import annotations

import subprocess
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from git import Repo
from git.exc import GitCommandError, InvalidGitRepositoryError, NoSuchPathError

from cms import config


class GitError(RuntimeError):
    pass


def get_repo() -> Repo:
    try:
        return Repo(config.PROJECT_ROOT)
    except (InvalidGitRepositoryError, NoSuchPathError) as exc:  # pragma: no cover
        raise GitError(f"Not a git repository: {config.PROJECT_ROOT}") from exc


def is_repo() -> bool:
    try:
        get_repo()
        return True
    except GitError:
        return False


def _authed_url(url: str, token: str) -> str:
    if not token or "://" not in url:
        return url
    parsed = urlparse(url)
    if not parsed.hostname:
        return url
    netloc = f"{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    netloc = f"x-access-token:{token}@{netloc}"
    return urlunparse(parsed._replace(netloc=netloc))


def status() -> dict:
    repo = get_repo()
    changed = [item.a_path for item in repo.index.diff(None)]
    staged = [item.a_path for item in repo.index.diff("HEAD")]
    untracked = list(repo.untracked_files)
    try:
        branch = repo.active_branch.name
    except TypeError:  # detached HEAD
        branch = "(detached)"
    return {
        "branch": branch,
        "changed": sorted(set(changed)),
        "staged": sorted(set(staged)),
        "untracked": sorted(untracked),
        "dirty": bool(changed or staged or untracked),
    }


def _stage(paths: list[str] | None) -> None:
    repo = get_repo()
    if paths:
        for p in paths:
            if Path(p).exists():
                repo.git.add(p)
    else:
        repo.git.add("-A")


def commit(message: str, paths: list[str] | None = None) -> dict:
    if not message.strip():
        raise GitError("Commit message is required.")
    repo = get_repo()
    _stage(paths)
    if not repo.is_dirty(untracked_files=True) and not repo.index.diff("HEAD"):
        raise GitError("Nothing to commit — no changes detected.")
    repo.git.commit("-m", message)
    return {"commit": repo.head.commit.hexsha[:7], "message": message}


def push(token: str | None = None, branch: str | None = None) -> dict:
    repo = get_repo()
    token = token if token is not None else config.get_token()
    branch = branch or config.load_config().get("branch", "main")
    url = config.load_config().get("repo_url")
    try:
        if token:
            authed = _authed_url(url, token)
            repo.git.push(authed, f"HEAD:{branch}")
        else:
            repo.git.push("origin", f"HEAD:{branch}")
    except GitCommandError as exc:
        stderr = (exc.stderr or "").strip() or str(exc)
        raise GitError(_friendly_push_error(stderr)) from exc
    return {"branch": branch, "pushed": True}


def pull(token: str | None = None) -> dict:
    repo = get_repo()
    token = token if token is not None else config.get_token()
    url = config.load_config().get("repo_url")
    try:
        if token:
            repo.git.pull(_authed_url(url, token), config.load_config().get("branch", "main"))
        else:
            repo.git.pull("origin", config.load_config().get("branch", "main"))
    except GitCommandError as exc:
        raise GitError((exc.stderr or str(exc)).strip()) from exc
    return {"pulled": True}


def log(limit: int = 8) -> list[dict]:
    repo = get_repo()
    entries = []
    for commit_obj in repo.iter_commits(max_count=limit):
        entries.append(
            {
                "sha": commit_obj.hexsha[:7],
                "message": commit_obj.summary,
                "author": commit_obj.author.name,
                "date": commit_obj.committed_datetime.strftime("%Y-%m-%d %H:%M"),
            }
        )
    return entries


def publish(message: str, paths: list[str] | None = None) -> dict:
    """Commit the working tree and push to the configured branch."""
    result = commit(message, paths=paths)
    push_result = push()
    return {**result, **push_result}


def test_connection(url: str, token: str | None = None, branch: str = "main") -> dict:
    """Verify the repo is reachable (and the token authenticates)."""
    if not url:
        raise GitError("Repo URL is empty — set it in Settings.")
    target = _authed_url(url, token) if token else url
    try:
        proc = subprocess.run(
            ["git", "ls-remote", "--heads", target, branch],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as exc:  # pragma: no cover - network/timeout
        raise GitError(f"Could not reach remote: {exc}") from exc
    if proc.returncode != 0:
        raise GitError(_friendly_push_error((proc.stderr or "").strip() or "git ls-remote failed"))
    return {
        "remote": url,
        "branch": branch,
        "reachable": True,
        "branch_found": branch in (proc.stdout or ""),
        "authenticated": bool(token),
    }


def _friendly_push_error(stderr: str) -> str:
    lowered = stderr.lower()
    if "authentication" in lowered or "403" in lowered or "invalid username" in lowered:
        return "Authentication failed. Check your GitHub token in Settings (needs 'repo' + 'workflow' scope)."
    if "workflow" in lowered and "scope" in lowered:
        return "Token is missing the 'workflow' scope, which is required to update .github/workflows/."
    if "rejected" in lowered or "non-fast-forward" in lowered:
        return "Push rejected — the remote has newer commits. Try 'Pull' first."
    if "could not resolve host" in lowered or "network" in lowered:
        return "Network error — check your internet connection and try again."
    return stderr
