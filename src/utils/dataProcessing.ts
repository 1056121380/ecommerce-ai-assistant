export interface DataCleaningResult {
  cleaned: string
  stats: {
    originalRows: number
    cleanedRows: number
    duplicatesRemoved: number
    emptyRowsRemoved: number
    invalidRowsRemoved: number
  }
  warnings: string[]
}

export function cleanCSVData(rawData: string): DataCleaningResult {
  const lines = rawData.split('\n').map(line => line.trim())
  const stats = {
    originalRows: lines.length,
    cleanedRows: 0,
    duplicatesRemoved: 0,
    emptyRowsRemoved: 0,
    invalidRowsRemoved: 0
  }
  const warnings: string[] = []

  // 移除空行
  const nonEmptyLines = lines.filter(line => {
    if (!line) {
      stats.emptyRowsRemoved++
      return false
    }
    return true
  })

  if (nonEmptyLines.length === 0) {
    return {
      cleaned: '',
      stats,
      warnings: ['数据为空']
    }
  }

  // 检测分隔符
  const firstLine = nonEmptyLines[0]
  const delimiter = detectDelimiter(firstLine)

  // 解析数据
  const rows = nonEmptyLines.map(line => line.split(delimiter).map(cell => cell.trim()))

  // 验证列数一致性
  const headerColumnCount = rows[0].length
  const validRows = rows.filter((row, index) => {
    if (row.length !== headerColumnCount) {
      stats.invalidRowsRemoved++
      if (index > 0) { // 不警告标题行
        warnings.push(`第 ${index + 1} 行列数不匹配，已移除`)
      }
      return false
    }
    return true
  })

  // 去重（保留第一次出现）
  const seen = new Set<string>()
  const uniqueRows = validRows.filter((row, index) => {
    if (index === 0) return true // 保留标题行

    const key = row.join('|')
    if (seen.has(key)) {
      stats.duplicatesRemoved++
      return false
    }
    seen.add(key)
    return true
  })

  stats.cleanedRows = uniqueRows.length

  // 重新组合数据
  const cleaned = uniqueRows.map(row => row.join(delimiter)).join('\n')

  if (stats.duplicatesRemoved > 0) {
    warnings.push(`移除了 ${stats.duplicatesRemoved} 行重复数据`)
  }
  if (stats.emptyRowsRemoved > 0) {
    warnings.push(`移除了 ${stats.emptyRowsRemoved} 行空数据`)
  }
  if (stats.invalidRowsRemoved > 0) {
    warnings.push(`移除了 ${stats.invalidRowsRemoved} 行格式错误的数据`)
  }

  return { cleaned, stats, warnings }
}

function detectDelimiter(line: string): string {
  const delimiters = [',', '\t', '|', ';']
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (line.match(new RegExp(`\\${d}`, 'g')) || []).length
  }))

  const best = counts.reduce((max, curr) => curr.count > max.count ? curr : max)
  return best.count > 0 ? best.delimiter : ','
}

export function normalizeNumbers(text: string): string {
  return text
    .replace(/(\d+),(\d{3})/g, '$1$2') // 移除千位分隔符
    .replace(/[％%]/g, '') // 移除百分号
    .replace(/[¥$￥]/g, '') // 移除货币符号
}

export function extractNumbers(text: string): number[] {
  const normalized = normalizeNumbers(text)
  const matches = normalized.match(/\d+\.?\d*/g)
  return matches ? matches.map(m => parseFloat(m)).filter(n => !isNaN(n)) : []
}

export function validateDataQuality(data: string): {
  isValid: boolean
  quality: 'high' | 'medium' | 'low'
  issues: string[]
} {
  const issues: string[] = []
  const lines = data.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    issues.push('数据行数过少（少于2行）')
    return { isValid: false, quality: 'low', issues }
  }

  const rows = lines.map(line => line.split(/[,\t|;]/).map(cell => cell.trim()))
  const headerCount = rows[0].length

  // 检查列数一致性
  const inconsistentRows = rows.filter(row => row.length !== headerCount).length
  if (inconsistentRows > rows.length * 0.2) {
    issues.push(`超过20%的行列数不一致`)
  }

  // 检查空值比例
  let emptyCount = 0
  let totalCells = 0
  rows.forEach(row => {
    row.forEach(cell => {
      totalCells++
      if (!cell || cell === '') emptyCount++
    })
  })

  const emptyRatio = emptyCount / totalCells
  if (emptyRatio > 0.3) {
    issues.push(`空值比例过高 (${(emptyRatio * 100).toFixed(1)}%)`)
  }

  // 判断质量
  let quality: 'high' | 'medium' | 'low' = 'high'
  if (issues.length > 2 || emptyRatio > 0.5) {
    quality = 'low'
  } else if (issues.length > 0 || emptyRatio > 0.2) {
    quality = 'medium'
  }

  return {
    isValid: issues.length === 0 || quality !== 'low',
    quality,
    issues
  }
}
