//! # X402 Paywall
//!
//! A framework-agnostic HTTP paywall implementation for the X402 payment protocol.
//!
//! This crate provides [`paywall::PayWall`], a composable middleware that protects
//! HTTP resources with X402 payments. It handles the complete payment lifecycle including
//! verification and settlement through a configured facilitator.
//!
//! ## Modules
//!
//! - [`paywall`]: The main [`PayWall`](paywall::PayWall) struct and payment flow logic.
//! - [`processor`]: Payment processing types including [`RequestProcessor`](processor::RequestProcessor)
//!   and [`PaymentState`](processor::PaymentState).
//! - [`errors`]: Error types for payment failures and HTTP error responses.
//!
//! ## Payment Flow
//!
//! The standard payment flow using [`PayWall::handle_payment`](paywall::PayWall::handle_payment):
//!
//! 1. **Update Accepts**: Filter payment requirements based on facilitator support.
//! 2. **Process Request**: Extract and validate the `PAYMENT-SIGNATURE` header.
//! 3. **Verify**: Verify the payment signature with the facilitator.
//! 4. **Run Handler**: Execute the resource handler.
//! 5. **Settle**: Settle the payment on successful response.
//!
//! For custom flows, use the step-by-step API directly. See [`PayWall`](paywall::PayWall) for details.
//!
//! ## Framework Integration
//!
//! While framework-agnostic, `x402-paywall` works seamlessly with any HTTP framework.
//! See the [`x402-kit` documentation](https://docs.rs/x402-kit) for complete usage examples
//! with Axum and other frameworks.
//!
//! ## Error Handling
//!
//! [`ErrorResponse`](errors::ErrorResponse) implements `IntoResponse` for Axum and can be
//! easily adapted to other frameworks. It returns appropriate HTTP status codes:
//!
//! - `402 Payment Required`: No payment signature provided.
//! - `400 Bad Request`: Invalid payment payload or unsupported requirements.
//! - `500 Internal Server Error`: Facilitator communication failures.

use std::fmt::Display;

pub mod errors;
pub mod paywall;
pub mod processor;

pub trait HttpRequest {
    fn get_header(&self, name: &str) -> Option<&[u8]>;
    fn insert_extension<T: Clone + Send + Sync + 'static>(&mut self, ext: T) -> Option<T>;
}

pub trait HttpResponse {
    fn is_success(&self) -> bool;
    fn insert_header(&mut self, name: &'static str, value: &[u8])
    -> Result<(), InvalidHeaderValue>;
}

impl<R> HttpRequest for http::Request<R> {
    fn get_header(&self, name: &str) -> Option<&[u8]> {
        self.headers().get(name).map(|v| v.as_bytes())
    }

    fn insert_extension<T: Clone + Send + Sync + 'static>(&mut self, ext: T) -> Option<T> {
        self.extensions_mut().insert(ext)
    }
}

#[derive(Debug)]
pub struct InvalidHeaderValue;

impl Display for InvalidHeaderValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("invalid header value")
    }
}

impl<R> HttpResponse for http::Response<R> {
    fn is_success(&self) -> bool {
        self.status().is_success()
    }

    fn insert_header(
        &mut self,
        name: &'static str,
        value: &[u8],
    ) -> Result<(), InvalidHeaderValue> {
        let value = http::HeaderValue::from_bytes(value).map_err(|_| InvalidHeaderValue)?;
        self.headers_mut().insert(name, value);
        Ok(())
    }
}

#[cfg(feature = "actix-web")]
mod actix_impl {
    use actix_web::HttpMessage;

    use super::*;
    impl HttpRequest for actix_web::HttpRequest {
        fn get_header(&self, name: &str) -> Option<&[u8]> {
            self.headers().get(name).map(|v| v.as_bytes())
        }

        fn insert_extension<T: Clone + Send + Sync + 'static>(&mut self, ext: T) -> Option<T> {
            self.extensions_mut().insert(ext)
        }
    }

    impl<B> HttpResponse for actix_web::HttpResponse<B> {
        fn is_success(&self) -> bool {
            self.status().is_success()
        }

        fn insert_header(
            &mut self,
            name: &'static str,
            value: &[u8],
        ) -> Result<(), InvalidHeaderValue> {
            let value = actix_web::http::header::HeaderValue::from_bytes(value)
                .map_err(|_| InvalidHeaderValue)?;
            let name = actix_web::http::header::HeaderName::from_static(name);
            self.headers_mut().insert(name, value);
            Ok(())
        }
    }
}
