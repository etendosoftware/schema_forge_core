.PHONY: test test-frontend generate dev build install deploy clean help report-serve report-serve-detach report-stop report-preview

# --- Testing ---

test: ## Run all CLI tests
	cd cli && node --test 'test/*.test.js'

test-frontend: ## Run only frontend generator tests
	cd cli && node --test 'test/generate-frontend.test.js'

# --- Code Generation ---

generate: ## Generate frontend from Sales Order contract
	node cli/src/generate-frontend.js artifacts/sales-order/contract.json

# --- Dev Server ---

dev: ## Start app-shell dev server (http://localhost:3100)
	cd tools/app-shell && npm run dev

build: ## Build app-shell for production
	cd tools/app-shell && npm run build

# --- Setup ---

install: ## Install all workspace dependencies
	npm install

# --- Deploy ---

# Load local config from .env (not committed)
-include .env
export

# Etendo root: set in .env, override with make deploy ETENDO_ROOT=/path, or fallback to ..
ETENDO_ROOT ?= ..
MODULE_WEB := $(ETENDO_ROOT)/modules/com.etendoerp.go/web/com.etendoerp.go

deploy: build ## Build app-shell and deploy to Etendo module web dir
	@rm -rf $(MODULE_WEB)
	@mkdir -p $(MODULE_WEB)
	@cp -r tools/app-shell/dist/* $(MODULE_WEB)/
	@echo "Deployed to $(MODULE_WEB)"

# --- Reports ---

report-serve: ## Start jsreport in Docker (foreground)
	node cli/src/report-serve.js

report-serve-detach: ## Start jsreport in Docker (background)
	node cli/src/report-serve.js --detach

report-stop: ## Stop jsreport Docker container
	node cli/src/report-serve.js --stop

report-preview: ## Preview Business Partner listing report (requires jsreport running)
	node cli/src/report-preview.js --artifact business-partner --report listing

# --- Cleanup ---

clean: ## Remove generated artifacts and build output
	rm -rf tools/app-shell/dist

# --- Help ---

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
