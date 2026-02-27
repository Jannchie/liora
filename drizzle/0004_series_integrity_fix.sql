CREATE UNIQUE INDEX IF NOT EXISTS `Series_slug_unique` ON `Series` (`slug`);
CREATE TABLE IF NOT EXISTS `SeriesFile` (
	`seriesId` integer NOT NULL,
	`fileId` integer NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`seriesId`, `fileId`),
	FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `SeriesFile_series_sort_idx` ON `SeriesFile` (`seriesId`,`sortOrder`);
CREATE INDEX IF NOT EXISTS `SeriesFile_file_idx` ON `SeriesFile` (`fileId`);
