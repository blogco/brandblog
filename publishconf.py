# -*- coding: utf-8 -*-
"""Pelican configuration — production build.

Set SITEURL to your deployed origin before building, e.g.:
    SITEURL=https://blogco.github.io/brandblog pelican content -s publishconf.py -o output
"""

import os
import sys

# Ensure the project root is importable when Pelican loads this file directly.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pelicanconf import *  # noqa: E402,F401,F403

# ---------------------------------------------------------------------------
# Production URL (override via the SITEURL environment variable in CI)
# ---------------------------------------------------------------------------
SITEURL = os.environ.get("SITEURL", "https://blogco.github.io/brandblog")
RELATIVE_URLS = False

# ---------------------------------------------------------------------------
# Production toggles
# ---------------------------------------------------------------------------
OUTPUT_PATH = "output"
DELETE_OUTPUT_DIRECTORY = True

# Honour the production origin for feeds/OG metadata.
FEED_ALL_ATOM = "feeds/all.atom.xml"
