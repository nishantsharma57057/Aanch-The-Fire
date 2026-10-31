CREATE TABLE `food_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`owner` text NOT NULL,
	`request_key` text NOT NULL,
	`details` text NOT NULL,
	`items` text NOT NULL,
	`subtotal` integer NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `food_orders_reference_unique` ON `food_orders` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `food_owner_request` ON `food_orders` (`owner`,`request_key`);