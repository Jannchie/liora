-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_File" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "fanworkTitle" TEXT NOT NULL DEFAULT '',
    "characterList" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "locationName" TEXT NOT NULL DEFAULT '',
    "latitude" REAL,
    "longitude" REAL,
    "cameraModel" TEXT NOT NULL DEFAULT '',
    "aperture" TEXT NOT NULL DEFAULT '',
    "focalLength" TEXT NOT NULL DEFAULT '',
    "iso" TEXT NOT NULL DEFAULT '',
    "shutterSpeed" TEXT NOT NULL DEFAULT '',
    "captureTime" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "genre" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_File" ("aperture", "cameraModel", "captureTime", "characterList", "createdAt", "description", "fanworkTitle", "focalLength", "height", "id", "imageUrl", "iso", "latitude", "location", "locationName", "longitude", "metadata", "originalName", "shutterSpeed", "thumbnailUrl", "title", "width") SELECT "aperture", "cameraModel", "captureTime", "characterList", "createdAt", "description", "fanworkTitle", "focalLength", "height", "id", "imageUrl", "iso", "latitude", "location", "locationName", "longitude", "metadata", "originalName", "shutterSpeed", "thumbnailUrl", "title", "width" FROM "File";
DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE TABLE "new_SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Liora Gallery',
    "description" TEXT NOT NULL DEFAULT 'A minimal gallery for photography and illustrations.',
    "iconUrl" TEXT NOT NULL DEFAULT '/favicon.ico',
    "socialGithub" TEXT NOT NULL DEFAULT '',
    "socialTwitter" TEXT NOT NULL DEFAULT '',
    "socialInstagram" TEXT NOT NULL DEFAULT '',
    "socialWeibo" TEXT NOT NULL DEFAULT '',
    "socialYoutube" TEXT NOT NULL DEFAULT '',
    "socialBilibili" TEXT NOT NULL DEFAULT '',
    "socialTiktok" TEXT NOT NULL DEFAULT '',
    "socialLinkedin" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SiteSetting" ("description", "iconUrl", "id", "name", "socialGithub", "socialInstagram", "socialTwitter", "socialWeibo", "updatedAt") SELECT "description", "iconUrl", "id", "name", "socialGithub", "socialInstagram", "socialTwitter", "socialWeibo", "updatedAt" FROM "SiteSetting";
DROP TABLE "SiteSetting";
ALTER TABLE "new_SiteSetting" RENAME TO "SiteSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
