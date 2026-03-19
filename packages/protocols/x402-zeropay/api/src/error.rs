use axum::{
    Json,
    response::{IntoResponse, Response},
};

pub type Result<T> = core::result::Result<T, ApiError>;

#[derive(Debug)]
pub enum ApiError {
    IO,
    Internal,
    UserAuth,
    NotFound,
    Verify(String),
}

impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        error!("io: {}", e);
        ApiError::IO
    }
}
impl From<String> for ApiError {
    fn from(e: String) -> Self {
        ApiError::Verify(e)
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(_e: sqlx::Error) -> ApiError {
        ApiError::NotFound
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let error = match self {
            Self::IO => "internal server error",
            Self::Internal => "internal error",
            Self::UserAuth => "user auth error",
            Self::NotFound => "not found",
            Self::Verify(msg) => &msg.into_boxed_str(),
        };

        Json(serde_json::json!({
            "status": "failure",
            "error": error
        }))
        .into_response()
    }
}
