//! The `bazaar` extension for resource discovery and cataloging.
//!
//! The `bazaar` extension enables resource servers to declare their endpoint
//! specifications (HTTP method or MCP tool name, input parameters, and output format)
//! so that facilitators can catalog and index them in a discovery service.
//!
//! # Example: GET Endpoint
//!
//! ```
//! use x402_extensions::bazaar::*;
//! use x402_core::types::Extension;
//! use serde_json::json;
//!
//! let info = BazaarInfo::builder()
//!     .input(BazaarInput::Http(BazaarHttpInput::builder()
//!         .method(HttpMethod::GET)
//!         .query_params(json!({"city": "San Francisco"}))
//!         .build()))
//!     .output(BazaarOutput::builder()
//!         .output_type("json")
//!         .example(json!({"city": "San Francisco", "weather": "foggy"}))
//!         .build())
//!     .build();
//!
//! let ext = Extension::typed(info);
//! let (key, transport) = ext.into_pair();
//! assert_eq!(key, "bazaar");
//! ```
//!
//! # Example: POST Endpoint
//!
//! ```
//! use x402_extensions::bazaar::*;
//! use x402_core::types::Extension;
//! use serde_json::json;
//!
//! let info = BazaarInfo::builder()
//!     .input(BazaarInput::Http(BazaarHttpInput::builder()
//!         .method(HttpMethod::POST)
//!         .body_type("json")
//!         .body(json!({"query": "example"}))
//!         .build()))
//!     .build();
//!
//! let ext = Extension::typed(info);
//! let (key, _) = ext.into_pair();
//! assert_eq!(key, "bazaar");
//! ```
//!
//! # Example: MCP Tool
//!
//! ```
//! use x402_extensions::bazaar::*;
//! use x402_core::types::Extension;
//! use serde_json::json;
//!
//! let info = BazaarInfo::builder()
//!     .input(BazaarInput::Mcp(BazaarMcpInput::builder()
//!         .tool("financial_analysis")
//!         .input_schema(json!({
//!             "type": "object",
//!             "properties": {
//!                 "ticker": { "type": "string" }
//!             },
//!             "required": ["ticker"]
//!         }))
//!         .description("AI-powered financial analysis")
//!         .build()))
//!     .output(BazaarOutput::builder()
//!         .output_type("json")
//!         .example(json!({"summary": "Strong fundamentals", "score": 8.5}))
//!         .build())
//!     .build();
//!
//! let ext = Extension::typed(info);
//! let (key, _) = ext.into_pair();
//! assert_eq!(key, "bazaar");
//! ```

use bon::Builder;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use x402_core::types::{AnyJson, ExtensionInfo};

/// Discovery info for the `bazaar` extension.
///
/// Contains the input specification and optional output description
/// for a resource server endpoint.
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct BazaarInfo {
    /// How to call the endpoint or tool.
    pub input: BazaarInput,

    /// Expected response format (optional).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<BazaarOutput>,
}

impl ExtensionInfo for BazaarInfo {
    const ID: &'static str = "bazaar";

    fn schema() -> AnyJson {
        let schema = schemars::schema_for!(BazaarInfo);
        serde_json::to_value(&schema).expect("BazaarInfo schema generation should not fail")
    }
}

/// Discriminated union for input types.
///
/// - `Http`: HTTP endpoints (GET, HEAD, DELETE, POST, PUT, PATCH)
/// - `Mcp`: MCP (Model Context Protocol) tools
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type")]
pub enum BazaarInput {
    /// HTTP endpoint input.
    #[serde(rename = "http")]
    Http(BazaarHttpInput),

    /// MCP tool input.
    #[serde(rename = "mcp")]
    Mcp(BazaarMcpInput),
}

/// HTTP endpoint input specification.
///
/// For query parameter methods (GET, HEAD, DELETE), use `query_params` and `headers`.
/// For body methods (POST, PUT, PATCH), additionally use `body_type` and `body`.
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct BazaarHttpInput {
    /// HTTP method (GET, HEAD, DELETE, POST, PUT, PATCH).
    pub method: HttpMethod,

    /// Query parameter examples.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query_params: Option<AnyJson>,

    /// Custom header examples.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<AnyJson>,

    /// Request body content type. Required for body methods (POST, PUT, PATCH).
    /// One of `"json"`, `"form-data"`, `"text"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub body_type: Option<String>,

    /// Request body example. Required for body methods (POST, PUT, PATCH).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<AnyJson>,
}

/// HTTP methods supported by the bazaar extension.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub enum HttpMethod {
    /// HTTP GET method.
    GET,
    /// HTTP HEAD method.
    HEAD,
    /// HTTP DELETE method.
    DELETE,
    /// HTTP POST method.
    POST,
    /// HTTP PUT method.
    PUT,
    /// HTTP PATCH method.
    PATCH,
}

/// MCP tool input specification.
///
/// Describes an MCP tool's name, input schema, and optional metadata.
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct BazaarMcpInput {
    /// MCP tool name (matches what's passed to `tools/call`).
    #[builder(into)]
    pub tool: String,

    /// JSON Schema for the tool's `arguments`, following the MCP `Tool.inputSchema` format.
    pub input_schema: AnyJson,

    /// Human-readable description of the tool.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub description: Option<String>,

    /// MCP transport protocol. One of `"streamable-http"` or `"sse"`.
    /// Defaults to `"streamable-http"` if omitted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<McpTransport>,

    /// Example `arguments` object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<AnyJson>,
}

/// MCP transport protocol options.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum McpTransport {
    /// Streamable HTTP transport (default).
    StreamableHttp,
    /// Server-Sent Events transport.
    Sse,
}

/// Output specification for a bazaar discovery entry.
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct BazaarOutput {
    /// Response content type (e.g., `"json"`, `"text"`).
    #[serde(rename = "type")]
    #[builder(into)]
    pub output_type: String,

    /// Additional format information.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub format: Option<String>,

    /// Example response value.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<AnyJson>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use x402_core::types::{Extension, ExtensionMapInsert, Record};

    use super::*;

    #[test]
    fn bazaar_get_endpoint() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Http(
                BazaarHttpInput::builder()
                    .method(HttpMethod::GET)
                    .query_params(json!({"city": "San Francisco"}))
                    .build(),
            ))
            .output(
                BazaarOutput::builder()
                    .output_type("json")
                    .example(json!({
                        "city": "San Francisco",
                        "weather": "foggy",
                        "temperature": 60
                    }))
                    .build(),
            )
            .build();

        let ext = Extension::typed(info);
        let (key, transport_ext) = ext.into_pair();

        assert_eq!(key, "bazaar");

        let info_json = &transport_ext.info;
        assert_eq!(info_json["input"]["type"], "http");
        assert_eq!(info_json["input"]["method"], "GET");
        assert_eq!(
            info_json["input"]["queryParams"],
            json!({"city": "San Francisco"})
        );
        assert_eq!(info_json["output"]["type"], "json");
    }

    #[test]
    fn bazaar_post_endpoint() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Http(
                BazaarHttpInput::builder()
                    .method(HttpMethod::POST)
                    .body_type("json")
                    .body(json!({"query": "example"}))
                    .build(),
            ))
            .output(
                BazaarOutput::builder()
                    .output_type("json")
                    .example(json!({"results": []}))
                    .build(),
            )
            .build();

        let ext = Extension::typed(info);
        let (key, transport_ext) = ext.into_pair();

        assert_eq!(key, "bazaar");

        let info_json = &transport_ext.info;
        assert_eq!(info_json["input"]["type"], "http");
        assert_eq!(info_json["input"]["method"], "POST");
        assert_eq!(info_json["input"]["bodyType"], "json");
        assert_eq!(info_json["input"]["body"], json!({"query": "example"}));
    }

    #[test]
    fn bazaar_mcp_tool() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Mcp(
                BazaarMcpInput::builder()
                    .tool("financial_analysis")
                    .input_schema(json!({
                        "type": "object",
                        "properties": {
                            "ticker": { "type": "string" },
                            "analysis_type": { "type": "string", "enum": ["quick", "deep"] }
                        },
                        "required": ["ticker"]
                    }))
                    .description("Advanced AI-powered financial analysis")
                    .example(json!({
                        "ticker": "AAPL",
                        "analysis_type": "deep"
                    }))
                    .build(),
            ))
            .output(
                BazaarOutput::builder()
                    .output_type("json")
                    .example(json!({
                        "summary": "Strong fundamentals...",
                        "score": 8.5
                    }))
                    .build(),
            )
            .build();

        let ext = Extension::typed(info);
        let (key, transport_ext) = ext.into_pair();

        assert_eq!(key, "bazaar");

        let info_json = &transport_ext.info;
        assert_eq!(info_json["input"]["type"], "mcp");
        assert_eq!(info_json["input"]["tool"], "financial_analysis");
        assert!(info_json["input"]["inputSchema"].is_object());
    }

    #[test]
    fn bazaar_mcp_with_transport() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Mcp(
                BazaarMcpInput::builder()
                    .tool("my_tool")
                    .input_schema(json!({"type": "object"}))
                    .transport(McpTransport::Sse)
                    .build(),
            ))
            .build();

        let (_, ext) = Extension::typed(info).into_pair();
        assert_eq!(ext.info["input"]["transport"], "sse");
    }

    #[test]
    fn bazaar_schema_is_generated() {
        let schema = <BazaarInfo as ExtensionInfo>::schema();
        assert!(schema.is_object());
        // Schema should define the structure of BazaarInfo
        let schema_obj = schema.as_object().unwrap();
        assert!(
            schema_obj.contains_key("properties") || schema_obj.contains_key("$defs"),
            "Schema should contain properties or definitions"
        );
    }

    #[test]
    fn bazaar_insert_into_extension_map() {
        let mut extensions: Record<Extension> = Record::new();

        extensions.insert_typed(Extension::typed(
            BazaarInfo::builder()
                .input(BazaarInput::Http(
                    BazaarHttpInput::builder().method(HttpMethod::GET).build(),
                ))
                .build(),
        ));

        assert!(extensions.contains_key("bazaar"));
        assert_eq!(extensions["bazaar"].info["input"]["type"], "http");
        assert_eq!(extensions["bazaar"].info["input"]["method"], "GET");
    }

    #[test]
    fn bazaar_roundtrip_serialization() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Http(
                BazaarHttpInput::builder()
                    .method(HttpMethod::POST)
                    .body_type("json")
                    .body(json!({"key": "value"}))
                    .headers(json!({"Authorization": "Bearer token"}))
                    .build(),
            ))
            .output(
                BazaarOutput::builder()
                    .output_type("json")
                    .format("utf-8")
                    .build(),
            )
            .build();

        // Serialize to JSON and back
        let json = serde_json::to_value(&info).unwrap();
        let deserialized: BazaarInfo = serde_json::from_value(json.clone()).unwrap();
        let re_serialized = serde_json::to_value(&deserialized).unwrap();

        assert_eq!(json, re_serialized);
    }

    #[test]
    fn bazaar_transport_roundtrip() {
        let info = BazaarInfo::builder()
            .input(BazaarInput::Mcp(
                BazaarMcpInput::builder()
                    .tool("test_tool")
                    .input_schema(json!({"type": "object"}))
                    .build(),
            ))
            .build();

        let ext = Extension::typed(info);
        let (key, transport_ext) = ext.into_pair();

        // Serialize the transport extension
        let json = serde_json::to_value(&transport_ext).unwrap();

        // Deserialize back
        let deserialized: Extension = serde_json::from_value(json).unwrap();

        assert_eq!(
            transport_ext.info, deserialized.info,
            "Info should roundtrip"
        );
        assert_eq!(
            transport_ext.schema, deserialized.schema,
            "Schema should roundtrip"
        );
        assert_eq!(key, "bazaar");
    }
}
