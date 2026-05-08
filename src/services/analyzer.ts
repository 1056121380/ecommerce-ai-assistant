import { llmService } from './llm'
import { stripReasoningText } from './llm'
import { buildDefaultDataContext, formatDataContext } from './dataSources'
import { fetchDefaultPublicData, formatPublicDataForPrompt } from './publicData'
import Papa from 'papaparse'

export type AnalysisType = 'product' | 'hotwords' | 'data'

export interface AnalysisOptions {
  type: AnalysisType
  title: string
  promptTemplate: string
  userData: string
  onChunk?: (text: string) => void
}

export class AnalysisService {
  async analyze(options: AnalysisOptions): Promise<string> {
    const { promptTemplate, userData, onChunk } = options

    const query = `${options.title}\n${userData.slice(0, 500)}`
    const publicData = await fetchDefaultPublicData(query)
    const systemMessage = `${promptTemplate}\n\n默认参考上下文：\n${formatDataContext(buildDefaultDataContext(query))}\n\n默认公开数据源实时结果：\n${formatPublicDataForPrompt(publicData)}\n\n请直接基于用户数据、公开数据源和内置框架输出结论，不要在开头说无法提供实时数据。若缺少平台后台精确销量，只在末尾用一句话标注数据边界。`
    const userMessage = `以下是数据：\n\`\`\`\n${userData}\n\`\`\``

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ]

    let fullContent = ''

    await llmService.chat(messages, (chunk) => {
      fullContent += chunk
      onChunk?.(chunk)
    })

    return stripReasoningText(fullContent)
  }

  // 解析 CSV 数据
  parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
    return this.parseData(csvText)
  }

  parseData(rawText: string): { headers: string[]; rows: string[][] } {
    const text = rawText.trim()
    if (!text) return { headers: [], rows: [] }

    if (text.startsWith('{') || text.startsWith('[')) {
      const jsonPreview = this.parseJsonPreview(text)
      if (jsonPreview) return jsonPreview
    }

    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true
    })

    if (result.errors.length) {
      throw new Error(`CSV解析失败：${result.errors[0].message}`)
    }

    const [headers = [], ...rows] = result.data
    return {
      headers: headers.map(cell => String(cell).trim()),
      rows: rows.map(row => row.map(cell => String(cell).trim()))
    }
  }

  private parseJsonPreview(text: string): { headers: string[]; rows: string[][] } | null {
    try {
      const data = JSON.parse(text)
      const records = Array.isArray(data) ? data : [data]
      if (!records.length || records.some(item => item === null || typeof item !== 'object' || Array.isArray(item))) {
        return { headers: ['value'], rows: records.map(item => [JSON.stringify(item)]) }
      }

      const objectRecords = records as Array<Record<string, unknown>>
      const headers = Array.from(
        objectRecords.reduce((keys: Set<string>, item) => {
          Object.keys(item).forEach(key => keys.add(key))
          return keys
        }, new Set<string>())
      )

      return {
        headers,
        rows: objectRecords.map(item => (
          headers.map(header => {
            const value = item[header]
            return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
          })
        ))
      }
    } catch {
      return null
    }
  }

  // 验证数据格式
  validateData(_type: AnalysisType, data: string): { valid: boolean; error?: string } {
    if (!data || data.trim().length === 0) {
      return { valid: false, error: '请输入或上传数据' }
    }

    if (data.trim().length < 10) {
      return { valid: false, error: '数据内容太少，请提供更完整的数据' }
    }

    if (new Blob([data]).size > 2 * 1024 * 1024) {
      return { valid: false, error: '数据文件过大，请精简到2MB以内后再分析' }
    }

    return { valid: true }
  }
}

export const analysisService = new AnalysisService()
