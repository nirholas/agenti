use crate::error::{ApiError, Result};
use chrono::prelude::*;
use scanner::generate_eth;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Serialize, Deserialize)]
pub struct Customer {
    pub id: i32,
    pub account: String,
    pub eth: String,
    pub updated_at: NaiveDateTime,
}

impl Customer {
    pub async fn get(id: i32, db: &PgPool) -> Result<Self> {
        let res = query_as!(Self, "SELECT * FROM customers WHERE id=$1", id)
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    pub async fn get_by_account(account: &str, db: &PgPool) -> Result<Self> {
        let res = query_as!(Self, "SELECT * FROM customers WHERE account=$1", account)
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    /// get or insert the account by given account
    pub async fn get_or_insert(account: String, db: &PgPool, mem: &str) -> Result<Self> {
        if let Ok(mut a) = Self::get_by_account(&account, db).await {
            // check customer has pay account
            if a.eth.is_empty() {
                let (_, eth) = generate_eth(0, a.id, mem).map_err(|_err| ApiError::Internal)?;
                a.eth = eth;
                let _ = query!("UPDATE customers SET eth=$1 WHERE id=$2", a.eth, a.id)
                    .execute(db)
                    .await?;
            }

            Ok(a)
        } else {
            let now = Utc::now().naive_utc();
            let id = query_scalar!(
                "INSERT INTO customers(account,eth,updated_at) VALUES ($1,$2,$3) RETURNING id",
                account,
                "",
                now
            )
            .fetch_one(db)
            .await?;

            let (_, eth) = generate_eth(0, id, mem).map_err(|_err| ApiError::Internal)?;
            // Add more accounts
            let _ = query!("UPDATE customers SET eth=$1 WHERE id=$2", eth, id)
                .execute(db)
                .await?;

            Ok(Self {
                id,
                account,
                eth,
                updated_at: now,
            })
        }
    }
}
