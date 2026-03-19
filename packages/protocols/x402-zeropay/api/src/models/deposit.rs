use crate::error::Result;
use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Serialize, Deserialize)]
pub struct Deposit {
    pub id: i32,
    pub customer: i32,
    pub amount: i32,
    pub tx: String,
    pub created_at: NaiveDateTime,
    pub settled_amount: Option<i32>,
    pub settled_tx: Option<String>,
    pub settled_at: Option<NaiveDateTime>,
}

impl Deposit {
    pub async fn get(id: i32, db: &PgPool) -> Result<Self> {
        let res = query_as!(Self, "SELECT * FROM deposits WHERE id=$1", id)
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    pub async fn insert(customer: i32, amount: i32, tx: String, db: &PgPool) -> Result<i32> {
        let now = Utc::now().naive_utc();
        let id = query_scalar!(
            "INSERT INTO deposits(customer,amount,tx,created_at) VALUES ($1,$2,$3,$4) RETURNING id",
            customer,
            amount,
            tx,
            now,
        )
        .fetch_one(db)
        .await?;

        Ok(id)
    }

    pub async fn settle(id: i32, amount: i32, tx: String, db: &PgPool) -> Result<()> {
        let now = Utc::now().naive_utc();
        let _ = query!(
            "UPDATE deposits SET settled_amount=$1,settled_tx=$2,settled_at=$3 WHERE id=$4",
            amount,
            tx,
            now,
            id
        )
        .execute(db)
        .await?;

        Ok(())
    }
}
