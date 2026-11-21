CREATE TABLE `admin_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`reset_token_hash` text,
	`reset_expires` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started` integer DEFAULT 0 NOT NULL
);
