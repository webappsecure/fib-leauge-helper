CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`team_id` integer,
	`slot` text,
	`kind` text NOT NULL,
	`natural_position` text NOT NULL,
	`name` text,
	`name_list_id` integer,
	`age` integer NOT NULL,
	`grade` text,
	`grade_ceiling` text,
	`hr_tendency` text,
	`stamina` integer,
	`breakthrough_used` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_team_slot_unique` ON `players` (`team_id`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_league_name_unique` ON `players` (`league_id`,`name_list_id`);--> statement-breakpoint
CREATE TABLE `rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`attribute` text NOT NULL,
	`table_key` text NOT NULL,
	`dice` text NOT NULL,
	`result` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rolls_player_attribute_unique` ON `rolls` (`player_id`,`attribute`);