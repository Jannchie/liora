import type { H3Event } from 'h3'
import { createError } from 'h3'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { useRuntimeConfig } from '#imports'

export interface GenreClassificationResult {
  primary: string
  secondary: string[]
  confidence: number | null
  reason: string
  model: string
  updatedAt: Date
}

const MODEL_NAME = 'gpt-5.1-nano'
const promptPath = join(process.cwd(), 'prompts', 'PhotographyGenreClassification.md')

let cachedPrompt: string | null = null

async function loadPrompt(): Promise<string> {
  if (cachedPrompt) {
    return cachedPrompt
  }
  cachedPrompt = await readFile(promptPath, 'utf8')
  return cachedPrompt
}

function resolveApiKey(event: H3Event): string {
  const runtimeConfig = useRuntimeConfig(event) as { ai?: { openaiApiKey?: string } }
  const apiKey = runtimeConfig.ai?.openaiApiKey?.toString().trim() ?? ''
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OpenAI API key is not configured.' })
  }
  return apiKey
}

function parseClassification(raw: string): GenreClassificationResult | null {
  try {
    const parsed = JSON.parse(raw) as {
      primary_category?: unknown
      secondary_categories?: unknown
      confidence?: unknown
      reason?: unknown
    }
    const primary = typeof parsed.primary_category === 'string' ? parsed.primary_category.trim() : ''
    const secondary = Array.isArray(parsed.secondary_categories)
      ? parsed.secondary_categories
          .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(entry => entry.length > 0)
      : []
    const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : ''
    if (!primary && secondary.length === 0 && confidence === null && !reason) {
      return null
    }
    return {
      primary,
      secondary,
      confidence,
      reason,
      model: MODEL_NAME,
      updatedAt: new Date(),
    }
  }
  catch {
    return null
  }
}

export async function classifyPhotoGenre(event: H3Event, imageUrl: string): Promise<GenreClassificationResult | null> {
  if (!imageUrl.trim()) {
    return null
  }
  const prompt = await loadPrompt()
  const apiKey = resolveApiKey(event)
  const client = createOpenAI({ apiKey })
  const result = await generateText({
    model: client(MODEL_NAME),
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Classify this photo and return JSON only.' },
          { type: 'image', image: { url: imageUrl } },
        ],
      },
    ],
  })
  return parseClassification(result.text)
}
