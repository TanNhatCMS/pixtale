use anyhow::anyhow;
use sqlx::SqlitePool;
use tauri::{App, Manager};

// 数据库初始化：使用应用代码版本管理 SQLite schema，不依赖 SQLX migration 表。

/// 当前数据库结构版本，数据库升级时递增这个值。
pub const DATABASE_VERSION: i64 = 1;

const DATABASE_SCHEMA: &str = include_str!("schema.sql");

/// 初始化数据库并在结构版本变化时执行当前 schema SQL。
pub fn initialize(app: &mut App) -> tauri::Result<()> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| tauri::Error::Anyhow(anyhow!(error)))?;
    std::fs::create_dir_all(&directory).map_err(|error| tauri::Error::Anyhow(anyhow!(error)))?;
    let database_url = format!("sqlite://{}", directory.join("pixtale.db").display());

    tauri::async_runtime::block_on(async move {
        let pool = SqlitePool::connect(&database_url).await?;
        let settings_exists = sqlx::query_scalar::<_, i64>(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
        )
        .fetch_optional(&pool)
        .await?
        .is_some();

        let current_version = if settings_exists {
            sqlx::query_scalar::<_, i64>("SELECT schema_version FROM settings WHERE id = 1")
                .fetch_optional(&pool)
                .await?
                .unwrap_or(0)
        } else {
            0
        };

        if current_version != DATABASE_VERSION {
            let mut transaction = pool.begin().await?;
            sqlx::raw_sql(DATABASE_SCHEMA)
                .execute(&mut *transaction)
                .await?;
            sqlx::query("UPDATE settings SET schema_version = ? WHERE id = 1")
                .bind(DATABASE_VERSION)
                .execute(&mut *transaction)
                .await?;
            transaction.commit().await?;
        }

        Ok::<(), sqlx::Error>(())
    })
    .map_err(|error| tauri::Error::Anyhow(anyhow!(error)))?;

    Ok(())
}
