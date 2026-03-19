use crate::error::Result;
use chrono::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Serialize, Deserialize)]
pub struct ChainBlock {
    pub name: String,
    pub block: i64,
    pub updated_at: NaiveDateTime,
}

impl ChainBlock {
    pub async fn get_block(name: &str, db: &PgPool) -> i64 {
        if let Ok(res) = query_as!(Self, "SELECT * FROM chains WHERE name=$1", name)
            .fetch_one(db)
            .await
        {
            res.block
        } else {
            0
        }
    }

    pub async fn insert(name: &str, block: i64, db: &PgPool) -> Result<()> {
        let now = Utc::now().naive_utc();
        if Self::get_block(name, db).await == 0 {
            query!(
                "INSERT INTO chains(name,block,updated_at) VALUES ($1,$2,$3)",
                name,
                block,
                now,
            )
            .execute(db)
            .await?;
        } else {
            query!(
                "UPDATE chains SET block=$1,updated_at=$2 WHERE name = $3",
                block,
                now,
                name
            )
            .execute(db)
            .await?;
        }

        Ok(())
    }
}
