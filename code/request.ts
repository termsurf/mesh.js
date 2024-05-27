import * as retry from '@zkochan/retry'

export type FetchWithTimeoutInput = RequestInit & {
  timeout?: number
}

export async function fetchWithTimeout(
  resource: string,
  options: FetchWithTimeoutInput = {},
) {
  const { timeout = 20000 } = options

  const response = await fetch(resource, {
    ...options,
    signal: (AbortSignal as any).any(
      [options.signal, AbortSignal.timeout(timeout)].filter(x => x),
    ),
  })

  return response
}
