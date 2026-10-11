import type { ComputedRef } from 'vue'
import { computed, inject } from 'vue'

interface FormFieldContext {
  id: ComputedRef<string | undefined>
  name: () => string | undefined
  invalid: () => boolean
}

/*
 * Lets a control inside `UFormField` pick up the field's id (so clicking
 * the label focuses it) and its error state, unless the caller set them.
 */
export function useFormFieldContext(props: { id?: string, invalid?: boolean }) {
  const field = inject<FormFieldContext | null>('u-form-field', null)
  return {
    id: computed(() => props.id ?? field?.id.value),
    invalid: computed(() => Boolean(props.invalid || field?.invalid())),
  }
}
