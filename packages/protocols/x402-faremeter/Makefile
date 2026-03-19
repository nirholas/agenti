export PATH			:=		$(PWD)/bin:$(PATH)
export INSIDE_STAGING_DIR	:=		false

all: lint build doc test

pre-build: FORCE
	rm -f .eslintcache .build-finished

build: pre-build packages/logs packages/types packages/info packages/wallet-solana packages/wallet-evm $(wildcard packages/*) packages/test-harness scripts apps/facilitator tests
	touch .build-finished

lint:
	pnpm prettier -c .
	pnpm eslint --cache .

test:
	@[[ -d .tap/plugins ]] || pnpm tap build
	pnpm tap --disable-coverage

format:
	pnpm prettier -w .

doc: FORCE
	for pkg in packages/*; do cd $$pkg && pnpm tsdoc --src=src/index.ts --dest=README.md --types --noemoji && cd ../..; done
	pnpm prettier -w packages/*/README.md
	pnpm typedoc
	pnpm prettier -w docs/

packages/%: FORCE
	cd $@ && rm -rf dist && pnpm tsc && pnpm tsc-esm-fix

apps/%: FORCE
	cd $@ && rm -rf dist && pnpm tsc

scripts: FORCE
	cd scripts && rm -rf dist && pnpm tsc
	cd scripts/nestjs-example && rm -rf dist && pnpm tsc -p nestjs-example/tsconfig.json

tests: FORCE
	cd tests && pnpm tsc

clean:
	rm -f .env-checked .eslintcache .build-finished
	rm -rf .tap docs
	find . -type d -name "dist" -a ! -path '*/node_modules/*' | xargs rm -rf

.env-checked: bin/check-env
	./bin/check-env
	touch .env-checked

include .env-checked

.PHONY: all lint test
FORCE:
