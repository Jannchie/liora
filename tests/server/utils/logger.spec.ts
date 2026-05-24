import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../../server/utils/logger'

interface Captured {
  level: 'log' | 'warn' | 'error'
  args: unknown[]
}

function capture(fn: () => void): Captured[] {
  const calls: Captured[] = []
  const log = vi.spyOn(console, 'log').mockImplementation((...args) => void calls.push({ level: 'log', args }))
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => void calls.push({ level: 'warn', args }))
  const error = vi.spyOn(console, 'error').mockImplementation((...args) => void calls.push({ level: 'error', args }))
  try {
    fn()
  }
  finally {
    log.mockRestore()
    warn.mockRestore()
    error.mockRestore()
  }
  return calls
}

describe('server/utils/logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes error/warn/info to the matching console sink', () => {
    const calls = capture(() => {
      logger.error('boom')
      logger.warn('careful')
      logger.info('fyi')
    })
    expect(calls.map(c => c.level)).toEqual(['error', 'warn', 'log'])
  })

  it('includes the message and context in the output', () => {
    const calls = capture(() => logger.error('upload failed', { uploadId: 'abc', count: 3 }))
    const line = String(calls[0]?.args[0])
    expect(line).toContain('upload failed')
    expect(line).toContain('abc')
    expect(line).toContain('3')
  })

  it('serializes error values in context without throwing', () => {
    const calls = capture(() => logger.error('failed', { error: new Error('nope') }))
    const line = String(calls[0]?.args[0])
    expect(line).toContain('nope')
  })

  it('merges child bindings into every entry', () => {
    const child = logger.child({ requestId: 'req-1' })
    const calls = capture(() => child.info('handled'))
    expect(String(calls[0]?.args[0])).toContain('req-1')
  })
})
