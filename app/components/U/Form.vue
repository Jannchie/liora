<script setup lang="ts" generic="T extends object">
import { provide, ref } from 'vue'

type ValidationResult = string | true | undefined | null
type Validator<S> = (state: S) => Record<string, ValidationResult> | Promise<Record<string, ValidationResult>>

interface FormProps<S> {
  state?: S
  schema?: { parse?: (input: unknown) => unknown, safeParse?: (input: unknown) => { success: boolean, error?: { issues: Array<{ path: (string | number)[], message: string }> } } }
  validate?: Validator<S>
}

const props = defineProps<FormProps<T>>()

const emit = defineEmits<{
  submit: [event: Event]
  error: [errors: Record<string, string>]
}>()

const errors = ref<Record<string, string>>({})

provide('u-form-errors', errors)

async function runValidation(): Promise<Record<string, string>> {
  const collected: Record<string, string> = {}

  if (props.schema?.safeParse && props.state) {
    const result = props.schema.safeParse(props.state)
    if (!result.success && result.error) {
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (key && !collected[key]) {
          collected[key] = issue.message
        }
      }
    }
  }

  if (props.validate && props.state) {
    const customResult = await props.validate(props.state)
    for (const [key, value] of Object.entries(customResult)) {
      if (typeof value === 'string' && value.length > 0) {
        collected[key] = value
      }
    }
  }

  return collected
}

async function handleSubmit(event: Event): Promise<void> {
  event.preventDefault()
  const validationErrors = await runValidation()
  errors.value = validationErrors
  if (Object.keys(validationErrors).length > 0) {
    emit('error', validationErrors)
    return
  }
  emit('submit', event)
}

function clear(): void {
  errors.value = {}
}

defineExpose({ clear, validate: runValidation })
</script>

<template>
  <form novalidate @submit="handleSubmit">
    <slot :errors="errors" />
  </form>
</template>
