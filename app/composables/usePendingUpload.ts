import { shallowRef } from 'vue'

/*
 * Files dropped anywhere in the app while signed in as admin, waiting for
 * the upload page to take them. Module-level on purpose: `File` objects
 * can't go through `useState` (it serialises for SSR), and drops only ever
 * happen on the client.
 */
const pendingFiles = shallowRef<File[]>([])

export function usePendingUpload() {
  function stage(files: File[]): void {
    pendingFiles.value = files
  }

  /** Hands the staged files to the caller once and clears the slot. */
  function take(): File[] {
    const files = pendingFiles.value
    pendingFiles.value = []
    return files
  }

  return { pendingFiles, stage, take }
}
