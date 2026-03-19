//! Reqwest middleware for automatic x402 payment handling.
//!
//! Provides [`X402PaymentMiddleware`], a [`reqwest_middleware::Middleware`] implementation
//! that intercepts HTTP 402 responses, signs a payment using an [`X402Client`],
//! and retries the request with the `PAYMENT-SIGNATURE` header.

use async_trait::async_trait;
use http::Extensions;
use reqwest::{Request, Response, StatusCode, header::HeaderValue};
use reqwest_middleware::{Middleware, Next};
use x402_core::{transport::PaymentRequired, types::Base64EncodedHeader};

use crate::{X402Client, signer::PaymentSigner};

/// Error type for X402 middleware operations.
#[derive(Debug, thiserror::Error)]
pub enum X402MiddlewareError {
    #[error("missing or invalid PAYMENT-REQUIRED header in 402 response")]
    MissingPaymentRequiredHeader,

    #[error("request body is not cloneable, cannot retry with payment")]
    RequestNotCloneable,

    #[error("failed to encode/decode x402 header: {0}")]
    HeaderCodec(#[from] x402_core::errors::Error),

    #[error("payment signing failed: {0}")]
    Signing(#[from] crate::errors::SigningError),
}

/// Reqwest middleware that automatically handles x402 payment flows.
///
/// When a request returns HTTP 402 with a `PAYMENT-REQUIRED` header,
/// this middleware will:
/// 1. Decode the payment requirements from the header
/// 2. Sign a payment using the configured [`X402Client`]
/// 3. Retry the request with the `PAYMENT-SIGNATURE` header
pub struct X402PaymentMiddleware<P> {
    client: X402Client<P>,
}

impl<P> X402PaymentMiddleware<P> {
    /// Create a new middleware wrapping the given signing client.
    pub fn new(client: X402Client<P>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl<P: PaymentSigner + Send + Sync + 'static> Middleware for X402PaymentMiddleware<P> {
    async fn handle(
        &self,
        req: Request,
        extensions: &mut Extensions,
        next: Next<'_>,
    ) -> reqwest_middleware::Result<Response> {
        let retry_req = req.try_clone();
        let response = next.clone().run(req, extensions).await?;

        if response.status() != StatusCode::PAYMENT_REQUIRED {
            return Ok(response);
        }

        let header_str = response
            .headers()
            .get("PAYMENT-REQUIRED")
            .ok_or_else(|| {
                reqwest_middleware::Error::middleware(
                    X402MiddlewareError::MissingPaymentRequiredHeader,
                )
            })?
            .to_str()
            .map_err(|_| {
                reqwest_middleware::Error::middleware(
                    X402MiddlewareError::MissingPaymentRequiredHeader,
                )
            })?;

        let payment_required = PaymentRequired::try_from(Base64EncodedHeader(
            header_str.to_string(),
        ))
        .map_err(|e| reqwest_middleware::Error::middleware(X402MiddlewareError::HeaderCodec(e)))?;

        let payment_payload = self
            .client
            .create_payment(&payment_required)
            .await
            .map_err(|e| reqwest_middleware::Error::middleware(X402MiddlewareError::Signing(e)))?;

        let encoded: Base64EncodedHeader = payment_payload.try_into().map_err(|e| {
            reqwest_middleware::Error::middleware(X402MiddlewareError::HeaderCodec(e))
        })?;

        let mut retry = retry_req.ok_or_else(|| {
            reqwest_middleware::Error::middleware(X402MiddlewareError::RequestNotCloneable)
        })?;
        retry.headers_mut().insert(
            "PAYMENT-SIGNATURE",
            HeaderValue::from_str(&encoded.0).map_err(|_| {
                reqwest_middleware::Error::middleware(
                    X402MiddlewareError::MissingPaymentRequiredHeader,
                )
            })?,
        );

        next.run(retry, extensions).await
    }
}
