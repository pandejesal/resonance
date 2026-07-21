FROM rust:1-slim-bookworm AS builder

WORKDIR /app
COPY Cargo.toml ./
COPY backend/Cargo.toml ./backend/Cargo.toml
COPY backend/migrations ./backend/migrations
RUN mkdir -p backend/src && echo "fn main() {}" > backend/src/main.rs
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release -p resonance-backend 2>/dev/null || true

COPY backend/src ./backend/src
RUN touch backend/src/main.rs && cargo build --release -p resonance-backend

FROM node:20-slim AS frontend-builder

WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/resonance-backend .
COPY --from=frontend-builder /app/dist ./static
COPY backend/migrations ./migrations

ENV RUST_LOG=info
ENV DATABASE_URL=/app/data/resonance.db
ENV HOST=0.0.0.0
ENV PORT=8080

VOLUME ["/app/data", "/music"]

EXPOSE 8080

CMD ["./resonance-backend"]
