.PHONY: build test clean fmt vet

BINARY := caddy-x402

# Deployment config — set via environment or override on command line:
#   make deploy DEPLOY_HOST=user@host DEPLOY_KEY=~/.ssh/mykey
DEPLOY_HOST ?=
DEPLOY_KEY  ?=

build:
	xcaddy build --with github.com/paolobietolini/caddy-x402=./ --output ./$(BINARY)

test:
	go test ./... -count=1 -v

test-short:
	go test ./... -count=1

test-race:
	go test ./... -count=1 -race

fmt:
	go fmt ./...

vet:
	go vet ./...

clean:
	rm -f $(BINARY)

deploy: build
ifndef DEPLOY_HOST
	$(error DEPLOY_HOST is not set. Usage: make deploy DEPLOY_HOST=user@host DEPLOY_KEY=~/.ssh/mykey)
endif
	scp $(if $(DEPLOY_KEY),-i $(DEPLOY_KEY)) ./$(BINARY) $(DEPLOY_HOST):/tmp/$(BINARY)
	ssh $(if $(DEPLOY_KEY),-i $(DEPLOY_KEY)) $(DEPLOY_HOST) "sudo systemctl stop caddy && sudo cp /usr/bin/caddy /usr/bin/caddy.backup && sudo cp /tmp/$(BINARY) /usr/bin/caddy && sudo chmod +x /usr/bin/caddy && sudo systemctl start caddy"
