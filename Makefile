# BrandBlog — developer shortcuts
# Usage: make <target>

PY ?= python3
VENV ?= .venv
PELICAN ?= $(VENV)/bin/pelican
PIP ?= $(VENV)/bin/pip

.PHONY: help install venv pip node css watch-css build serve clean linkcheck

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

venv: ## Create the Python virtualenv
	$(PY) -m venv $(VENV)

pip: venv ## Install Python dependencies
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

node: ## Install Node (Tailwind) dependencies
	npm install

install: pip node ## Install everything

css: node ## Compile Tailwind to theme/static/css/style.css
	npm run build:css

watch-css: node ## Rebuild Tailwind on change
	npm run watch:css

build: css ## Production build into output/
	$(PELICAN) content -s publishconf.py -o output

serve: pip ## Dev server with live reload at http://localhost:8000
	$(PELICAN) content -s pelicanconf.py -l -r

linkcheck: ## Build (dev URLs) and verify internal links resolve
	$(PELICAN) content -s pelicanconf.py -o output
	$(VENV)/bin/python scripts/linkcheck.py

clean: ## Remove build artifacts
	rm -rf output cache theme/static/css/style.css
