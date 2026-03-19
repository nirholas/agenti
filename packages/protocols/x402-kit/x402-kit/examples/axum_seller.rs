use alloy_primitives::address;
use axum::{
    Extension, Json, Router,
    extract::{Request, State},
    middleware::{Next, from_fn_with_state},
    response::{IntoResponse, Response},
    routing::post,
};
use serde_json::{Value, json};
use solana_pubkey::pubkey;
use tower_http::trace::TraceLayer;
use url::Url;
use url_macro::url;
use x402_kit::{
    core::Resource,
    facilitator_client::{FacilitatorClient, StandardFacilitatorClient},
    networks::{evm::assets::UsdcBaseSepolia, svm::assets::UsdcSolanaDevnet},
    paywall::{errors::ErrorResponse, paywall::PayWall, processor::PaymentState},
    schemes::{exact_evm::ExactEvm, exact_svm::ExactSvm},
    transport::Accepts,
};

#[derive(Clone)]
struct PayWallState {
    facilitator: StandardFacilitatorClient,
}

async fn standard_paywall(State(state): State<PayWallState>, req: Request, next: Next) -> Response {
    let paywall = PayWall::builder()
        .facilitator(state.facilitator)
        .accepts(
            ExactEvm::builder()
                .amount(1000)
                .asset(UsdcBaseSepolia)
                .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
                .build(),
        )
        .resource(
            Resource::builder()
                .url(url!("https://example.com/resource/standard"))
                .description("X402 payment protected resource")
                .mime_type("application/json")
                .build(),
        )
        .build();

    // Run the paywall
    paywall
        .handle_payment(req, |req| next.run(req))
        .await
        .unwrap_or_else(|err| err.into_response())
}

async fn custom_paywall(
    State(state): State<PayWallState>,
    req: Request,
    next: Next,
) -> Result<Response, ErrorResponse> {
    let paywall = PayWall::builder()
        .facilitator(state.facilitator)
        .accepts(
            ExactEvm::builder()
                .amount(1000)
                .asset(UsdcBaseSepolia)
                .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
                .build(),
        )
        .resource(
            Resource::builder()
                .url(url!("https://example.com/resource/custom"))
                .description("X402 payment protected resource")
                .mime_type("application/json")
                .build(),
        )
        .build();

    // Skip updating accepts from facilitator, skip verifying, and settle payment before running handler
    let response = paywall
        .process_request(req)?
        .settle()
        .await?
        .run_handler(|req| next.run(req))
        .await?
        .response();

    Ok(response)
}

async fn multi_payments_paywall(
    State(state): State<PayWallState>,
    req: Request,
    next: Next,
) -> Response {
    let paywall = PayWall::builder()
        .facilitator(state.facilitator)
        .accepts(
            Accepts::new()
                .push(
                    ExactEvm::builder()
                        .amount(1000)
                        .asset(UsdcBaseSepolia)
                        .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
                        .build(),
                )
                .push(
                    ExactSvm::builder()
                        .amount(1000)
                        .asset(UsdcSolanaDevnet)
                        .pay_to(pubkey!("Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR"))
                        .build(),
                ),
        )
        .resource(
            Resource::builder()
                .url(url!("https://example.com/resource/standard"))
                .description("X402 payment protected resource")
                .mime_type("application/json")
                .build(),
        )
        .build();

    // Run the paywall
    paywall
        .handle_payment(req, |req| next.run(req))
        .await
        .unwrap_or_else(|err| err.into_response())
}

/// Example handler for a protected resource.
///
/// The `PayWall` middleware will inject the `PaymentState` into the request extensions.
async fn example_handler(Extension(payment_state): Extension<PaymentState>) -> Json<Value> {
    Json(json!({
        "message": "You have accessed a protected resource!",
        "verify_state": serde_json::to_value(&payment_state.verified).unwrap_or(json!(null)),
        "settle_state": serde_json::to_value(&payment_state.settled).unwrap_or(json!(null)),
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let facilitator_url = std::env::var("FACILITATOR_URL")
        .expect("Please set `FACILITATOR_URL` in environment variables");
    let facilitator_url =
        Url::parse(&facilitator_url).expect("FACILITATOR_URL must be a valid URL");
    tracing::info!("Using facilitator at {}", facilitator_url);
    let facilitator = FacilitatorClient::from_url(facilitator_url);
    let state = PayWallState { facilitator };

    let app = Router::new()
        .route(
            "/resource/standard",
            post(example_handler).layer(from_fn_with_state(state.clone(), standard_paywall)),
        )
        .route(
            "/resource/custom",
            post(example_handler).layer(from_fn_with_state(state.clone(), custom_paywall)),
        )
        .route(
            "/resource/multi_payments",
            post(example_handler).layer(from_fn_with_state(state.clone(), multi_payments_paywall)),
        )
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid u16 integer");
    let addr: std::net::SocketAddr = ([0, 0, 0, 0], port).into();

    tracing::info!("Starting server on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    tracing::info!("Server running at http://{}", addr);
    axum::serve(listener, app).await.expect("Server failed");
}
