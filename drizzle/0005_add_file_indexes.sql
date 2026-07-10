CREATE INDEX IF NOT EXISTS `File_capture_created_id_idx` ON `File` (`captureTime`,`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `File_genre_idx` ON `File` (`genre`);
