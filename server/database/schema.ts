import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export type SiteSettingRow = typeof siteSettings.$inferSelect
export type NewSiteSettingRow = typeof siteSettings.$inferInsert
