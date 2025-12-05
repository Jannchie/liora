export const brandIconKeys = [
  // Cameras
  'nikon',
  'sony',
  'fujifilm',
  'panasonic',
  'leica',
  'dji',
  // Phones
  'apple',
  'samsung',
  'huawei',
  'xiaomi',
  'oppo',
  'vivo',
  'oneplus',
  'google',
  'motorola',
  'nokia',
  'honor',
  'meizu',
  'lenovo',
  'asus',
  'sharp',
  'lg',
] as const

export type BrandIconKey = typeof brandIconKeys[number]

export const brandIconSet = new Set<string>(brandIconKeys)
