# -*- coding: utf-8 -*-
"""Pelican configuration — development / preview.

Build locally with:
    pelican content -s pelicanconf.py -l -r
"""

import json
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Site metadata
# ---------------------------------------------------------------------------
AUTHOR = "BrandBlog Editorial"
SITENAME = "BrandBlog"
SITESUBTITLE = "Energy, Sustainability & Innovation Insights"
SITEDESCRIPTION = (
    "BrandBlog is a static publication covering the energy transition, "
    "sustainability and the people driving a more sustainable future — "
    "with a Siemens-inspired design system. It is an independent educational demo."
)
COPYRIGHT_YEAR = datetime.now().year

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PATH = "content"
PAGE_PATHS = ["pages"]
ARTICLE_PATHS = ["posts"]
# "cargo-simulator/index.html" is the terminal training app served at
# /cargo-simulator/. Its shared CSS and JavaScript are emitted from theme/static.
# Only the HTML is listed here so the documentation is not published with the site.
STATIC_PATHS = ["images", "data", "cargo-simulator/index.html"]
THEME = "theme"
THEME_STATIC_DIR = "static"
THEME_STATIC_PATHS = ["static"]
OUTPUT_PATH = "output"
CACHE_PATH = "cache"
LOAD_CONTENT_CACHE = False

# ---------------------------------------------------------------------------
# Localisation / dates
# ---------------------------------------------------------------------------
TIMEZONE = "Asia/Singapore"
DEFAULT_LANG = "en"
DEFAULT_DATE = "fs"
DEFAULT_DATE_FORMAT = "%B %d, %Y"

# ---------------------------------------------------------------------------
# URLs — project-page friendly (works under /brandblog/ on GitHub Pages)
# ---------------------------------------------------------------------------
SITEURL = ""
RELATIVE_URLS = False

ARTICLE_URL = "news/{date:%Y}/{slug}/"
ARTICLE_SAVE_AS = "news/{date:%Y}/{slug}/index.html"
PAGE_URL = "{slug}/"
PAGE_SAVE_AS = "{slug}/index.html"

# The site root ("/") is served by content/pages/home.md, so the auto-generated
# article index is disabled to avoid clobbering it.
INDEX_SAVE_AS = ""

# Disable auto-generated taxonomy / archive pages (filtering is client-side).
CATEGORY_SAVE_AS = ""
TAG_SAVE_AS = ""
AUTHOR_SAVE_AS = ""
ARCHIVES_SAVE_AS = ""
CATEGORIES_SAVE_AS = ""
TAGS_SAVE_AS = ""
AUTHORS_SAVE_AS = ""
DIRECT_TEMPLATES = ["index", "404"]

# Disable feeds to keep the output minimal (no external dependency required).
FEED_ALL_ATOM = None
CATEGORY_FEED_ATOM = None
AUTHOR_FEED_ATOM = None
AUTHOR_FEED_RSS = None
TRANSLATION_FEED_ATOM = None
TAG_FEED_ATOM = None

# ---------------------------------------------------------------------------
# Theme behaviour
# ---------------------------------------------------------------------------
DEFAULT_PAGINATION = False
DISPLAY_PAGES_ON_MENU = False
DISPLAY_CATEGORIES_ON_MENU = False
GZIP = False

# ---------------------------------------------------------------------------
# Navigation
# ---------------------------------------------------------------------------
MENUITEMS = [
    ("Home", ""),
    ("News", "news/"),
    ("Branding", "branding/"),
    ("Từ điển Cargo", "cargo-dictionary/"),
    ("Cargo Simulator", "cargo-simulator/"),
    ("Core Banking", "core-banking-simulator/"),
    ("Expense Simulator", "expense-simulator/"),
    ("Bán vé máy bay", "ticket-sales-simulator/"),
    ("Pastenote", "pastenote/"),
]

NAV_UTILITY = [
    ("News & Insights", "news/"),
    ("Contact", "branding/#contact"),
]

SOCIAL = [
    ("LinkedIn", "https://www.linkedin.com/company/sembcorp-industries-ltd"),
    ("X", "https://x.com/sembcorp"),
    ("YouTube", "https://www.youtube.com/@sembcorp"),
]

# Footer link zones (mirrors the reference site's multi-column footer)
FOOTER_COLUMNS = [
    (
        "Explore",
        [
            ("Home", ""),
            ("News & Insights", "news/"),
            ("Branding", "branding/"),
            ("Cargo Simulator", "cargo-simulator/"),
            ("Core Banking", "core-banking-simulator/"),
            ("Expense Simulator", "expense-simulator/"),
            ("Bán vé máy bay", "ticket-sales-simulator/"),
            ("Pastenote", "pastenote/"),
        ],
    ),
    (
        "Topics",
        [
            ("Corporate", "news/"),
            ("Renewables", "news/"),
            ("Financial Results", "news/"),
            ("Innovation", "news/"),
        ],
    ),
    (
        "Resources",
        [
            ("Media Releases", "news/"),
            ("Insights & Stories", "news/"),
            ("Email Alerts", "branding/#subscribe"),
        ],
    ),
    (
        "Legal",
        [
            ("Privacy Statement", "branding/"),
            ("Terms of Use", "branding/"),
            ("Cookie Policy", "branding/"),
        ],
    ),
]

# ---------------------------------------------------------------------------
# Brand data consumed by the Branding page
# ---------------------------------------------------------------------------
BRAND_COLORS = [
    {"hex": "#009999", "name": "Siemens Petrol", "role": "Primary accent", "text": "light"},
    {"hex": "#000028", "name": "Deep Blue", "role": "Primary background", "text": "light"},
    {"hex": "#FFFFFF", "name": "White", "role": "Light surface", "text": "dark"},
    {"hex": "#1A1A1A", "name": "Standard text", "role": "Body copy", "text": "light"},
    {"hex": "#666666", "name": "Muted text", "role": "Secondary copy", "text": "light"},
    {"hex": "#F5F7F8", "name": "Soft neutral", "role": "Subtle surface", "text": "dark"},
]

BRAND_VALUES = [
    ("Insight", "We turn complexity into clarity with evidence-led thinking."),
    ("Integrity", "We act with honesty, accountability and respect for every stakeholder."),
    ("Integral", "We deliver end-to-end solutions that work as one integrated system."),
]

# ---------------------------------------------------------------------------
# Cargo dictionary (Air Premia–inspired glossary)
#
# The seed terms live in a version-controlled JSON file and are embedded into the
# page at build time, so the client-side search works with no network request.
# New terms added in the browser are stored in localStorage and can be exported.
# ---------------------------------------------------------------------------
with open(
    os.path.join(BASE_DIR, "content", "data", "cargo_dictionary.json"), encoding="utf-8"
) as _cargo_file:
    CARGO_DICTIONARY = json.load(_cargo_file)

# Ordered filter lists (plus a leading "all" handled by the template).
CARGO_CATEGORIES = [
    "Cơ bản",
    "Chứng từ",
    "Vận hành",
    "Thanh toán",
    "Đặc biệt",
    "Công nghệ",
    "Dịch vụ Air Premia",
]

CARGO_LEVELS = ["Cơ bản", "Trung bình", "Nâng cao"]

CARGO_COUNT = len(CARGO_DICTIONARY)

# GitHub repository backing the "live" write features of the dictionary page.
# Add / edit / delete / import are admin-only: users unlock them with a GitHub
# Personal Access Token entered in-browser (never stored in this repo). Writes
# commit the updated glossary to this repository, then GitHub Actions rebuilds
# and redeploys the site. Public info only — not a secret.
CARGO_COUNT = len(CARGO_DICTIONARY)

# GitHub repository backing the "live" write features of the dictionary page.
# Add / edit / delete / import are admin-only: users unlock them with a
# GitHub Personal Access Token typed at runtime (kept in memory, never committed),
# then writes commit `content/data/cargo_dictionary.json` back to the repo
# (GitHub REST API) and the live site rebuilds.
CARGO_GITHUB_REPO = "blogco/brandblog"
CARGO_GITHUB_BRANCH = "main"

# ---------------------------------------------------------------------------
# Pastenote (3M Post-it board)
#
# A public notice board at /pastenote/. Pasted links, images and text become
# sticky notes that auto-save to the browser (localStorage). An admin can sync
# the merged set back to content/data/pastenote.json with a GitHub token typed
# at runtime (never committed). The seed/last-known board is embedded at build
# time so the page paints instantly and works offline.
# ---------------------------------------------------------------------------
try:
    with open(
        os.path.join(BASE_DIR, "content", "data", "pastenote.json"), encoding="utf-8"
    ) as _pastenote_file:
        PASTENOTE_NOTES = json.load(_pastenote_file)
except (FileNotFoundError, json.JSONDecodeError):
    PASTENOTE_NOTES = []

PASTENOTE_GITHUB_REPO = "blogco/brandblog"
PASTENOTE_GITHUB_BRANCH = "main"
PASTENOTE_FILE_PATH = "content/data/pastenote.json"
