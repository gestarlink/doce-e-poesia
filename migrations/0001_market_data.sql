-- Execute uma vez no Cloudflare D1 -> Console.
CREATE TABLE IF NOT EXISTS market_candles (
 asset TEXT NOT NULL,
 t INTEGER NOT NULL,
 o REAL NOT NULL,
 h REAL NOT NULL,
 l REAL NOT NULL,
 cl REAL NOT NULL,
 received_at INTEGER NOT NULL,
 PRIMARY KEY (asset, t)
);
CREATE TABLE IF NOT EXISTS market_feed_state (
 asset TEXT PRIMARY KEY NOT NULL,
 last_timestamp INTEGER NOT NULL,
 received_at INTEGER NOT NULL
);
