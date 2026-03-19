use crate::error::Result;
use chrono::{Days, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Serialize, Deserialize)]
pub struct Session {
    pub id: i32,
    pub customer: i32,
    pub deposit: Option<i32>,
    pub amount: i32,
    pub sent: bool,
    pub updated_at: NaiveDateTime,
    pub expired_at: NaiveDateTime,
}

impl Session {
    pub async fn get(id: i32, db: &PgPool) -> Result<Self> {
        let res = query_as!(Self, "SELECT * FROM sessions WHERE id=$1", id)
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    pub async fn get_by_deposit(did: i32, db: &PgPool) -> Result<Self> {
        let res = query_as!(Self, "SELECT * FROM sessions WHERE deposit=$1", did)
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    pub async fn list_unused(customer: i32, db: &PgPool) -> Result<Vec<Session>> {
        let res = query_as!(
            Self,
            "SELECT * FROM sessions WHERE customer=$1 AND deposit IS NULL ORDER BY id DESC",
            customer,
        )
        .fetch_all(db)
        .await?;

        Ok(res)
    }

    pub async fn insert(customer: i32, amount: i32, db: &PgPool) -> Result<Self> {
        let now = Utc::now().naive_utc();
        let expired_at = now.checked_add_days(Days::new(1)).unwrap_or(now); // 24h
        let res = query_as!(
            Self,
            "INSERT INTO sessions(customer,amount,sent,updated_at,expired_at) VALUES ($1,$2,$3,$4,$5) RETURNING *",
            customer,
            amount,
            false,
            now,
            expired_at,
        )
            .fetch_one(db)
            .await?;

        Ok(res)
    }

    pub async fn used(&self, deposit: i32, db: &PgPool) -> Result<()> {
        let now = Utc::now().naive_utc();
        let _ = query!(
            "UPDATE sessions SET deposit=$1, updated_at=$2 WHERE id=$3",
            deposit,
            now,
            self.id
        )
        .execute(db)
        .await?;

        Ok(())
    }

    pub async fn sent(&self, db: &PgPool) -> Result<()> {
        let _ = query!("UPDATE sessions SET sent=true WHERE id=$1", self.id)
            .execute(db)
            .await?;

        Ok(())
    }
}
