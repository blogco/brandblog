#!/bin/bash
# BrandBlog CMS — double-click launcher for macOS.
# Creates a virtualenv on first run, then starts the local CMS.

set -e
cd "$(dirname "$0")"

VENV="cms/venv"

if [ ! -d "$VENV" ]; then
  echo "🔧 First-time setup — creating virtual environment..."
  python3 -m venv "$VENV"
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  pip install --quiet --upgrade pip
  pip install --quiet -r cms/requirements.txt
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
fi

# Build the CMS stylesheet if it is missing.
if [ ! -f "cms/static/css/cms.css" ] && command -v npx >/dev/null 2>&1; then
  echo "🎨 Building CMS stylesheet..."
  npx tailwindcss -i ./cms/static/css/cms.src.css -o ./cms/static/css/cms.css --minify || true
fi

echo "🚀 Starting BrandBlog CMS..."
echo "📝 It will open in your browser automatically."
echo "   Press Ctrl+C in this window to stop the CMS."
echo ""

python cms/app.py
