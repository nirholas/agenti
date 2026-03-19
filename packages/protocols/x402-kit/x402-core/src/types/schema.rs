//! This module defines types related to the schema definitions for inputs and outputs in the X402 protocol.
//!
//! After supporting the [Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) extension, we will move the module there.

use bon::Builder;
use serde::{Deserialize, Serialize};

use crate::types::Record;

#[derive(Builder, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDefinition {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub field_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub required: Option<FieldRequired>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub description: Option<String>,

    #[serde(rename = "enum", skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl for<'a> IntoIterator<Item = &'static str>| iter.into_iter().map(|s| s.to_string()).collect())]
    pub field_enum: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl IntoIterator<Item = (&'static str, FieldDefinition)>| {
        iter.into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect()
    })]
    pub properties: Option<Record<FieldDefinition>>,
}

impl TryFrom<serde_json::Value> for FieldDefinition {
    type Error = serde_json::Error;

    fn try_from(value: serde_json::Value) -> Result<Self, Self::Error> {
        serde_json::from_value(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FieldRequired {
    Boolean(bool),
    VecString(Vec<String>),
}

/// Marker type to indicate that a field is required.
///
/// Since implementing `From<bool>` conflics with `From<Iterator>`, this type can be used
/// to indicate that a field is required.
pub struct Required;

impl From<Required> for FieldRequired {
    fn from(_: Required) -> Self {
        FieldRequired::Boolean(true)
    }
}

impl<I: IntoIterator<Item = &'static str>> From<I> for FieldRequired {
    fn from(value: I) -> Self {
        FieldRequired::VecString(value.into_iter().map(|s| s.to_string()).collect())
    }
}

#[derive(Builder, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpInput {
    pub discoverable: bool,

    pub method: Method,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_type: Option<InputBodyType>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl IntoIterator<Item = (&'static str, FieldDefinition)>| {
        iter.into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect()
    })]
    pub query_params: Option<Record<FieldDefinition>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl IntoIterator<Item = (&'static str, FieldDefinition)>| {
        iter.into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect()
    })]
    pub body_fields: Option<Record<FieldDefinition>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl IntoIterator<Item = (&'static str, FieldDefinition)>| {
        iter.into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect()
    })]
    pub header_fields: Option<Record<FieldDefinition>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Input {
    #[serde(rename = "http")]
    Http(HttpInput),
}

impl Input {
    pub fn as_http(&self) -> Option<&HttpInput> {
        match self {
            Input::Http(http_input) => Some(http_input),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Method {
    #[serde(rename = "GET")]
    Get,
    #[serde(rename = "POST")]
    Post,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InputBodyType {
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "form-data")]
    FormData,
    #[serde(rename = "multipart-form-data")]
    MultipartFormData,
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "binary")]
    Binary,
    #[serde(rename = "event-stream")]
    EventStream,
}

#[derive(Builder, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSchema {
    pub input: Input,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(with = |iter: impl IntoIterator<Item = (&'static str, FieldDefinition)>| {
        iter.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
    })]
    pub output: Option<Record<FieldDefinition>>,
}

impl OutputSchema {
    pub fn http_get_discoverable() -> Self {
        Self::builder()
            .input(Input::Http(
                HttpInput::builder()
                    .method(Method::Get)
                    .discoverable(true)
                    .build(),
            ))
            .build()
    }

    pub fn http_post_discoverable() -> Self {
        Self::builder()
            .input(Input::Http(
                HttpInput::builder()
                    .method(Method::Post)
                    .discoverable(true)
                    .build(),
            ))
            .build()
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn setup_complex_input() -> Input {
        Input::Http(
            HttpInput::builder()
                .method(Method::Post)
                .discoverable(true)
                .body_type(InputBodyType::Json)
                .header_fields([(
                    "example_header",
                    FieldDefinition::builder()
                        .description("An example header")
                        .field_type("string")
                        .required(Required)
                        .build(),
                )])
                .query_params([(
                    "exmple_query",
                    FieldDefinition::builder()
                        .description("An example query parameter")
                        .field_type("string")
                        .build(),
                )])
                .body_fields([(
                    "example",
                    FieldDefinition::builder()
                        .description("An example field")
                        .field_type("string")
                        .required(["nested_field", "nested_field2"])
                        .properties([
                            (
                                "nested_field",
                                FieldDefinition::builder()
                                    .field_type("number")
                                    .description("A nested field")
                                    .required(Required)
                                    .build(),
                            ),
                            (
                                "nested_field2",
                                FieldDefinition::builder()
                                    .field_type("string")
                                    .description("Optional nested field")
                                    .field_enum(["a", "b", "c"])
                                    .build(),
                            ),
                        ])
                        .build(),
                )])
                .build(),
        )
    }

    #[test]
    fn build_input() {
        let input = setup_complex_input();

        let input_json = json!({
            "discoverable": true,
            "type": "http",
            "method": "POST",
            "bodyType": "json",
            "headerFields": {
                "example_header": {
                    "type": "string",
                    "required": true,
                    "description": "An example header"
                }
            },
            "queryParams": {
                "exmple_query": {
                    "type": "string",
                    "description": "An example query parameter"
                }
            },
            "bodyFields": {
                "example": {
                    "type": "string",
                    "required": ["nested_field", "nested_field2"],
                    "description": "An example field",
                    "properties": {
                        "nested_field": {
                            "type": "number",
                            "required": true,
                            "description": "A nested field"
                        },
                        "nested_field2": {
                            "type": "string",
                            "description": "Optional nested field",
                            "enum": ["a", "b", "c"]
                        }
                    }
                }
            }
        });

        assert_eq!(serde_json::to_value(&input).unwrap(), input_json);
    }

    #[test]
    fn build_output_schema() {
        let input = setup_complex_input();

        let output_schema = OutputSchema::builder()
            .input(input.clone())
            .output([(
                "response_field",
                FieldDefinition::builder()
                    .field_type("string")
                    .description("A response field")
                    .required(Required)
                    .build(),
            )])
            .build();

        let output_schema_json = json!({
            "input": {
                "discoverable": true,
                "type": "http",
                "method": "POST",
                "bodyType": "json",
                "headerFields": {
                    "example_header": {
                        "type": "string",
                        "required": true,
                        "description": "An example header"
                    }
                },
                "queryParams": {
                    "exmple_query": {
                        "type": "string",
                        "description": "An example query parameter"
                    }
                },
                "bodyFields": {
                    "example": {
                        "type": "string",
                        "required": ["nested_field", "nested_field2"],
                        "description": "An example field",
                        "properties": {
                            "nested_field": {
                                "type": "number",
                                "required": true,
                                "description": "A nested field"
                            },
                            "nested_field2": {
                                "type": "string",
                                "description": "Optional nested field",
                                "enum": ["a", "b", "c"]
                            }
                        }
                    }
                }
            },
            "output": {
                "response_field": {
                    "type": "string",
                    "required": true,
                    "description": "A response field"
                }
            }
        });

        assert_eq!(
            serde_json::to_value(&output_schema).unwrap(),
            output_schema_json
        );
    }

    #[test]
    fn discoverable_helpers() {
        let get_schema = OutputSchema::http_get_discoverable();
        assert!(get_schema.input.as_http().unwrap().discoverable);
        assert_eq!(get_schema.input.as_http().unwrap().method, Method::Get);

        let get_schema_json = json!({
            "input": {
                "discoverable": true,
                "type": "http",
                "method": "GET"
            }
        });

        assert_eq!(serde_json::to_value(&get_schema).unwrap(), get_schema_json);

        let post_schema = OutputSchema::http_post_discoverable();
        assert_eq!(post_schema.input.as_http().unwrap().method, Method::Post);
        assert!(post_schema.input.as_http().unwrap().discoverable);

        let post_schema_json = json!({
            "input": {
                "discoverable": true,
                "type": "http",
                "method": "POST"
            }
        });

        assert_eq!(
            serde_json::to_value(&post_schema).unwrap(),
            post_schema_json
        );
    }
}
