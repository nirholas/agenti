use actix_web::{
    App, Error, HttpMessage, HttpResponse, HttpServer,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::{self, Next},
    web,
};
use alloy_primitives::address;
use serde_json::json;
use solana_pubkey::pubkey;
use url::Url;
use url_macro::url;
use x402_kit::{
    core::Resource,
    facilitator_client::{FacilitatorClient, StandardFacilitatorClient},
    networks::{evm::assets::UsdcBaseSepolia, svm::assets::UsdcSolanaDevnet},
    paywall::{paywall::PayWall, processor::PaymentState},
    schemes::{exact_evm::ExactEvm, exact_svm::ExactSvm},
    transport::Accepts,
};

struct AppState {
    facilitator: StandardFacilitatorClient,
}

async fn standard_paywall(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let state = req
        .app_data::<web::Data<AppState>>()
        .expect("AppState not configured")
        .clone();

    let (http_req, payload) = req.into_parts();
    let http_req_clone = http_req.clone();

    let paywall = PayWall::builder()
        .facilitator(state.facilitator.clone())
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
    let response = paywall
        .handle_payment(http_req, |http_req| async move {
            let srv_req = ServiceRequest::from_parts(http_req, payload);
            match next.call(srv_req).await {
                Ok(res) => res.map_into_boxed_body().into_parts().1,
                Err(err) => err.error_response().map_into_boxed_body(),
            }
        })
        .await
        .map_err(Error::from)?;

    Ok(ServiceResponse::new(http_req_clone, response))
}

async fn custom_paywall(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let state = req
        .app_data::<web::Data<AppState>>()
        .expect("AppState not configured")
        .clone();

    let (http_req, payload) = req.into_parts();
    let http_req_clone = http_req.clone();

    let paywall = PayWall::builder()
        .facilitator(state.facilitator.clone())
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
        .process_request(http_req)
        .map_err(Error::from)?
        .settle()
        .await
        .map_err(Error::from)?
        .run_handler(|http_req| async move {
            let srv_req = ServiceRequest::from_parts(http_req, payload);
            match next.call(srv_req).await {
                Ok(res) => res.map_into_boxed_body().into_parts().1,
                Err(err) => err.error_response().map_into_boxed_body(),
            }
        })
        .await
        .map_err(Error::from)?
        .response();

    Ok(ServiceResponse::new(http_req_clone, response))
}

async fn multi_payments_paywall(
    req: ServiceRequest,
    next: Next<impl MessageBody + 'static>,
) -> Result<ServiceResponse<impl MessageBody>, Error> {
    let state = req
        .app_data::<web::Data<AppState>>()
        .expect("AppState not configured")
        .clone();

    let (http_req, payload) = req.into_parts();
    let http_req_clone = http_req.clone();

    let paywall = PayWall::builder()
        .facilitator(state.facilitator.clone())
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
                .url(url!("https://example.com/resource/multi_payments"))
                .description("X402 payment protected resource")
                .mime_type("application/json")
                .build(),
        )
        .build();

    // Run the paywall
    let response = paywall
        .handle_payment(http_req, |http_req| async move {
            let srv_req = ServiceRequest::from_parts(http_req, payload);
            match next.call(srv_req).await {
                Ok(res) => res.map_into_boxed_body().into_parts().1,
                Err(err) => err.error_response().map_into_boxed_body(),
            }
        })
        .await
        .map_err(Error::from)?;

    Ok(ServiceResponse::new(http_req_clone, response))
}

/// Example handler for a protected resource.
///
/// The `PayWall` middleware will inject the `PaymentState` into the request extensions.
async fn example_handler(req: actix_web::HttpRequest) -> HttpResponse {
    let extensions = req.extensions();
    let payment_state = extensions.get::<PaymentState>();

    HttpResponse::Ok().json(json!({
        "message": "You have accessed a protected resource!",
        "verify_state": payment_state
            .and_then(|ps| serde_json::to_value(&ps.verified).ok())
            .unwrap_or(json!(null)),
        "settle_state": payment_state
            .and_then(|ps| serde_json::to_value(&ps.settled).ok())
            .unwrap_or(json!(null)),
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    tracing_subscriber::fmt::init();

    let facilitator_url = std::env::var("FACILITATOR_URL")
        .expect("Please set `FACILITATOR_URL` in environment variables");
    let facilitator_url =
        Url::parse(&facilitator_url).expect("FACILITATOR_URL must be a valid URL");
    tracing::info!("Using facilitator at {}", facilitator_url);
    let facilitator = FacilitatorClient::from_url(facilitator_url);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid u16 integer");

    tracing::info!("Starting server on 0.0.0.0:{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(AppState {
                facilitator: facilitator.clone(),
            }))
            .service(
                web::resource("/resource/standard")
                    .wrap(middleware::from_fn(standard_paywall))
                    .route(web::post().to(example_handler)),
            )
            .service(
                web::resource("/resource/custom")
                    .wrap(middleware::from_fn(custom_paywall))
                    .route(web::post().to(example_handler)),
            )
            .service(
                web::resource("/resource/multi_payments")
                    .wrap(middleware::from_fn(multi_payments_paywall))
                    .route(web::post().to(example_handler)),
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
