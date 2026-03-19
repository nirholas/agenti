FROM golang:1.24.3 AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o facilitator ./cmd/facilitator

FROM debian:stable-slim

RUN apt update -y && apt install -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/facilitator /app