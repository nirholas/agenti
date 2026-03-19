use http::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{
    facilitator::{
        Facilitator, PaymentRequest, SettleFailed, SettleResult, SettleSuccess, SupportedResponse,
        VerifyInvalid, VerifyResult, VerifyValid,
    },
    transport::{PaymentPayload, PaymentRequirements},
};

/// A remote facilitator client that communicates over HTTP.
///
/// You can customize the request and response types for verification and settlement
///
/// # Type Parameters
///
/// - `VReq`: The request type for verification, must be convertible from `FacilitatorPaymentRequest` and serializable.
/// - `VRes`: The response type for verification, must be convertible into `FacilitatorVerifyResponse` and deserializable.
/// - `SReq`: The request type for settlement, must be convertible from `FacilitatorPaymentRequest` and serializable.
/// - `SRes`: The response type for settlement, must be convertible into `FacilitatorSettleResponse` and deserializable.
#[derive(Debug, Clone)]
pub struct FacilitatorClient<VReq, VRes, SReq, SRes>
where
    VReq: From<PaymentRequest> + Serialize,
    VRes: IntoVerifyResponse + for<'de> Deserialize<'de>,
    SReq: From<PaymentRequest> + Serialize,
    SRes: IntoSettleResponse + for<'de> Deserialize<'de>,
{
    pub base_url: Url,
    pub client: reqwest_middleware::ClientWithMiddleware,
    pub supported_headers: HeaderMap,
    pub verify_headers: HeaderMap,
    pub settle_headers: HeaderMap,
    pub _phantom: std::marker::PhantomData<(VReq, VRes, SReq, SRes)>,
}

pub trait IntoVerifyResponse {
    fn into_verify_response(self) -> VerifyResult;
}

pub trait IntoSettleResponse {
    fn into_settle_response(self) -> SettleResult;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultPaymentRequest {
    pub payment_payload: PaymentPayload,
    pub payment_requirements: PaymentRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultVerifyResponse {
    pub is_valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invalid_reason: Option<String>,
    pub payer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultSettleResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_reason: Option<String>,
    pub payer: Option<String>,
    pub transaction: Option<String>,
    pub network: Option<String>,
}

impl From<PaymentRequest> for DefaultPaymentRequest {
    fn from(request: PaymentRequest) -> Self {
        DefaultPaymentRequest {
            payment_payload: request.payment_payload,
            payment_requirements: request.payment_requirements,
        }
    }
}

impl IntoVerifyResponse for DefaultVerifyResponse {
    fn into_verify_response(self) -> VerifyResult {
        if self.is_valid {
            VerifyResult::valid(VerifyValid {
                payer: self.payer.unwrap_or_default(),
            })
        } else {
            VerifyResult::invalid(VerifyInvalid {
                invalid_reason: self.invalid_reason.unwrap_or_default(),
                payer: self.payer,
            })
        }
    }
}

impl IntoSettleResponse for DefaultSettleResponse {
    fn into_settle_response(self) -> SettleResult {
        if self.success {
            SettleResult::success(SettleSuccess {
                payer: self.payer.unwrap_or_default(),
                transaction: self.transaction.unwrap_or_default(),
                network: self.network.unwrap_or_default(),
            })
        } else {
            SettleResult::failed(SettleFailed {
                error_reason: self.error_reason.unwrap_or_default(),
                payer: self.payer,
            })
        }
    }
}

/// A type alias for a RemoteFacilitatorClient using the default request and response types.
pub type StandardFacilitatorClient = FacilitatorClient<
    DefaultPaymentRequest,
    DefaultVerifyResponse,
    DefaultPaymentRequest,
    DefaultSettleResponse,
>;

impl<VReq, VRes, SReq, SRes> FacilitatorClient<VReq, VRes, SReq, SRes>
where
    VReq: From<PaymentRequest> + Serialize,
    VRes: IntoVerifyResponse + for<'de> Deserialize<'de>,
    SReq: From<PaymentRequest> + Serialize,
    SRes: IntoSettleResponse + for<'de> Deserialize<'de>,
{
    pub fn new_from_url(base_url: Url) -> Self {
        FacilitatorClient {
            base_url,
            client: Default::default(),
            supported_headers: HeaderMap::new(),
            verify_headers: HeaderMap::new(),
            settle_headers: HeaderMap::new(),
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn with_verify_request_type<NewVReq>(self) -> FacilitatorClient<NewVReq, VRes, SReq, SRes>
    where
        NewVReq: From<PaymentRequest> + Serialize,
    {
        FacilitatorClient {
            base_url: self.base_url,
            client: self.client,
            supported_headers: self.supported_headers,
            verify_headers: self.verify_headers,
            settle_headers: self.settle_headers,
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn with_verify_response_type<NewVRes>(self) -> FacilitatorClient<VReq, NewVRes, SReq, SRes>
    where
        NewVRes: IntoVerifyResponse + for<'de> Deserialize<'de>,
    {
        FacilitatorClient {
            supported_headers: self.supported_headers,
            base_url: self.base_url,
            verify_headers: self.verify_headers,
            settle_headers: self.settle_headers,
            client: self.client,
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn with_settle_request_type<NewSReq>(self) -> FacilitatorClient<VReq, VRes, NewSReq, SRes>
    where
        NewSReq: From<PaymentRequest> + Serialize,
    {
        FacilitatorClient {
            supported_headers: self.supported_headers,
            base_url: self.base_url,
            verify_headers: self.verify_headers,
            settle_headers: self.settle_headers,
            client: self.client,
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn with_settle_response_type<NewSRes>(self) -> FacilitatorClient<VReq, VRes, SReq, NewSRes>
    where
        NewSRes: IntoSettleResponse + for<'de> Deserialize<'de>,
    {
        FacilitatorClient {
            supported_headers: self.supported_headers,
            base_url: self.base_url,
            verify_headers: self.verify_headers,
            settle_headers: self.settle_headers,
            client: self.client,
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn header(mut self, key: &HeaderName, value: &HeaderValue) -> Self {
        self.supported_headers.insert(key, value.to_owned());
        self.verify_headers.insert(key, value.to_owned());
        self.settle_headers.insert(key, value.to_owned());
        self
    }

    pub fn supported_header(mut self, key: &HeaderName, value: &HeaderValue) -> Self {
        self.supported_headers.insert(key, value.to_owned());
        self
    }

    pub fn verify_header(mut self, key: &HeaderName, value: &HeaderValue) -> Self {
        self.verify_headers.insert(key, value.to_owned());
        self
    }

    pub fn settle_header(mut self, key: &HeaderName, value: &HeaderValue) -> Self {
        self.settle_headers.insert(key, value.to_owned());
        self
    }
}

impl
    FacilitatorClient<
        DefaultPaymentRequest,
        DefaultVerifyResponse,
        DefaultPaymentRequest,
        DefaultSettleResponse,
    >
{
    pub fn from_url(base_url: Url) -> Self {
        FacilitatorClient::new_from_url(base_url)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum FacilitatorClientError {
    #[error("URL parse error: {0}")]
    UrlParseError(#[from] url::ParseError),
    #[error("HTTP request error: {0}")]
    HttpRequestError(#[from] reqwest_middleware::reqwest::Error),
    #[error("HTTP request error: {0}")]
    HttpRequestMiddlewareError(#[from] reqwest_middleware::Error),
    #[error("JSON Serialization/Deserialization error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),
}

impl<VReq, VRes, SReq, SRes> Facilitator for FacilitatorClient<VReq, VRes, SReq, SRes>
where
    VReq: From<PaymentRequest> + Serialize,
    VRes: IntoVerifyResponse + for<'de> Deserialize<'de>,
    SReq: From<PaymentRequest> + Serialize,
    SRes: IntoSettleResponse + for<'de> Deserialize<'de>,
{
    type Error = FacilitatorClientError;

    async fn supported(&self) -> Result<SupportedResponse, Self::Error> {
        let supported = self
            .client
            .get(self.base_url.join("supported")?)
            .headers(self.supported_headers.clone())
            .send()
            .await?
            .json()
            .await?;

        Ok(supported)
    }

    async fn verify(&self, request: PaymentRequest) -> Result<VerifyResult, Self::Error> {
        let result = self
            .client
            .post(self.base_url.join("verify")?)
            .headers(self.verify_headers.clone())
            .json(&VReq::from(request))
            .send()
            .await?
            .json::<VRes>()
            .await?;

        Ok(result.into_verify_response())
    }

    async fn settle(&self, request: PaymentRequest) -> Result<SettleResult, Self::Error> {
        let result = self
            .client
            .post(self.base_url.join("settle")?)
            .headers(self.settle_headers.clone())
            .json(&SReq::from(request))
            .send()
            .await?
            .json::<SRes>()
            .await?;

        Ok(result.into_settle_response())
    }
}
