# -*- coding: utf-8 -*-
"""Pelican configuration — development / preview.

Build locally with:
    pelican content -s pelicanconf.py -l -r
"""

from datetime import datetime

# ---------------------------------------------------------------------------
# Site metadata
# ---------------------------------------------------------------------------
AUTHOR = "BrandBlog Editorial"
SITENAME = "BrandBlog"
SITESUBTITLE = "Energy, Sustainability & Innovation Insights"
SITEDESCRIPTION = (
    "BrandBlog is a static publication covering the energy transition, "
    "sustainability and the people driving a more sustainable future — "
    "with a design system inspired by Sembcorp."
)
COPYRIGHT_YEAR = datetime.now().year

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PATH = "content"
PAGE_PATHS = ["pages"]
ARTICLE_PATHS = ["posts"]
STATIC_PATHS = ["images"]
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
DIRECT_TEMPLATES = ["index"]

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
    {"hex": "#006C53", "name": "Tropical Rain Forest", "role": "Primary / accent", "text": "light"},
    {"hex": "#0095FF", "name": "Azure Radiance", "role": "Secondary accent", "text": "light"},
    {"hex": "#FF6400", "name": "Blaze Orange", "role": "Tertiary accent", "text": "light"},
    {"hex": "#FFFFFF", "name": "White", "role": "Surface / reversed text", "text": "dark"},
    {"hex": "#464646", "name": "Tundora", "role": "Body text", "text": "light"},
    {"hex": "#1A1A1A", "name": "Ink", "role": "Headings", "text": "light"},
]

BRAND_VALUES = [
    ("Insight", "We turn complexity into clarity with evidence-led thinking."),
    ("Integrity", "We act with honesty, accountability and respect for every stakeholder."),
    ("Integral", "We deliver end-to-end solutions that work as one integrated system."),
]
