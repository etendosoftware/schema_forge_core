.PHONY: test test-frontend test-e2e test-e2e-headless test-e2e-debug test-e2e-ui test-e2e-report test-e2e-record generate regen dev dev-with-shell dev-mock build install install-e2e deploy clean help report-serve report-serve-detach report-stop report-preview validate-pipeline quality-gate sonar sonar-coverage menu-cache uuid

# --- Testing ---

test: ## Run all CLI tests and app-shell unit tests
	cd cli && node --test 'test/*.test.js'
	node --test tools/app-shell/src/lib/__tests__/*.test.js
	node --test tools/app-shell/src/pages/onboarding/__tests__/*.test.js

validate-pipeline: ## Validate pipeline completeness across all artifacts
	node cli/src/validate-pipeline.js --format=text

test-frontend: ## Run only frontend generator tests
	cd cli && node --test 'test/generate-frontend.test.js'


quality-gate: ## Run Schema Forge quality gate for PR-affected windows
	node cli/src/quality-gate.js --pr-affected --baseline-ref origin/main --format md
# --- E2E Testing (Playwright) ---

test-e2e: ## Run E2E tests with visible browser
	cd e2e && npx playwright test --headed

test-e2e-headless: ## Run E2E tests headless (CI mode)
	cd e2e && CI=true npx playwright test

test-e2e-debug: ## Run E2E tests in debug mode (step by step)
	cd e2e && npx playwright test --debug

test-e2e-ui: ## Open Playwright UI for interactive test running
	cd e2e && npx playwright test --ui

test-e2e-report: ## Show last E2E test report in browser
	cd e2e && npx playwright show-report ../artifacts/e2e-report

test-e2e-record: ## Record a test flow (opens browser, generates code)
	cd e2e && npx playwright codegen --save-storage=auth.json http://localhost:3100 --output=recordings/recorded-flow.spec.js

install-e2e: ## Install E2E dependencies + browsers
	cd e2e && npm install && npx playwright install chromium

# --- Code Generation ---

generate: ## Generate frontend from Sales Order contract
	node cli/src/generate-frontend.js artifacts/sales-order/contract.json

PUSH_TO_NEO ?= 0
SKIP_EXTRACT ?= 0
ONLY ?=

regen: ## Re-run full pipeline for all active windows (HELP=1 or `make regen-help` for options)
	@if [ "$(HELP)" = "1" ]; then $(MAKE) -s regen-help; exit 0; fi; \
	REGEN_ARGS=""; \
	if [ "$(PUSH_TO_NEO)" = "1" ]; then REGEN_ARGS="$$REGEN_ARGS --push-to-neo"; fi; \
	if [ "$(SKIP_EXTRACT)" = "1" ]; then REGEN_ARGS="$$REGEN_ARGS --skip-extract"; fi; \
	if [ -n "$(ONLY)" ]; then REGEN_ARGS="$$REGEN_ARGS --only $(ONLY)"; fi; \
	node cli/src/regen-all.js $$REGEN_ARGS

regen-help: ## Show usage and examples for `make regen`
	@echo "Usage: make regen [VAR=value ...]"
	@echo ""
	@echo "Variables:"
	@echo "  ONLY=<spec>[,<spec>...]   Run only the given window spec(s) (kebab-case, matches artifacts/<spec>/)"
	@echo "  PUSH_TO_NEO=1             Push the resulting config to NEO Headless after regenerating"
	@echo "  SKIP_EXTRACT=1            Skip the DB extraction step (reuse existing schema-raw.json)"
	@echo ""
	@echo "Examples:"
	@echo "  make regen                                # all active windows"
	@echo "  make regen ONLY=tax                       # only the tax window"
	@echo "  make regen ONLY=tax,product               # tax + product"
	@echo "  make regen ONLY=tax SKIP_EXTRACT=1        # only tax, skip DB extraction"
	@echo "  make regen ONLY=tax PUSH_TO_NEO=1         # only tax + push to NEO"
	@echo ""
	@echo "Notes:"
	@echo "  - Window specs are the directory names under artifacts/ (kebab-case)."
	@echo "  - For a single window, you can also run: node cli/src/resolve-curated.js --window <spec> --write"

# --- Dev Server ---

dev: ## Start app-shell dev server (http://localhost:3100)
	cd tools/app-shell && npm run dev

dev-with-shell: ## Start app-shell + spike-hello-app together (shell 3100, UI 5173, API 4100)
	cd tools/spike-hello-app && npm run dev:with-shell

dev-mock: ## Start app-shell dev server with mock data (http://localhost:3100) — required for E2E tests
	cd tools/app-shell && npm run dev:mock

build: ## Build app-shell for production
	cd tools/app-shell && npm run build
	node cli/src/generate-reports-manifest.js

# --- Setup ---

menu-cache: ## Refresh the AD menu cache from the database
	node cli/src/menu-cache.js refresh

uuid: ## Generate a new Etendo-format UUID (32 uppercase hex chars, no hyphens)
	@uuidgen | tr -d '-' | tr '[:lower:]' '[:upper:]'

install: ## Install all workspace dependencies and activate git hooks
	npm install
	git config core.hooksPath .githooks

# --- Deploy ---

# Load local config from .env (not committed)
-include .env
export

# Etendo root: set in .env, override with make deploy ETENDO_ROOT=/path, or fallback to ..
ETENDO_ROOT ?= ..
MODULE_WEB := $(ETENDO_ROOT)/modules/com.etendoerp.go/web/com.etendoerp.go
LEGACY_DEPLOY ?= 0

deploy: ## Deprecated: use the dedicated UI container; set LEGACY_DEPLOY=1 to run the old copy flow
	@if [ "$(LEGACY_DEPLOY)" = "1" ] || [ "$(LEGACY_DEPLOY)" = "true" ] || [ "$(LEGACY_DEPLOY)" = "yes" ]; then \
		$(MAKE) build && \
		rm -rf "$(MODULE_WEB)/assets" && \
		mkdir -p "$(MODULE_WEB)" && \
		cp -r tools/app-shell/dist/* "$(MODULE_WEB)/" && \
		echo "Deployed to $(MODULE_WEB)"; \
	else \
		echo "Deprecated: make deploy is no longer needed because the UI is compiled during commits and deployed in a separate container from Etendo Classic."; \
		echo "Use 'make deploy LEGACY_DEPLOY=1' only if you need the old copy-to-Etendo flow."; \
	fi

# --- Report Server ---

JSREPORT_COMPOSE_DIR := ../modules/com.etendoerp.go/compose
SCHEMA_FORGE_ABS := $(shell realpath .)

report-build: ## Build jsreport Docker image (required before first resources.up)
	cd $(JSREPORT_COMPOSE_DIR) && docker build -t etendo-jsreport:latest .

report-serve: ## Start jsreport Docker container (run report-build first)
	cd $(JSREPORT_COMPOSE_DIR) && SCHEMA_FORGE_DIR=$(SCHEMA_FORGE_ABS) docker compose -f com.etendoerp.go.yml up

report-serve-detach: ## Start jsreport in background (run report-build first)
	cd $(JSREPORT_COMPOSE_DIR) && SCHEMA_FORGE_DIR=$(SCHEMA_FORGE_ABS) docker compose -f com.etendoerp.go.yml up -d

report-stop: ## Stop jsreport Docker container
	cd $(JSREPORT_COMPOSE_DIR) && docker compose -f com.etendoerp.go.yml down

report-preview: ## Preview Business Partner listing report
	node cli/src/report-preview.js --artifact business-partner --report listing

# --- Static Analysis (SonarQube) ---

sonar: ## Run SonarQube analysis on Schema Forge JS/JSX code
	sonar-scanner -Dproject.settings=sonar-project.properties

sonar-coverage: ## Run all tests with coverage then SonarQube analysis
	@mkdir -p coverage
	node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/cli-lcov.info 'cli/test/*.test.js'
	node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/appshell-lcov.info 'tools/app-shell/src/**/__tests__/*.test.js'
	node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/appshell-test-lcov.info 'tools/app-shell/test/*.test.js'
	sonar-scanner -Dproject.settings=sonar-project.properties

# --- Cleanup ---

clean: ## Remove generated artifacts and build output
	rm -rf tools/app-shell/dist

# --- Help ---

help: ## Show this help
	@echo ""; \
	echo "\033[1mSchema Forge — Available targets\033[0m"; \
	echo ""; \
	awk '/^# ---/{gsub(/^# --- | ---$$/,"");printf "\033[1;33m%s\033[0m\n",$$0;next} \
	     /^[a-zA-Z][a-zA-Z0-9_-]*:.*## /{n=index($$0,": ## ");if(n>0){printf "  \033[36m%-22s\033[0m %s\n",substr($$0,1,n-1),substr($$0,n+5)}}' Makefile; \
	echo ""

.DEFAULT_GOAL := help
