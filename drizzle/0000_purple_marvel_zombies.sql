CREATE TABLE `leagues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_year` integer NOT NULL,
	`team_count` integer NOT NULL,
	`use_dh` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
