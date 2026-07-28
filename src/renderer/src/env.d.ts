/// <reference types="vite/client" />

import type { AsleRecApi, AsleRecInternalApi } from '@shared/types'

declare global {
  interface Window {
    aslerec: AsleRecApi
    aslerecInternal: AsleRecInternalApi
  }
}

export {}
