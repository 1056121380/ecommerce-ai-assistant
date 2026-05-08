import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  debounce,
  throttle,
  sanitizeInput,
  validateUrl,
  sanitizeFileName,
  isValidApiKey,
  maskApiKey,
  SimpleCache,
  retryWithBackoff
} from './helpers'

describe('Utility Helpers', () => {
  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('delays function execution', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('cancels previous calls', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced()
      debounced()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('limits function execution rate', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled()
      throttled()

      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttled()
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('sanitizeInput', () => {
    it('removes HTML tags', () => {
      expect(sanitizeInput('Hello <script>alert("xss")</script>')).toBe('Hello scriptalert("xss")/script')
    })

    it('trims whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
    })

    it('limits length to 10000 characters', () => {
      const longString = 'a'.repeat(15000)
      expect(sanitizeInput(longString)).toHaveLength(10000)
    })
  })

  describe('validateUrl', () => {
    it('accepts valid HTTP URLs', () => {
      expect(validateUrl('http://example.com')).toBe(true)
      expect(validateUrl('https://example.com')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(validateUrl('not a url')).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
      expect(validateUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('sanitizeFileName', () => {
    it('removes invalid characters', () => {
      expect(sanitizeFileName('file<name>.txt')).toBe('filename.txt')
      expect(sanitizeFileName('path/to/file.txt')).toBe('pathtofile.txt')
    })

    it('removes leading dots', () => {
      expect(sanitizeFileName('...file.txt')).toBe('file.txt')
    })

    it('limits length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt'
      expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(255)
    })
  })

  describe('isValidApiKey', () => {
    it('accepts valid API keys', () => {
      expect(isValidApiKey('sk-1234567890abcdefghij')).toBe(true)
      expect(isValidApiKey('a'.repeat(50))).toBe(true)
    })

    it('rejects invalid API keys', () => {
      expect(isValidApiKey('')).toBe(false)
      expect(isValidApiKey('short')).toBe(false)
      expect(isValidApiKey('a'.repeat(600))).toBe(false)
      expect(isValidApiKey(null as any)).toBe(false)
    })
  })

  describe('maskApiKey', () => {
    it('masks API key showing only first and last 4 characters', () => {
      expect(maskApiKey('sk-1234567890abcdefghij')).toBe('sk-1...ghij')
    })

    it('handles short keys', () => {
      expect(maskApiKey('short')).toBe('***')
      expect(maskApiKey('')).toBe('***')
    })
  })

  describe('SimpleCache', () => {
    it('stores and retrieves data', () => {
      const cache = new SimpleCache<string>(1000)
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('returns null for non-existent keys', () => {
      const cache = new SimpleCache<string>(1000)
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('expires data after TTL', () => {
      vi.useFakeTimers()
      const cache = new SimpleCache<string>(1000)

      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')

      vi.advanceTimersByTime(1001)
      expect(cache.get('key1')).toBeNull()

      vi.restoreAllMocks()
    })

    it('checks if key exists', () => {
      const cache = new SimpleCache<string>(1000)
      cache.set('key1', 'value1')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
    })

    it('clears all data', () => {
      const cache = new SimpleCache<string>(1000)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.clear()
      expect(cache.size()).toBe(0)
    })
  })

  describe('retryWithBackoff', () => {
    it('succeeds on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retryWithBackoff(fn, 3, 100)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    // Note: retryWithBackoff uses real setTimeout, so these tests would be slow
    // In production, consider using a more testable implementation with dependency injection
  })
})
