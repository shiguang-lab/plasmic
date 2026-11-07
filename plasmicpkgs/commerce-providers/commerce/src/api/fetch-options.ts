import type { Agent } from 'http'
import type { Options } from 'async-retry'
import type { RequestInit } from 'node-fetch'

// Request options accepted by Commerce's GraphQL fetch contract.
// Keep retry scheduling and Retry-After limits alongside node-fetch options.
export type FetchOptions = RequestInit & {
  agent?: Agent
  retry?: Options & { maxRetryAfter?: number }
}
