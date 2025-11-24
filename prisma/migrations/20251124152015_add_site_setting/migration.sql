-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Liora Gallery',
    "description" TEXT NOT NULL DEFAULT 'A minimal gallery for photography and illustrations.',
    "socialGithub" TEXT NOT NULL DEFAULT '',
    "socialTwitter" TEXT NOT NULL DEFAULT '',
    "socialInstagram" TEXT NOT NULL DEFAULT '',
    "socialWeibo" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
