type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private isDevelopment = import.meta.env.DEV

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(prefix, message, contextStr)
        }
        break
      case 'info':
        console.info(prefix, message, contextStr)
        break
      case 'warn':
        console.warn(prefix, message, contextStr)
        break
      case 'error':
        console.error(prefix, message, contextStr)
        break
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context)
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.logs]
    return this.logs.filter(log => log.level === level)
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs(): string {
    return this.logs
      .map(log => {
        const contextStr = log.context ? ` ${JSON.stringify(log.context)}` : ''
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${contextStr}`
      })
      .join('\n')
  }
}

export const logger = new Logger()
