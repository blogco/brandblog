#!/usr/bin/env python3
"""Verify that every internal link in the built site resolves to a file.

Usage:  python scripts/linkcheck.py [output_dir]

Checks href/src attributes in output HTML, skipping external URLs, mailto/tel,
data URIs and pure fragments. Exits non-zero if any internal link is broken.
"""

from __future__ import annotations

import os
import re
import sys
from html.parser import HTMLParser

ROOT = sys.argv[1] if len(sys.argv) > 1 else "output"

_SKIP_PREFIXES = ("http://", "https://", "//", "mailto:", "tel:", "data:", "javascript:")


def target_exists(path: str, basefile: str | None = None) -> bool:
    clean = path.split("#", 1)[0].split("?", 1)[0]
    if not clean:
        return True
    if clean.startswith("/"):
        # Site-absolute link (e.g. /news/): resolve from the build root.
        rel = clean.lstrip("/")
        candidates = [
            os.path.join(ROOT, rel),
            os.path.join(ROOT, rel, "index.html"),
            os.path.join(ROOT, rel.rstrip("/"), "index.html"),
        ]
    else:
        # Relative link (e.g. ./../ or ./page.html): resolve from the
        # directory of the HTML file that contains it.
        base = os.path.dirname(basefile or "")
        joined = os.path.normpath(os.path.join(base, clean))
        candidates = [
            joined,
            os.path.join(joined, "index.html"),
        ]
    return any(os.path.isfile(c) for c in candidates)


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("href", "src") and value:
                self.links.append(value)


def main() -> int:
    if not os.path.isdir(ROOT):
        print(f"error: '{ROOT}' not found — build the site first.", file=sys.stderr)
        return 2

    checked = 0
    broken: list[tuple[str, str]] = []

    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            if not name.endswith(".html"):
                continue
            filepath = os.path.join(dirpath, name)
            with open(filepath, encoding="utf-8") as handle:
                parser = _LinkParser()
                parser.feed(handle.read())
            for link in parser.links:
                if link.startswith(_SKIP_PREFIXES) or link.startswith("#"):
                    continue
                checked += 1
                if not target_exists(link, filepath):
                    broken.append((filepath, link))

    print(f"checked {checked} internal links across '{ROOT}/'")
    if broken:
        print("BROKEN LINKS:")
        for filepath, link in broken:
            print(f"  {filepath} -> {link}")
        return 1
    print("all internal links resolve OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
