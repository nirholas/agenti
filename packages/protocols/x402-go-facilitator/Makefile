ROOT_DIR := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))

build:
	go build -o $(ROOT_DIR)/bin/x402-facilitator $(ROOT_DIR)/cmd/facilitator
	go build -o $(ROOT_DIR)/bin/x402-client $(ROOT_DIR)/cmd/client

build-docker:
	docker buildx build \
	--platform linux/amd64,linux/arm64 \
	-t dreamcacao/x402-facilitator:0.0.0 \
	-t dreamcacao/x402-facilitator:latest \
	--push .

generate-api:
	swag init -g api/server.go -o api/swagger --parseDependency

generate-abi:
	abigen --abi $(ROOT_DIR)/scheme/evm/eip3009/eip3009.abi \
		--pkg eip3009 \
		--out $(ROOT_DIR)/scheme/evm/eip3009/eip3009.go