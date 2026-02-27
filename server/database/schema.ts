import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const files = sqliteTable('File', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull().default(''),
  description: text('description').notNull().default(''),
  imageUrl: text('imageUrl').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  originalName: text('originalName').notNull().default(''),
  fanworkTitle: text('fanworkTitle').notNull().default(''),
  characterList: text('characterList').notNull().default(''),
  location: text('location').notNull().default(''),
  locationName: text('locationName').notNull().default(''),
  latitude: real('latitude'),
  longitude: real('longitude'),
  cameraModel: text('cameraModel').notNull().default(''),
  aperture: text('aperture').notNull().default(''),
  focalLength: text('focalLength').notNull().default(''),
  iso: text('iso').notNull().default(''),
  shutterSpeed: text('shutterSpeed').notNull().default(''),
  captureTime: text('captureTime').notNull().default(''),
  metadata: text('metadata').notNull().default('{}'),
  genre: text('genre').notNull().default(''),
  createdAt: text('createdAt', { mode: 'text' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const series = sqliteTable('Series', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  coverFileId: integer('coverFileId').references(() => files.id, { onDelete: 'set null' }),
  createdAt: text('createdAt', { mode: 'text' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt', { mode: 'text' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const seriesFiles = sqliteTable('SeriesFile', {
  seriesId: integer('seriesId')
    .notNull()
    .references(() => series.id, { onDelete: 'cascade' }),
  fileId: integer('fileId')
    .notNull()
    .references(() => files.id, { onDelete: 'cascade' }),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: text('createdAt', { mode: 'text' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  pk: primaryKey({ columns: [table.seriesId, table.fileId] }),
  seriesSortIdx: index('SeriesFile_series_sort_idx').on(table.seriesId, table.sortOrder),
  fileIdx: index('SeriesFile_file_idx').on(table.fileId),
}))

export const siteSettings = sqliteTable('SiteSetting', {
  id: integer('id').primaryKey().notNull().default(1),
  name: text('name').notNull().default('Liora Gallery'),
  description: text('description').notNull().default('A minimal gallery for photography and illustrations.'),
  iconUrl: text('iconUrl').notNull().default('/favicon.ico'),
  socialHomepage: text('socialHomepage').notNull().default(''),
  socialGithub: text('socialGithub').notNull().default(''),
  socialTwitter: text('socialTwitter').notNull().default(''),
  socialInstagram: text('socialInstagram').notNull().default(''),
  socialWeibo: text('socialWeibo').notNull().default(''),
  socialYoutube: text('socialYoutube').notNull().default(''),
  socialBilibili: text('socialBilibili').notNull().default(''),
  socialTiktok: text('socialTiktok').notNull().default(''),
  socialLinkedin: text('socialLinkedin').notNull().default(''),
  infoPlacement: text('infoPlacement').notNull().default('header'),
  customCss: text('customCss').notNull().default(''),
  updatedAt: text('updatedAt', { mode: 'text' }).notNull().default(sql`CURRENT_TIMESTAMP`),
})

export type FileRow = typeof files.$inferSelect
export type NewFileRow = typeof files.$inferInsert
export type SeriesRow = typeof series.$inferSelect
export type NewSeriesRow = typeof series.$inferInsert
export type SeriesFileRow = typeof seriesFiles.$inferSelect
export type NewSeriesFileRow = typeof seriesFiles.$inferInsert

export type SiteSettingRow = typeof siteSettings.$inferSelect
export type NewSiteSettingRow = typeof siteSettings.$inferInsert
