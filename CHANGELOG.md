## v0.6.2

[v0.6.1...v0.6.2](https://github.com/Jannchie/liora/compare/v0.6.1...v0.6.2)

### :adhesive_bandage: Fixes

- **ui**: fix template indentation and tag nesting - By [Jannchie](mailto:jannchie@gmail.com) in [97484bc](https://github.com/Jannchie/liora/commit/97484bc)

### :art: Refactors

- **config**: standardize env var names and parsing - By [Jannchie](mailto:jannchie@gmail.com) in [f7f7e4d](https://github.com/Jannchie/liora/commit/f7f7e4d)
- **ui-buttons**: standardize ubutton icon prop and simplify slots - By [Jannchie](mailto:jannchie@gmail.com) in [5e95ba4](https://github.com/Jannchie/liora/commit/5e95ba4)

### :wrench: Chores

- **.github-workflows**: add docker release workflow - By [Jannchie](mailto:jannchie@gmail.com) in [5657bf4](https://github.com/Jannchie/liora/commit/5657bf4)
- **ci**: remove pnpm version pin from ci workflow - By [Jannchie](mailto:jannchie@gmail.com) in [79a4f8c](https://github.com/Jannchie/liora/commit/79a4f8c)

## v0.6.1

[v0.6.0...v0.6.1](https://github.com/Jannchie/liora/compare/v0.6.0...v0.6.1)

### :art: Refactors

- **routing**: replace named overlay route with path-based routing - By [Jannchie](mailto:jannchie@gmail.com) in [d2357de](https://github.com/Jannchie/liora/commit/d2357de)

## v0.6.0

[v0.5.1...v0.6.0](https://github.com/Jannchie/liora/compare/v0.5.1...v0.6.0)

### :sparkles: Features

- **config**: add icon cssLayer configuration - By [Jannchie](mailto:jannchie@gmail.com) in [cec1df9](https://github.com/Jannchie/liora/commit/cec1df9)

### :adhesive_bandage: Fixes

- **ai-classifier**: add robust image fetch with timeout and validation - By [Jannchie](mailto:jannchie@gmail.com) in [7243368](https://github.com/Jannchie/liora/commit/7243368)
- **files**: validate image metadata and preserve content-type - By [Jannchie](mailto:jannchie@gmail.com) in [1e9f5ce](https://github.com/Jannchie/liora/commit/1e9f5ce)
- **ui**: fix types and button props in waterfall components - By [Jannchie](mailto:jannchie@gmail.com) in [4a8fc28](https://github.com/Jannchie/liora/commit/4a8fc28)

### :art: Refactors

- **files-api**: remove image similarity detection logic - By [Jannchie](mailto:jannchie@gmail.com) in [6336520](https://github.com/Jannchie/liora/commit/6336520)
- **routing**: migrate gallery overlay routing to route params - By [Jannchie](mailto:jannchie@gmail.com) in [967454d](https://github.com/Jannchie/liora/commit/967454d)
- clean up type hints and null checks && format templates - By [Jannchie](mailto:jannchie@gmail.com) in [4d51fbb](https://github.com/Jannchie/liora/commit/4d51fbb)

### :zap: Performance Improvements

- **gallery**: simplify preview size calculation - By [Jannchie](mailto:jannchie@gmail.com) in [c3e8a27](https://github.com/Jannchie/liora/commit/c3e8a27)

### :lipstick: Styles

- **admin-site**: update layout and form field arrangement - By [Jannchie](mailto:jannchie@gmail.com) in [5d03be0](https://github.com/Jannchie/liora/commit/5d03be0)
- **ui**: standardize text sizing to text-xs across components - By [Jannchie](mailto:jannchie@gmail.com) in [2866713](https://github.com/Jannchie/liora/commit/2866713)
- **ui-theme**: set soft default variants for form controls - By [Jannchie](mailto:jannchie@gmail.com) in [2612742](https://github.com/Jannchie/liora/commit/2612742)

### :wrench: Chores

- **ci**: add github actions workflow for lint and typecheck - By [Jannchie](mailto:jannchie@gmail.com) in [3f6d1e8](https://github.com/Jannchie/liora/commit/3f6d1e8)
- **config**: simplify site indexable config - By [Jannchie](mailto:jannchie@gmail.com) in [ee49115](https://github.com/Jannchie/liora/commit/ee49115)

## v0.5.1

[v0.5.0...v0.5.1](https://github.com/Jannchie/liora/compare/v0.5.0...v0.5.1)

### :lipstick: Styles

- **ui**: adjust header styling and language switcher visibility - By [Jannchie](mailto:jannchie@gmail.com) in [92593f6](https://github.com/Jannchie/liora/commit/92593f6)
- **waterfall-metadata**: adjust layout and typography for exposure entries - By [Jannchie](mailto:jannchie@gmail.com) in [516d242](https://github.com/Jannchie/liora/commit/516d242)
- **waterfall-overlay**: simplify close button styling - By [Jannchie](mailto:jannchie@gmail.com) in [5db8cad](https://github.com/Jannchie/liora/commit/5db8cad)

## v0.5.0

[v0.4.0...v0.5.0](https://github.com/Jannchie/liora/compare/v0.4.0...v0.5.0)

### :sparkles: Features

- **gallery**: add responsive min columns and overlay max height - By [Jannchie](mailto:jannchie@gmail.com) in [8f25eea](https://github.com/Jannchie/liora/commit/8f25eea)
- **layout**: add optional header site info and social links - By [Jannchie](mailto:jannchie@gmail.com) in [c7b06da](https://github.com/Jannchie/liora/commit/c7b06da)
- **site**: add site info placement option - By [Jannchie](mailto:jannchie@gmail.com) in [460dc7e](https://github.com/Jannchie/liora/commit/460dc7e)
- **ui**: enhance README visuals && add og card red indicator - By [Jannchie](mailto:jannchie@gmail.com) in [99173ff](https://github.com/Jannchie/liora/commit/99173ff)

### :adhesive_bandage: Fixes

- **gallery**: allow single-column waterfall && fix overlay max-height on mobile viewport units - By [Jannchie](mailto:jannchie@gmail.com) in [1ed0998](https://github.com/Jannchie/liora/commit/1ed0998)
- **home**: use document scrolling element for list scrolling - By [Jannchie](mailto:jannchie@gmail.com) in [e10b07b](https://github.com/Jannchie/liora/commit/e10b07b)

### :art: Refactors

- **ui-buttons**: use leading slot for loading icons in buttons - By [Jannchie](mailto:jannchie@gmail.com) in [9db111c](https://github.com/Jannchie/liora/commit/9db111c)
- **viewer**: replace UModal with custom overlay component - By [Jannchie](mailto:jannchie@gmail.com) in [6255676](https://github.com/Jannchie/liora/commit/6255676)

### :lipstick: Styles

- **components**: reorder imports in WaterfallGallery.vue - By [Jannchie](mailto:jannchie@gmail.com) in [cb7fd94](https://github.com/Jannchie/liora/commit/cb7fd94)
- **ogimage**: tweak liora card colors and frame sizing - By [Jannchie](mailto:jannchie@gmail.com) in [9ac21c8](https://github.com/Jannchie/liora/commit/9ac21c8)

### :memo: Documentation

- **readme**: add comprehensive README and .env.example - By [Jannchie](mailto:jannchie@gmail.com) in [6ec5150](https://github.com/Jannchie/liora/commit/6ec5150)

### :wrench: Chores

- **admin-files**: remove upload button and i18n entries - By [Jannchie](mailto:jannchie@gmail.com) in [8e1324e](https://github.com/Jannchie/liora/commit/8e1324e)

## v0.4.0

[v0.3.0...v0.4.0](https://github.com/Jannchie/liora/compare/v0.3.0...v0.4.0)

### :sparkles: Features

- **pwa**: add pwa support && extract site metadata - By [Jannchie](mailto:jannchie@gmail.com) in [6953790](https://github.com/Jannchie/liora/commit/6953790)
- **site**: add social homepage link - By [Jannchie](mailto:jannchie@gmail.com) in [763d42c](https://github.com/Jannchie/liora/commit/763d42c)
- **ui**: add loading icon component && replace icons with loading-aware variants - By [Jannchie](mailto:jannchie@gmail.com) in [1c23609](https://github.com/Jannchie/liora/commit/1c23609)

### :adhesive_bandage: Fixes

- **files-api**: validate input lengths and file size - By [Jannchie](mailto:jannchie@gmail.com) in [9ebf13f](https://github.com/Jannchie/liora/commit/9ebf13f)

### :lipstick: Styles

- **ogimage**: update liora og image styles and add corner frames - By [Jannchie](mailto:jannchie@gmail.com) in [cd28fad](https://github.com/Jannchie/liora/commit/cd28fad)

### :memo: Documentation

- **readme**: add screenshot to readme - By [Jannchie](mailto:jannchie@gmail.com) in [0d8894b](https://github.com/Jannchie/liora/commit/0d8894b)

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
