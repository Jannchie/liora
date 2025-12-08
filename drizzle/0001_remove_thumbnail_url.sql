CREATE TABLE `File_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`imageUrl` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`originalName` text DEFAULT '' NOT NULL,
	`fanworkTitle` text DEFAULT '' NOT NULL,
	`characterList` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`locationName` text DEFAULT '' NOT NULL,
	`latitude` real,
	`longitude` real,
	`cameraModel` text DEFAULT '' NOT NULL,
	`aperture` text DEFAULT '' NOT NULL,
	`focalLength` text DEFAULT '' NOT NULL,
	`iso` text DEFAULT '' NOT NULL,
	`shutterSpeed` text DEFAULT '' NOT NULL,
	`captureTime` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`genre` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `File_new` (
	`id`,
	`title`,
	`description`,
	`imageUrl`,
	`width`,
	`height`,
	`originalName`,
	`fanworkTitle`,
	`characterList`,
	`location`,
	`locationName`,
	`latitude`,
	`longitude`,
	`cameraModel`,
	`aperture`,
	`focalLength`,
	`iso`,
	`shutterSpeed`,
	`captureTime`,
	`metadata`,
	`genre`,
	`createdAt`
) SELECT
	`id`,
	`title`,
	`description`,
	`imageUrl`,
	`width`,
	`height`,
	`originalName`,
	`fanworkTitle`,
	`characterList`,
	`location`,
	`locationName`,
	`latitude`,
	`longitude`,
	`cameraModel`,
	`aperture`,
	`focalLength`,
	`iso`,
	`shutterSpeed`,
	`captureTime`,
	`metadata`,
	`genre`,
	`createdAt`
FROM `File`;
--> statement-breakpoint
DROP TABLE `File`;
--> statement-breakpoint
ALTER TABLE `File_new` RENAME TO `File`;
--> statement-breakpoint
INSERT OR REPLACE INTO sqlite_sequence(name, seq)
SELECT 'File', COALESCE(MAX(`id`), 0) FROM `File`;
