-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Liora Gallery',
    "description" TEXT NOT NULL DEFAULT 'A minimal gallery for photography and illustrations.',
    "iconUrl" TEXT NOT NULL DEFAULT '/favicon.ico',
    "socialHomepage" TEXT NOT NULL DEFAULT '',
    "socialGithub" TEXT NOT NULL DEFAULT '',
    "socialTwitter" TEXT NOT NULL DEFAULT '',
    "socialInstagram" TEXT NOT NULL DEFAULT '',
    "socialWeibo" TEXT NOT NULL DEFAULT '',
    "socialYoutube" TEXT NOT NULL DEFAULT '',
    "socialBilibili" TEXT NOT NULL DEFAULT '',
    "socialTiktok" TEXT NOT NULL DEFAULT '',
    "socialLinkedin" TEXT NOT NULL DEFAULT '',
    "infoPlacement" TEXT NOT NULL DEFAULT 'header',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SiteSetting" ("description", "iconUrl", "id", "name", "socialBilibili", "socialGithub", "socialHomepage", "socialInstagram", "socialLinkedin", "socialTiktok", "socialTwitter", "socialWeibo", "socialYoutube", "updatedAt") SELECT "description", "iconUrl", "id", "name", "socialBilibili", "socialGithub", "socialHomepage", "socialInstagram", "socialLinkedin", "socialTiktok", "socialTwitter", "socialWeibo", "socialYoutube", "updatedAt" FROM "SiteSetting";
DROP TABLE "SiteSetting";
ALTER TABLE "new_SiteSetting" RENAME TO "SiteSetting";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
