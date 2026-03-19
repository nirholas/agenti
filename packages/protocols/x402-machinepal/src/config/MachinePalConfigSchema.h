#pragma once

constexpr const char* MachinePalConfigSchemaJson = R"(
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "server": {
      "type": "object",
      "properties": {
        "hostname": { "type": "string" },
        "http": {
          "type": "object",
          "properties": {
            "enable": { "type": "boolean" },
            "port": { "type": "integer" }
          },
          "required": ["enable", "port"]
        },
        "https": {
          "type": "object",
          "properties": {
            "enable": { "type": "boolean" },
            "port": { "type": "integer" },
            "cert_file": { "type": "string" },
            "key_file": { "type": "string" }
          },
          "required": ["enable", "port", "cert_file", "key_file"]
        }
      },
      "required": ["hostname", "http", "https"]
    },
    "network": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "facilitator": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["cdp", "x402"] },
            "base_url": { "type": "string" },
            "api_key_file": { "type": "string" }
          },
          "required": ["type", "base_url"]
        },
        "payment_tokens": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "address": { "type": "string" }
            },
            "required": ["name", "address"]
          }
        }
      },
      "required": ["name"]
    },
    "log": {
      "type": "object",
      "properties": {
        "level": {
          "type": "string",
          "enum": ["trace", "debug", "info", "warn", "error", "fatal"]
        },
        "type": { "type": "string", "enum": ["default", "json"] }
      },
      "required": ["level"]
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "location": { "type": "string" },
          "price": { "type": "number" },
          "token": { "type": "string" }
        },
        "required": ["name", "type", "location", "price", "token"]
      }
    }
  },
  "required": ["server", "network",  "resources"]
}
)";