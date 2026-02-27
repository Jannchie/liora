CREATE TABLE `Series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`coverFileId` integer,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`coverFileId`) REFERENCES `File`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE UNIQUE INDEX `Series_slug_unique` ON `Series` (`slug`);
CREATE TABLE `SeriesFile` (
	`seriesId` integer NOT NULL,
	`fileId` integer NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`seriesId`, `fileId`),
	FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `SeriesFile_series_sort_idx` ON `SeriesFile` (`seriesId`,`sortOrder`);
CREATE INDEX `SeriesFile_file_idx` ON `SeriesFile` (`fileId`);
