CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`owner` text NOT NULL,
	`request_key` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `booking_owner_request` ON `bookings` (`owner`,`request_key`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`owner` text NOT NULL,
	`request_key` text NOT NULL,
	`items` text NOT NULL,
	`subtotal` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_order_per_booking` ON `orders` (`booking_id`);