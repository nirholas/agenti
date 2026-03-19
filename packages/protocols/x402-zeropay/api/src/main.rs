#[macro_use]
extern crate tracing;

#[macro_use]
extern crate sqlx;

mod api;
mod error;
mod models;

use axum::{
    Router,
    http::Method,
    routing::{get, post},
};
use clap::Parser;
use models::Storage;
use redis::Client as RedisClient;
use scanner::{ChainType, ScannerConfig, ScannerMessage, ScannerService};
use sqlx::{
    any::Any as SqlxAny,
    migrate::MigrateDatabase,
    postgres::{PgPool, PgPoolOptions},
};
use std::{net::SocketAddr, sync::Arc};
use tokio::{net::TcpListener, sync::mpsc::UnboundedSender};
use tower_http::cors::{Any, CorsLayer};
use tracing::level_filters::LevelFilter;
use x402::{Evm8004Registry, EvmScheme, Facilitator};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Command {
    /// Service port
    #[arg(long, env = "PORT", default_value_t = 9000)]
    port: u16,

    /// Database URL
    #[arg(long, env = "DATABASE_URL")]
    database: String,

    /// Redis URL
    #[arg(long, env = "REDIS_URL", default_value = "redis://127.0.0.1:6379")]
    redis: String,

    /// Account system mnemonics
    #[arg(long, env = "MNEMONICS")]
    mnemonics: String,

    /// Main wallet which used to receive money
    #[arg(long, env = "WALLET")]
    wallet: String,

    /// Apikey for auth
    #[arg(long, env = "APIKEY")]
    apikey: String,

    /// Webhook when new event emit
    #[arg(long, env = "WEBHOOK")]
    webhook: Option<String>,

    /// Scanner chains configure file path
    #[arg(long, env = "SCANNER_CONFIG", default_value = "config.toml")]
    scanner_config: String,

    /// EIP-8004 registry agent id
    #[arg(long, env = "AGENT_ID")]
    agent_id: Option<i64>,

    /// EIP-8004 registry agent identity contract
    #[arg(long, env = "AGENT_IDENTITY")]
    agent_identity: Option<String>,
}

#[derive(Clone)]
struct AppState {
    db: PgPool,
    redis: RedisClient,
    mnemonics: String,
    apikey: String,
    facilitator: Arc<Facilitator>,
    _sender: UnboundedSender<ScannerMessage>,
}

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt()
        .with_max_level(LevelFilter::INFO)
        .init();
    sqlx::any::install_default_drivers();

    let args = Command::parse();
    let scanner_str = std::fs::read_to_string(&args.scanner_config).unwrap();
    let scanner_config: ScannerConfig = toml::from_str(&scanner_str).unwrap();

    // setup database & init
    let _ = SqlxAny::create_database(&args.database).await;
    let db = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&args.database)
        .await
    {
        Ok(pool) => {
            info!("✅ Connection to the database is successful!");
            pool
        }
        Err(err) => {
            error!("🔥 Failed to connect to the database: {:?}", err);
            std::process::exit(1);
        }
    };

    migrate!().run(&db).await.expect("Migrations failed");

    // setup redis connection
    let redis = match RedisClient::open(args.redis.clone()) {
        Ok(client) => {
            // try connect to check
            let _ = client.get_multiplexed_async_connection().await.unwrap();
            info!("✅ Redis connection established!");
            client
        }
        Err(err) => {
            error!("🔥 Failed to connect to Redis: {:?}", err);
            std::process::exit(1);
        }
    };

    // running listening chain & tokens
    let storage = Storage {
        db: db.clone(),
        redis: redis.clone(),
        apikey: args.apikey.clone(),
        webhook: args.webhook,
        wallet: args.wallet,
    };
    let (_sender, x402_assets) =
        ScannerService::new(storage, args.mnemonics.clone(), scanner_config)
            .await
            .unwrap()
            .run()
            .await
            .unwrap();

    // building x402 facilitator
    let agent = match (args.agent_id, args.agent_identity) {
        (Some(agent_id), Some(identity)) => Some(Evm8004Registry { agent_id, identity }),
        _ => None,
    };
    let mut facilitator = Facilitator::new();
    for c in x402_assets {
        match c.ctype {
            ChainType::Evm => {
                let mut scheme = EvmScheme::new(&c.rpc, &c.network, &c.signer, agent.clone())
                    .await
                    .unwrap();
                for asset in c.assets {
                    // try x402 asset
                    scheme.asset(&asset.address).await.unwrap();
                }
                facilitator.register(scheme);
            }
        }
    }

    let app_state = Arc::new(AppState {
        _sender,
        db,
        redis,
        facilitator: Arc::new(facilitator),
        apikey: args.apikey,
        mnemonics: args.mnemonics,
    });

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_origin(Any)
        .allow_headers(Any);

    let router = Router::new()
        .route("/sessions", post(api::create_session))
        .route("/sessions/{id}", get(api::get_session))
        .route("/x402/requirements", get(api::x402_requirements))
        .route("/x402/payments", post(api::x402_payment))
        .route("/x402/support", get(api::x402_support))
        .route("/x402/discovery", get(api::x402_discovery))
        .with_state(app_state)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], args.port));
    let listener = TcpListener::bind(&addr).await.unwrap();
    info!("🚀 Server is running on 0.0.0.0:{}", args.port);

    axum::serve(listener, router).await.unwrap()
}
