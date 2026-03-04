function normalizeEnumToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/,+/g, ' ')
    .replaceAll(/\s+/g, ' ')
}

function toFiniteNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null) {
    return null
  }
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

function resolveMappedText(
  value: number | string | undefined,
  options: {
    codeMap: Record<number, string>
    textMap: Record<string, string>
    fallbackPrefix: string
  },
): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  const numeric = toFiniteNumber(value)
  if (numeric !== null) {
    return options.codeMap[numeric] ?? `${options.fallbackPrefix} ${numeric}`
  }
  const raw = String(value).trim()
  if (raw.length === 0) {
    return undefined
  }
  const normalized = normalizeEnumToken(raw)
  return options.textMap[normalized] ?? raw
}

export function normalizeExposureProgramValue(value: number | string | undefined): string | undefined {
  return resolveMappedText(value, {
    codeMap: {
      0: 'Not defined',
      1: 'Manual',
      2: 'Program',
      3: 'Aperture priority',
      4: 'Shutter priority',
      5: 'Creative',
      6: 'Action',
      7: 'Portrait',
      8: 'Landscape',
    },
    textMap: {
      'not defined': 'Not defined',
      'manual': 'Manual',
      'program': 'Program',
      'normal program': 'Program',
      'program normal': 'Program',
      'aperture priority': 'Aperture priority',
      'shutter priority': 'Shutter priority',
      'creative': 'Creative',
      'action': 'Action',
      'portrait': 'Portrait',
      'landscape': 'Landscape',
    },
    fallbackPrefix: 'Program',
  })
}

export function normalizeExposureModeValue(value: number | string | undefined): string | undefined {
  return resolveMappedText(value, {
    codeMap: {
      0: 'Auto',
      1: 'Manual',
      2: 'Auto bracket',
    },
    textMap: {
      'auto': 'Auto',
      'manual': 'Manual',
      'auto bracket': 'Auto bracket',
      'bracket': 'Auto bracket',
    },
    fallbackPrefix: 'Mode',
  })
}

export function normalizeMeteringModeValue(value: number | string | undefined): string | undefined {
  return resolveMappedText(value, {
    codeMap: {
      0: 'Unknown',
      1: 'Average',
      2: 'Center-weighted',
      3: 'Spot',
      4: 'Multi-spot',
      5: 'Pattern',
      6: 'Partial',
      255: 'Other',
    },
    textMap: {
      'unknown': 'Unknown',
      'average': 'Average',
      'center weighted': 'Center-weighted',
      'center weighted average': 'Center-weighted',
      'center-weighted': 'Center-weighted',
      'spot': 'Spot',
      'multi spot': 'Multi-spot',
      'multispot': 'Multi-spot',
      'multi-spot': 'Multi-spot',
      'pattern': 'Pattern',
      'matrix': 'Pattern',
      'partial': 'Partial',
      'other': 'Other',
    },
    fallbackPrefix: 'Mode',
  })
}

export function normalizeWhiteBalanceValue(value: number | string | undefined): string | undefined {
  return resolveMappedText(value, {
    codeMap: {
      0: 'Auto',
      1: 'Manual',
    },
    textMap: {
      auto: 'Auto',
      manual: 'Manual',
    },
    fallbackPrefix: 'WB',
  })
}

export function normalizeFlashValue(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  const numeric = toFiniteNumber(value)
  if (numeric !== null) {
    const fired = (numeric & 1) === 1
    const auto = (numeric & 24) === 24
    if (fired) {
      return auto ? 'Auto (fired)' : 'Fired'
    }
    return auto ? 'Auto (did not fire)' : 'Did not fire'
  }
  const raw = String(value).trim()
  if (raw.length === 0) {
    return undefined
  }
  const normalized = normalizeEnumToken(raw)
  const mapping: Record<string, string> = {
    'did not fire': 'Did not fire',
    'fired': 'Fired',
    'auto did not fire': 'Auto (did not fire)',
    'auto (did not fire)': 'Auto (did not fire)',
    'auto fired': 'Auto (fired)',
    'auto (fired)': 'Auto (fired)',
  }
  return mapping[normalized] ?? raw
}
