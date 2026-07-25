---
name: rust-backend-security
description: Security and performance patterns for Actix-web + SQLx backends
---

# Rust Backend Security

## SQL Injection Prevention
```rust
// NEVER use format!() with user input
// BAD:
let q = format!("SELECT * FROM tracks WHERE artist = '{}'", artist);
// GOOD (parameterized):
let tracks = sqlx::query_as::<_, Track>("SELECT * FROM tracks WHERE artist = ?")
    .bind(&artist)
    .fetch_all(&db)
    .await?;
```

## Input Validation
```rust
// Validate all user input at the handler boundary
fn validate_library_path(path: &str) -> Result<(), String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| "Path does not exist")?;
    // Prevent path traversal
    if !canonical.starts_with("/path/to/allowed/") {
        return Err("Access denied".into());
    }
    Ok(())
}
```

## CORS Configuration
```rust
// NEVER use allow_any_origin() with supports_credentials()
// BAD:
CORS::default().allow_any_origin().supports_credentials()
// GOOD:
CORS::default()
    .allowed_origin("http://localhost:5173")
    .allowed_origin("http://127.0.0.1:8080")
    .supports_credentials()
```

## Streaming Large Files
```rust
// NEVER read entire file into memory
// BAD:
let data = std::fs::read(&path)?;
// GOOD (streaming):
use actix_files::NamedFile;
let file = NamedFile::open(&path)?;
```

## Error Propagation
```rust
// Prefer ? operator over .ok() for critical operations
// .ok() is fine for non-critical logging
// ? is needed for data integrity operations
tx.commit().await?;  // NOT .ok()
```

## Rate Limiting
```rust
// Add rate limiting to auth endpoints
// Use actix-limiter or implement token bucket
```

## Default Credentials
```rust
// NEVER ship default passwords in production
// Require password change on first login
// Or generate a random password and display it once
```
