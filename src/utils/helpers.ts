export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function (this: any, ...args: Parameters<T>) {
    const context = this

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func.apply(context, args)
      timeout = null
    }, wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (this: any, ...args: Parameters<T>) {
    const context = this

    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 10000)
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 255)
}

export function isValidApiKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  const trimmed = key.trim()
  return trimmed.length >= 20 && trimmed.length <= 500
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '***'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private ttl: number

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttl = ttlMs
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempt = 0

    const execute = async () => {
      try {
        const result = await fn()
        resolve(result)
      } catch (error) {
        attempt++
        if (attempt >= maxRetries) {
          reject(error)
          return
        }

        const delay = baseDelay * Math.pow(2, attempt - 1)
        setTimeout(execute, delay)
      }
    }

    execute()
  })
}
