//! The error response types for the paywall.

use std::fmt::Display;

use http::{HeaderName, HeaderValue, StatusCode};
use x402_core::{
    transport::{Accepts, PaymentRequired, PaymentResource},
    types::{Base64EncodedHeader, Extension, Record, X402V2},
};

/// Represents an error response from the paywall.
#[derive(Debug, Clone)]
pub struct ErrorResponse {
    /// The HTTP status code of the error response.
    pub status: StatusCode,
    /// The header to include in the error response.
    pub header: ErrorResponseHeader,
    /// The body of the error response.
    ///
    /// Body is **Boxed** to reduce size of the struct.
    pub body: Box<PaymentRequired>,
}

impl Display for ErrorResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("payment required")
    }
}

impl ErrorResponse {
    /// Payment needed to access resource
    pub fn payment_required(
        resource: PaymentResource,
        accepts: Accepts,
        extensions: Record<Extension>,
    ) -> ErrorResponse {
        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: "PAYMENT-SIGNATURE header is required".to_string(),
            resource,
            accepts,
            extensions,
        };

        let header = Base64EncodedHeader::try_from(payment_required.clone()).unwrap_or(
            Base64EncodedHeader("Failed to encode base64 PaymentRequired payload".to_string()),
        );

        ErrorResponse {
            status: StatusCode::PAYMENT_REQUIRED,
            header: ErrorResponseHeader::PaymentRequired(header),
            body: Box::new(payment_required),
        }
    }

    /// Malformed payment payload or requirements
    pub fn invalid_payment(
        reason: impl Display,
        resource: PaymentResource,
        accepts: Accepts,
        extensions: Record<Extension>,
    ) -> ErrorResponse {
        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: reason.to_string(),
            resource,
            accepts,
            extensions,
        };

        let header = Base64EncodedHeader::try_from(payment_required.clone()).unwrap_or(
            Base64EncodedHeader("Failed to encode base64 PaymentRequired payload".to_string()),
        );

        ErrorResponse {
            status: StatusCode::BAD_REQUEST,
            header: ErrorResponseHeader::PaymentResponse(header),
            body: Box::new(payment_required),
        }
    }

    /// Payment verification or settlement failed
    pub fn payment_failed(
        reason: impl Display,
        resource: PaymentResource,
        accepts: Accepts,
        extensions: Record<Extension>,
    ) -> ErrorResponse {
        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: reason.to_string(),
            resource,
            accepts,
            extensions,
        };

        let header = Base64EncodedHeader::try_from(payment_required.clone()).unwrap_or(
            Base64EncodedHeader("Failed to encode base64 PaymentRequired payload".to_string()),
        );

        ErrorResponse {
            status: StatusCode::PAYMENT_REQUIRED,
            header: ErrorResponseHeader::PaymentResponse(header),
            body: Box::new(payment_required),
        }
    }

    /// Internal server error during payment processing
    pub fn server_error(
        reason: impl Display,
        resource: PaymentResource,
        accepts: Accepts,
        extensions: Record<Extension>,
    ) -> ErrorResponse {
        let payment_required = PaymentRequired {
            x402_version: X402V2,
            error: reason.to_string(),
            resource,
            accepts,
            extensions,
        };

        let header = Base64EncodedHeader::try_from(payment_required.clone()).unwrap_or(
            Base64EncodedHeader("Failed to encode base64 PaymentRequired payload".to_string()),
        );

        ErrorResponse {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            header: ErrorResponseHeader::PaymentResponse(header),
            body: Box::new(payment_required),
        }
    }
}

/// Represents the type of error header to include in a paywall error response.
#[derive(Debug, Clone)]
pub enum ErrorResponseHeader {
    /// `PAYMENT-REQUIRED` header.
    PaymentRequired(Base64EncodedHeader),
    /// `PAYMENT-RESPONSE` header.
    PaymentResponse(Base64EncodedHeader),
}

impl ErrorResponseHeader {
    /// Get the header value to include in the response.
    ///
    /// Returns `None` if the header value could not be created.
    pub fn header_value(self) -> Option<(HeaderName, HeaderValue)> {
        match self {
            ErrorResponseHeader::PaymentRequired(Base64EncodedHeader(s)) => {
                HeaderValue::from_str(&s)
                    .ok()
                    .map(|v| (HeaderName::from_static("payment-required"), v))
            }
            ErrorResponseHeader::PaymentResponse(Base64EncodedHeader(s)) => {
                HeaderValue::from_str(&s)
                    .ok()
                    .map(|v| (HeaderName::from_static("payment-response"), v))
            }
        }
    }
}

#[cfg(feature = "axum")]
impl axum::response::IntoResponse for ErrorResponse {
    fn into_response(self) -> axum::response::Response {
        let mut response = (self.status, axum::extract::Json(self.body)).into_response();
        if let Some((name, val)) = self.header.header_value() {
            response.headers_mut().insert(name, val);
        }
        response
    }
}

#[cfg(feature = "actix-web")]
impl ErrorResponse {
    fn actix_header(&self) -> (&'static str, &str) {
        match &self.header {
            ErrorResponseHeader::PaymentRequired(base64_encoded_header) => {
                ("payment-required", &base64_encoded_header.0)
            }
            ErrorResponseHeader::PaymentResponse(base64_encoded_header) => {
                ("payment-response", &base64_encoded_header.0)
            }
        }
    }
}

#[cfg(feature = "actix-web")]
impl actix_web::ResponseError for ErrorResponse {
    fn status_code(&self) -> actix_web::http::StatusCode {
        actix_web::http::StatusCode::from_u16(self.status.as_u16()).unwrap()
    }

    fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
        actix_web::HttpResponseBuilder::new(self.status_code())
            .insert_header(self.actix_header())
            .json(&self.body)
    }
}
