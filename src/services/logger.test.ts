import { describe, expect, it } from 'vitest'
import { logger } from './logger'

describe('Logger Service', () => {
  it('logs messages with correct level', () => {
    logger.clearLogs()

    logger.info('Test info message')
    logger.warn('Test warning')
    logger.error('Test error')

    const logs = logger.getLogs()
    expect(logs).toHaveLength(3)
    expect(logs[0].level).toBe('info')
    expect(logs[1].level).toBe('warn')
    expect(logs[2].level).toBe('error')
  })

  it('includes context in log entries', () => {
    logger.clearLogs()

    logger.info('API request', { endpoint: '/api/test', method: 'POST' })

    const logs = logger.getLogs()
    expect(logs[0].context).toEqual({ endpoint: '/api/test', method: 'POST' })
  })

  it('filters logs by level', () => {
    logger.clearLogs()

    logger.info('Info 1')
    logger.error('Error 1')
    logger.info('Info 2')
    logger.error('Error 2')

    const errorLogs = logger.getLogs('error')
    expect(errorLogs).toHaveLength(2)
    expect(errorLogs.every(log => log.level === 'error')).toBe(true)
  })

  it('limits log history to maxLogs', () => {
    logger.clearLogs()

    for (let i = 0; i < 1100; i++) {
      logger.info(`Message ${i}`)
    }

    const logs = logger.getLogs()
    expect(logs.length).toBeLessThanOrEqual(1000)
  })

  it('exports logs as formatted text', () => {
    logger.clearLogs()

    logger.info('Test message', { key: 'value' })
    logger.error('Error message')

    const exported = logger.exportLogs()
    expect(exported).toContain('[INFO]')
    expect(exported).toContain('Test message')
    expect(exported).toContain('[ERROR]')
    expect(exported).toContain('Error message')
  })

  it('clears all logs', () => {
    logger.info('Test')
    logger.clearLogs()

    expect(logger.getLogs()).toHaveLength(0)
  })
})
