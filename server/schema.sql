CREATE TABLE IF NOT EXISTS bookings (
 id VARCHAR(32) PRIMARY KEY, reference VARCHAR(40) NOT NULL UNIQUE,
 owner VARCHAR(80) NOT NULL, request_key VARCHAR(80) NOT NULL,
 details MEDIUMTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'requested',
 created_at VARCHAR(30) NOT NULL,
 UNIQUE KEY booking_owner_request (owner,request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS orders (
 id VARCHAR(32) PRIMARY KEY, booking_id VARCHAR(32) NOT NULL UNIQUE,
 owner VARCHAR(80) NOT NULL, request_key VARCHAR(80) NOT NULL,
 items MEDIUMTEXT NOT NULL, subtotal INT NOT NULL, notes TEXT NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'requested', created_at VARCHAR(30) NOT NULL,
 FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS food_orders (
 id VARCHAR(32) PRIMARY KEY, reference VARCHAR(40) NOT NULL UNIQUE,
 owner VARCHAR(80) NOT NULL, request_key VARCHAR(80) NOT NULL,
 details MEDIUMTEXT NOT NULL, items MEDIUMTEXT NOT NULL, subtotal INT NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'requested', created_at VARCHAR(30) NOT NULL,
 updated_at VARCHAR(30) NOT NULL,
 UNIQUE KEY food_owner_request (owner,request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS settings (
 `key` VARCHAR(100) PRIMARY KEY, value MEDIUMTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS admin_mfa (
 owner_key VARCHAR(64) PRIMARY KEY, secret TEXT NULL, pending_secret TEXT NULL,
 pending_expires BIGINT NOT NULL DEFAULT 0, enabled INT NOT NULL DEFAULT 0,
 last_counter BIGINT NOT NULL DEFAULT -1, attempts INT NOT NULL DEFAULT 0,
 window_started BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash VARCHAR(64) PRIMARY KEY, owner_key VARCHAR(64) NOT NULL,
 expires_at BIGINT NOT NULL, KEY session_expiry(expires_at),
 FOREIGN KEY (owner_key) REFERENCES admin_mfa(owner_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
