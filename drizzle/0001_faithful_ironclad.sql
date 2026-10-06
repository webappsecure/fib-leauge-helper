CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`number` integer NOT NULL,
	`city` text,
	`name` text,
	`gm_name` text,
	`gm_risk` text,
	`gm_dev_focus` text,
	`gm_team_building` text,
	`manager_name` text,
	`ballpark_name` text,
	`ballpark_quality` text DEFAULT 'neutral' NOT NULL,
	`city_roll` integer,
	`gm_risk_roll` integer,
	`gm_dev_focus_roll` integer,
	`gm_team_building_roll` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_league_number_unique` ON `teams` (`league_id`,`number`);