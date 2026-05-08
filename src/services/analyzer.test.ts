import { describe, expect, it } from 'vitest'
import { AnalysisService } from './analyzer'
import { clampMiniMaxTemperature, formatLlmError, normalizeMiniMaxMessages, stripReasoningText } from './llm'
import { buildDefaultDataContext, DATA_SOURCE_REGISTRY, formatDataContext } from './dataSources'
import { buildPublicDataQuery, formatPublicDataForPrompt } from './publicData'

describe('AnalysisService', () => {
  const service = new AnalysisService()

  it('parses quoted CSV values', () => {
    const parsed = service.parseData('商品,描述,销量\n防晒衣,"轻薄,透气",5000')

    expect(parsed.headers).toEqual(['商品', '描述', '销量'])
    expect(parsed.rows).toEqual([['防晒衣', '轻薄,透气', '5000']])
  })

  it('builds a preview from JSON arrays', () => {
    const parsed = service.parseData(JSON.stringify([
      { name: '防晒衣', sales: 5000 },
      { name: '运动鞋', price: 199 }
    ]))

    expect(parsed.headers).toEqual(['name', 'sales', 'price'])
    expect(parsed.rows).toEqual([
      ['防晒衣', '5000', ''],
      ['运动鞋', '', '199']
    ])
  })

  it('rejects empty input', () => {
    expect(service.validateData('product', '').valid).toBe(false)
  })

  it('strips model reasoning tags', () => {
    expect(stripReasoningText('<think>hidden</think>\n\n你好')).toBe('你好')
  })

  it('selects default data context by query keywords', () => {
    const context = buildDefaultDataContext('防晒衣适合直播带货吗')
    expect(context.some(item => item.source.includes('季节性'))).toBe(true)
    expect(context.some(item => item.source.includes('直播'))).toBe(true)
  })

  it('keeps active public and authorized data sources explicit', () => {
    expect(DATA_SOURCE_REGISTRY.some(item => item.kind === 'public_web' && item.status === 'active')).toBe(true)
    expect(DATA_SOURCE_REGISTRY.some(item => item.status === 'needs_auth')).toBe(true)
  })

  it('formats data source status in prompt context', () => {
    const text = formatDataContext(buildDefaultDataContext('关键词搜索趋势'))
    expect(text).toContain('已启用')
    expect(text).toContain('公开趋势')
  })

  it('adds actionable hints for auth errors', () => {
    expect(formatLlmError(new Error('API错误 401'))).toContain('API Key')
  })

  it('clamps MiniMax temperature into the accepted range', () => {
    expect(clampMiniMaxTemperature(0)).toBe(0.1)
    expect(clampMiniMaxTemperature(2)).toBe(1)
    expect(clampMiniMaxTemperature(0.7)).toBe(0.7)
  })

  it('explains MiniMax invalid chat setting errors', () => {
    const message = formatLlmError(new Error('invalid params, invalid chat setting (2013)'))
    expect(message).toContain('MiniMax')
    expect(message).toContain('Temperature')
  })

  it('normalizes MiniMax messages into a conservative chat structure', () => {
    const messages = normalizeMiniMaxMessages([
      { role: 'system', content: 'A' },
      { role: 'system', content: 'B' },
      { role: 'assistant', content: '错误：API 错误 400' },
      { role: 'user', content: '你好' },
      { role: 'user', content: '继续' }
    ])

    expect(messages).toEqual([
      { role: 'system', content: 'A\n\nB' },
      { role: 'user', content: '你好\n\n继续' }
    ])
  })

  it('limits MiniMax history and removes leading assistant messages', () => {
    const messages = normalizeMiniMaxMessages([
      { role: 'system', content: 'system' },
      { role: 'assistant', content: 'old assistant' },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `m${index}`
      }))
    ])

    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(messages.length).toBeLessThanOrEqual(9)
  })

  it('maps Chinese ecommerce questions to public data queries', () => {
    expect(buildPublicDataQuery('防晒衣适合直播带货吗')).toBe('sunscreen summer clothing')
    expect(buildPublicDataQuery('分析一下露营装备趋势')).toBe('outdoor camping')
    expect(buildPublicDataQuery('现在什么卖的比较好')).toBe('trending ecommerce products')
  })

  it('formats public data items for prompt injection', () => {
    const text = formatPublicDataForPrompt({
      query: 'phone electronics',
      updatedAt: 1,
      errors: [],
      items: [{
        source: '测试公开源',
        title: '公开商品趋势',
        summary: '样例摘要',
        metrics: { price: 99 }
      }]
    })

    expect(text).toContain('phone electronics')
    expect(text).toContain('测试公开源')
    expect(text).toContain('price=99')
  })
})
