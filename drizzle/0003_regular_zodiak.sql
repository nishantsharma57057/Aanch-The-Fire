CREATE TABLE `admin_mfa` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`secret` text,
	`pending_secret` text,
	`pending_expires` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`last_counter` integer DEFAULT -1 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`owner_key`) REFERENCES `admin_mfa`(`owner_key`) ON UPDATE no action ON DELETE no action
);
