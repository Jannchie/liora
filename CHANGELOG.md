## v0.3.0

[v0.2.0...v0.3.0](https://github.com/Jannchie/liora/compare/v0.2.0...v0.3.0)

### :sparkles: Features

- **image**: support runtime image domains && add runtime-image plugin - By [Jannchie](mailto:jannchie@gmail.com) in [74df406](https://github.com/Jannchie/liora/commit/74df406)

### :art: Refactors

- **gallery**: remove ipx domain resolution and syncing - By [Jannchie](mailto:jannchie@gmail.com) in [35eadb0](https://github.com/Jannchie/liora/commit/35eadb0)

### :wrench: Chores

- ignore docker-compose.dev.yml - By [Jannchie](mailto:jannchie@gmail.com) in [43c4682](https://github.com/Jannchie/liora/commit/43c4682)

## v0.2.0

[v0.1.5...v0.2.0](https://github.com/Jannchie/liora/compare/v0.1.5...v0.2.0)

### :sparkles: Features

- **images**: auto-resolve and sync image domains - By [Jannchie](mailto:jannchie@gmail.com) in [33e96d0](https://github.com/Jannchie/liora/commit/33e96d0)

### :wrench: Chores

- **docker**: move data dir and database env setup to runtime stage - By [Jannchie](mailto:jannchie@gmail.com) in [e32da29](https://github.com/Jannchie/liora/commit/e32da29)

## v0.1.5

[v0.1.4...v0.1.5](https://github.com/Jannchie/liora/compare/v0.1.4...v0.1.5)

### :wrench: Chores

- **docker**: bake default sqlite database mount into image - By [Jannchie](mailto:jannchie@gmail.com) in [78258e2](https://github.com/Jannchie/liora/commit/78258e2)

## v0.1.4

[v0.1.3...v0.1.4](https://github.com/Jannchie/liora/compare/v0.1.3...v0.1.4)

### :adhesive_bandage: Fixes

- **overlay**: handle cors-safe image loading && fix pointer handling and UI colors - By [Jannchie](mailto:jannchie@gmail.com) in [5b2931d](https://github.com/Jannchie/liora/commit/5b2931d)

### :wrench: Chores

- **docker**: add entrypoint script and env mapping - By [Jannchie](mailto:jannchie@gmail.com) in [731e652](https://github.com/Jannchie/liora/commit/731e652)

## v0.1.3

[v0.1.2...v0.1.3](https://github.com/Jannchie/liora/compare/v0.1.2...v0.1.3)

### :art: Refactors

- **gallery**: use Math.max for pinch distance clamping - By [Jannchie](mailto:jannchie@gmail.com) in [1e323b7](https://github.com/Jannchie/liora/commit/1e323b7)

## v0.1.2

[v0.1.1...v0.1.2](https://github.com/Jannchie/liora/compare/v0.1.1...v0.1.2)

### :adhesive_bandage: Fixes

- **build**: alias @vueuse/core to local shim for compatibility - By [Jannchie](mailto:jannchie@gmail.com) in [d2f55d3](https://github.com/Jannchie/liora/commit/d2f55d3)

### :art: Refactors

- **admin**: use computed models for forms && add iconify mdi dependency - By [Jannchie](mailto:jannchie@gmail.com) in [6eb672b](https://github.com/Jannchie/liora/commit/6eb672b)

### :lipstick: Styles

- **admin-login**: improve admin login layout and accessibility - By [Jannchie](mailto:jannchie@gmail.com) in [43ed48b](https://github.com/Jannchie/liora/commit/43ed48b)

## v0.1.1

[v0.1.0...v0.1.1](https://github.com/Jannchie/liora/compare/v0.1.0...v0.1.1)

### :wrench: Chores

- switch default sqlite file to prisma/data.db && add docker build/publish helpers - By [Jannchie](mailto:jannchie@gmail.com) in [94f8f84](https://github.com/Jannchie/liora/commit/94f8f84)

## v0.1.0

[d2e37177b150b0ea4e030e6f0ef0955bae07d330...v0.1.0](https://github.com/Jannchie/liora/compare/d2e37177b150b0ea4e030e6f0ef0955bae07d330...v0.1.0)

### :rocket: Breaking Changes

- **files-gallery**: add extensive exif metadata support and ui refinements - By [Jannchie](mailto:jannchie@gmail.com) in [bb37049](https://github.com/Jannchie/liora/commit/bb37049)

### :sparkles: Features

- **admin**: add image replace & edit API for files - By [Jannchie](mailto:jannchie@gmail.com) in [bfe5c6c](https://github.com/Jannchie/liora/commit/bfe5c6c)
- **admin**: add admin edit modal, inline editing, auto-classify && geocode reverse endpoints - By [Jannchie](mailto:jannchie@gmail.com) in [d1764e0](https://github.com/Jannchie/liora/commit/d1764e0)
- **admin**: add metadata form, location search, exposure options and datetime utils - By [Jannchie](mailto:jannchie@gmail.com) in [8abd6d7](https://github.com/Jannchie/liora/commit/8abd6d7)
- **admin**: add site icon upload and UI - By [Jannchie](mailto:jannchie@gmail.com) in [356ce5b](https://github.com/Jannchie/liora/commit/356ce5b)
- **admin**: add admin files page && refactor gallery and nav - By [Jannchie](mailto:jannchie@gmail.com) in [0e7efb2](https://github.com/Jannchie/liora/commit/0e7efb2)
- **admin-auth**: add admin auth, session api, and gallery overlay - By [Jannchie](mailto:jannchie@gmail.com) in [194239f](https://github.com/Jannchie/liora/commit/194239f)
- **admin-files**: improve admin file UI, upload & sorting - By [Jannchie](mailto:jannchie@gmail.com) in [dbd1216](https://github.com/Jannchie/liora/commit/dbd1216)
- **files**: add genre classification, fileSize and reclassify endpoint - By [Jannchie](mailto:jannchie@gmail.com) in [7c33b3e](https://github.com/Jannchie/liora/commit/7c33b3e)
- **files**: add perceptual and sha256 hashing && detect similar uploads - By [Jannchie](mailto:jannchie@gmail.com) in [1c2323a](https://github.com/Jannchie/liora/commit/1c2323a)
- **gallery**: add location search and map preview - By [Jannchie](mailto:jannchie@gmail.com) in [42db43c](https://github.com/Jannchie/liora/commit/42db43c)
- **gallery**: add typography, histogram summary, and improved overlay zoom/ui - By [Jannchie](mailto:jannchie@gmail.com) in [23ae187](https://github.com/Jannchie/liora/commit/23ae187)
- **gallery**: add overlay image download with progress and ui enhancements - By [Jannchie](mailto:jannchie@gmail.com) in [61de795](https://github.com/Jannchie/liora/commit/61de795)
- **gallery**: sync overlay with route && add overlay navigation - By [Jannchie](mailto:jannchie@gmail.com) in [646f88b](https://github.com/Jannchie/liora/commit/646f88b)
- **gallery**: add overlay placeholder handling and progressive image loading - By [Jannchie](mailto:jannchie@gmail.com) in [833066c](https://github.com/Jannchie/liora/commit/833066c)
- **gallery**: add histogram support and info card with social links - By [Jannchie](mailto:jannchie@gmail.com) in [0c33fc7](https://github.com/Jannchie/liora/commit/0c33fc7)
- **gallery**: use thumbhash aspect ratio for placeholders && sort files by capture time - By [Jannchie](mailto:jannchie@gmail.com) in [b0d3b1d](https://github.com/Jannchie/liora/commit/b0d3b1d)
- **i18n**: add japanese (ja) locale - By [Jannchie](mailto:jannchie@gmail.com) in [475ce1f](https://github.com/Jannchie/liora/commit/475ce1f)
- **i18n**: improve language switching and image preview handling - By [Jannchie](mailto:jannchie@gmail.com) in [38e2665](https://github.com/Jannchie/liora/commit/38e2665)
- **i18n**: add internationalization (i18n) support - By [Jannchie](mailto:jannchie@gmail.com) in [a7ba0ac](https://github.com/Jannchie/liora/commit/a7ba0ac)
- **metadata-form**: add reverse geocode button to fill location - By [Jannchie](mailto:jannchie@gmail.com) in [80563f7](https://github.com/Jannchie/liora/commit/80563f7)
- **seo**: add seo support && thumbhash placeholders - By [Jannchie](mailto:jannchie@gmail.com) in [911009a](https://github.com/Jannchie/liora/commit/911009a)
- **site**: add site settings management and ui - By [Jannchie](mailto:jannchie@gmail.com) in [267b60f](https://github.com/Jannchie/liora/commit/267b60f)
- **site-settings**: add site icon support and og image component && improve gallery hydration and download handling - By [Jannchie](mailto:jannchie@gmail.com) in [1a4d18d](https://github.com/Jannchie/liora/commit/1a4d18d)
- **social**: add youtube/bilibili/tiktok/linkedin support - By [Jannchie](mailto:jannchie@gmail.com) in [a640bf5](https://github.com/Jannchie/liora/commit/a640bf5)
- **ui**: add icons, loading states and image histogram - By [Jannchie](mailto:jannchie@gmail.com) in [29f5188](https://github.com/Jannchie/liora/commit/29f5188)
- **upload**: add automatic photo genre classification - By [Jannchie](mailto:jannchie@gmail.com) in [87391da](https://github.com/Jannchie/liora/commit/87391da)
- **viewer**: add touch pinch-zoom and viewport lock - By [Jannchie](mailto:jannchie@gmail.com) in [a1634c6](https://github.com/Jannchie/liora/commit/a1634c6)
- **waterfall-gallery**: add overlay zoom, pan, and indicators - By [Jannchie](mailto:jannchie@gmail.com) in [3fd7143](https://github.com/Jannchie/liora/commit/3fd7143)

### :adhesive_bandage: Fixes

- **gallery**: improve image sizing and rendering behavior - By [Jannchie](mailto:jannchie@gmail.com) in [613f765](https://github.com/Jannchie/liora/commit/613f765)
- **i18n**: rename wildlife to animal && fix metadata merge order - By [Jannchie](mailto:jannchie@gmail.com) in [82b6e4c](https://github.com/Jannchie/liora/commit/82b6e4c)
- **waterfall-overlay**: improve overlay layout and scrolling behavior - By [Jannchie](mailto:jannchie@gmail.com) in [8fc8bc4](https://github.com/Jannchie/liora/commit/8fc8bc4)

### :art: Refactors

- **admin-files**: use i18n for metadata section labels && remove characters free-text handling - By [Jannchie](mailto:jannchie@gmail.com) in [67dd6db](https://github.com/Jannchie/liora/commit/67dd6db)
- **docker**: refactor docker runner image and startup - By [Jannchie](mailto:jannchie@gmail.com) in [0c71644](https://github.com/Jannchie/liora/commit/0c71644)
- **gallery**: extract overlay, histogram and metadata panels into components && move gallery types to types/gallery.ts && make upload preview keyboard accessible - By [Jannchie](mailto:jannchie@gmail.com) in [e4f0b59](https://github.com/Jannchie/liora/commit/e4f0b59)
- **gallery**: refactor waterfall entries to include info card && simplify admin nav props - By [Jannchie](mailto:jannchie@gmail.com) in [a702d3c](https://github.com/Jannchie/liora/commit/a702d3c)
- **ogimage**: simplify liora card styles and add fonts - By [Jannchie](mailto:jannchie@gmail.com) in [79f9693](https://github.com/Jannchie/liora/commit/79f9693)
- **ui**: refactor sorting, uploads, and auth checks - By [Jannchie](mailto:jannchie@gmail.com) in [2763164](https://github.com/Jannchie/liora/commit/2763164)

### :zap: Performance Improvements

- **images**: prioritize first image && improve perceptual-hash speed - By [Jannchie](mailto:jannchie@gmail.com) in [f2e5b08](https://github.com/Jannchie/liora/commit/f2e5b08)

### :lipstick: Styles

- **ui**: tweak histogram smoothing && adjust modal ui classes - By [Jannchie](mailto:jannchie@gmail.com) in [51585d8](https://github.com/Jannchie/liora/commit/51585d8)
- apply code style and modernization - By [Jannchie](mailto:jannchie@gmail.com) in [c99dadf](https://github.com/Jannchie/liora/commit/c99dadf)

### :wrench: Chores

- **i18n**: move locales directory references - By [Jannchie](mailto:jannchie@gmail.com) in [a0082c8](https://github.com/Jannchie/liora/commit/a0082c8)
- add dockerfile, dockerignore, and update README for production - By [Jannchie](mailto:jannchie@gmail.com) in [421f0d4](https://github.com/Jannchie/liora/commit/421f0d4)
