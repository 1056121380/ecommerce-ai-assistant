import { reactive } from 'vue'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/stores/settings'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>
}

interface BackendHttpResponse {
  status: number
  body: string
}

export interface LlmDiagnostics {
  status: 'idle' | 'running' | 'success' | 'error'
  provider: string
  model: string
  endpoint: string
  startedAt: number | null
  finishedAt: number | null
  latencyMs: number | null
  httpStatus: number | null
  lastError: string
  responsePreview: string
}

const REQUEST_TIMEOUT_MS = 45_000
const RESPONSE_PREVIEW_LIMIT = 500
const MINIMAX_MAX_HISTORY_MESSAGES = 8
const MINIMAX_MAX_MESSAGE_CHARS = 6_000
const MINIMAX_MAX_SYSTEM_CHARS = 4_000

export const llmDiagnostics = reactive<LlmDiagnostics>({
  status: 'idle',
  provider: '',
  model: '',
  endpoint: '',
  startedAt: null,
  finishedAt: null,
  latencyMs: null,
  httpStatus: null,
  lastError: '',
  responsePreview: ''
})

export class LLMService {
  private get settings() {
    return useSettingsStore()
  }

  private activeAbortController: AbortController | null = null

  abort() {
    this.activeAbortController?.abort()
  }

  async chat(
    messages: ChatMessage[],
    onChunk?: (text: string) => void
  ): Promise<string> {
    this.activeAbortController = new AbortController()
    const {
      currentModel,
      apiKey,
      effectiveEndpoint,
      effectiveModel,
      temperature,
      maxTokens
    } = this.settings

    this.validateConfig(currentModel, effectiveEndpoint, apiKey)
    this.markDiagnosticsStart(currentModel, effectiveModel, effectiveEndpoint)

    try {
      const result = currentModel === 'claude'
        ? await this.anthropicChat(effectiveEndpoint, apiKey, effectiveModel, messages, temperature, maxTokens, onChunk, this.activeAbortController.signal)
        : await this.openAICompatibleChat(
          currentModel,
          effectiveEndpoint,
          apiKey,
          effectiveModel,
          messages,
          temperature,
          maxTokens,
          onChunk,
          this.activeAbortController.signal
        )

      const cleaned = stripReasoningText(result)
      if (!cleaned.trim()) {
        throw new Error('接口返回空内容，请检查模型、API Endpoint 或 API Key 是否匹配')
      }
      this.markDiagnosticsSuccess(cleaned)
      return cleaned
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || '请求失败')
      this.markDiagnosticsError(message)
      throw error instanceof Error ? error : new Error(message)
    }
  }

  async testConnection(): Promise<string> {
    const response = await this.chat([
      { role: 'system', content: '你是连接测试助手。' },
      { role: 'user', content: '请只回复“连接成功”四个字。' }
    ])
    return stripReasoningText(response)
  }

  private validateConfig(provider: string, endpoint: string, apiKey: string) {
    if (!endpoint.trim()) {
      throw new Error('API Endpoint 不能为空')
    }

    try {
      const url = new URL(endpoint)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error()
      }
    } catch {
      throw new Error('API Endpoint 格式不正确，请填写完整的 http:// 或 https:// 地址')
    }

    if (provider !== 'ollama' && !apiKey.trim()) {
      throw new Error('请先在设置中配置 API Key')
    }
  }

  private async openAICompatibleChat(
    provider: string,
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    onChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model,
      stream: !!onChunk
    }

    if (provider === 'minimax' || provider === 'minimax_global') {
      body.messages = normalizeMiniMaxMessages(messages)
      body.temperature = clampMiniMaxTemperature(temperature)
      body.top_p = 0.95
      body.max_completion_tokens = Math.min(Math.max(maxTokens, 1), 2048)
    } else {
      body.messages = messages
      body.temperature = temperature
      body.max_tokens = maxTokens
    }

    if (onChunk && isTauri()) {
      body.stream = false
      const result = await this.normalOpenAICompatible(endpoint, apiKey, body, signal)
      onChunk(result)
      return result
    }

    if (onChunk) {
      try {
        const streamed = await this.streamOpenAICompatible(endpoint, apiKey, body, onChunk, signal)
        if (streamed.trim()) return streamed
        throw new Error('stream empty')
      } catch (error) {
        if (error instanceof Error && (error.message.includes('stream') || error.message.includes('empty'))) {
          body.stream = false
          const result = await this.normalOpenAICompatible(endpoint, apiKey, body, signal)
          onChunk(result)
          return result
        }
        throw error
      }
    }

    return await this.normalOpenAICompatible(endpoint, apiKey, body, signal)
  }

  private async normalOpenAICompatible(endpoint: string, apiKey: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    return await this.withTimeout(async (s) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
      const response = await this.postJson(endpoint, headers, JSON.stringify(body), s)
      llmDiagnostics.httpStatus = response.status
      llmDiagnostics.responsePreview = response.body.slice(0, RESPONSE_PREVIEW_LIMIT)

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`API 错误 ${response.status}: ${response.body.slice(0, 500)}`)
      }

      const data = this.parseJsonResponse(response.body)
      this.assertApiSuccess(data)
      return this.extractContent(data)
    }, signal)
  }

  private async postJson(
    endpoint: string,
    headers: Record<string, string>,
    body: string,
    signal: AbortSignal
  ): Promise<BackendHttpResponse> {
    if (isTauri()) {
      return await invoke<BackendHttpResponse>('post_json', {
        endpoint,
        headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
        body,
        timeoutSecs: Math.ceil(REQUEST_TIMEOUT_MS / 1000)
      })
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      signal
    })

    return {
      status: response.status,
      body: await response.text()
    }
  }

  private async streamOpenAICompatible(
    endpoint: string,
    apiKey: string,
    body: Record<string, unknown>,
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    return await this.withTimeout(async (s) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify(body),
        signal: s
      })

      llmDiagnostics.httpStatus = response.status

      if (!response.ok) {
        const errorText = await response.text()
        llmDiagnostics.responsePreview = errorText.slice(0, RESPONSE_PREVIEW_LIMIT)
        throw new Error(`API 错误 ${response.status}: ${errorText.slice(0, 500)}`)
      }

      if (!response.body) {
        throw new Error('流式响应不可用')
      }

      return await this.readSse(response.body, (payload) => {
        const data = JSON.parse(payload)
        return data.choices?.[0]?.delta?.content
          ?? data.choices?.[0]?.message?.content
          ?? data.reply
          ?? data.content
          ?? ''
      }, onChunk)
    }, signal)
  }

  private async anthropicChat(
    endpoint: string,
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    onChunk?: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const system = messages.find(message => message.role === 'system')?.content
    const userMessages = messages
      .filter(message => message.role !== 'system')
      .map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))

    const body = {
      model,
      system,
      messages: userMessages,
      temperature,
      max_tokens: maxTokens,
      stream: !!onChunk
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }

    if (onChunk && isTauri()) {
      body.stream = false
      const result = await this.normalAnthropic(endpoint, apiKey, model, system, userMessages, temperature, maxTokens, signal)
      onChunk(result)
      return result
    }

    if (onChunk) {
      return await this.withTimeout(async (s) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, Accept: 'text/event-stream' },
          body: JSON.stringify(body),
          signal: s
        })

        llmDiagnostics.httpStatus = response.status

        if (!response.ok) {
          const errorText = await response.text()
          llmDiagnostics.responsePreview = errorText.slice(0, RESPONSE_PREVIEW_LIMIT)
          throw new Error(`API 错误 ${response.status}: ${errorText.slice(0, 500)}`)
        }
        if (!response.body) throw new Error('流式响应不可用')

        return await this.readSse(response.body, (payload) => {
          const data = JSON.parse(payload)
          return data.delta?.text ?? ''
        }, onChunk)
      }, signal)
    }

    return await this.withTimeout(async (s) => {
      const response = await this.postJson(endpoint, headers, JSON.stringify(body), s)
      llmDiagnostics.httpStatus = response.status
      llmDiagnostics.responsePreview = response.body.slice(0, RESPONSE_PREVIEW_LIMIT)

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`API 错误 ${response.status}: ${response.body.slice(0, 500)}`)
      }

      const data: AnthropicMessageResponse = this.parseJsonResponse(response.body)
      return data.content?.map(item => item.text || '').join('') || ''
    })
  }

  private async normalAnthropic(
    endpoint: string,
    apiKey: string,
    model: string,
    system: string | undefined,
    userMessages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number,
    signal?: AbortSignal
  ): Promise<string> {
    return await this.withTimeout(async (s) => {
      const body = {
        model,
        system,
        messages: userMessages,
        temperature,
        max_tokens: maxTokens
      }
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
      const response = await this.postJson(endpoint, headers, JSON.stringify(body), s)
      llmDiagnostics.httpStatus = response.status
      llmDiagnostics.responsePreview = response.body.slice(0, RESPONSE_PREVIEW_LIMIT)

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`API 错误 ${response.status}: ${response.body.slice(0, 500)}`)
      }

      const data: AnthropicMessageResponse = this.parseJsonResponse(response.body)
      return data.content?.map(item => item.text || '').join('') || ''
    }, signal)
  }

  private async readSse(
    body: ReadableStream<Uint8Array>,
    extractChunk: (payload: string) => string,
    onChunk: (text: string) => void
  ): Promise<string> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const text = extractChunk(payload)
          if (text) {
            fullContent += text
            onChunk(text)
          }
        } catch {
          // Some providers send heartbeat or metadata frames that are not content chunks.
        }
      }
    }

    return fullContent
  }

  private async withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, externalSignal?: AbortSignal): Promise<T> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const signals: AbortSignal[] = [controller.signal]
    if (externalSignal) signals.push(externalSignal)

    const merged = signals.length > 1
      ? AbortSignal.any(signals)
      : controller.signal

    try {
      return await operation(merged)
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && /aborted|timeout/i.test(error.message))
      ) {
        throw new Error(`请求超时或已取消：${REQUEST_TIMEOUT_MS / 1000} 秒内没有收到模型回复，请检查网络、代理或 Endpoint`)
      }
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }

  private extractContent(data: any): string {
    const candidates = [
      data?.choices?.[0]?.message?.content,
      data?.choices?.[0]?.text,
      data?.data?.choices?.[0]?.message?.content,
      data?.reply,
      data?.content,
      data?.output_text,
      data?.result,
      data?.answer
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
      if (Array.isArray(candidate)) {
        const text = candidate.map((item: { text?: string; content?: string }) => item.text || item.content || '').join('')
        if (text.trim()) return text
      }
    }

    const outputContent = data?.output?.[0]?.content
    if (Array.isArray(outputContent)) {
      return outputContent.map((item: { text?: string }) => item.text || '').join('')
    }

    const candidateContent = data?.candidates?.[0]?.content?.parts
    if (Array.isArray(candidateContent)) {
      return candidateContent.map((item: { text?: string }) => item.text || '').join('')
    }

    return ''
  }

  private parseJsonResponse(body: string): any {
    try {
      return JSON.parse(body)
    } catch {
      throw new Error(`API 返回的不是有效 JSON：${body.slice(0, 300)}`)
    }
  }

  private assertApiSuccess(data: any) {
    const statusCode = data?.base_resp?.status_code
    if (typeof statusCode === 'number' && statusCode !== 0) {
      throw new Error(`API 错误 ${statusCode}: ${data?.base_resp?.status_msg || '未知错误'}`)
    }

    if (data?.error) {
      const message = typeof data.error === 'string'
        ? data.error
        : data.error.message || JSON.stringify(data.error)
      throw new Error(`API 错误: ${message}`)
    }

    if (data?.code && data.code !== 0 && data.code !== '0') {
      throw new Error(`API 错误 ${data.code}: ${data.message || data.msg || '未知错误'}`)
    }
  }

  private markDiagnosticsStart(provider: string, model: string, endpoint: string) {
    llmDiagnostics.status = 'running'
    llmDiagnostics.provider = provider
    llmDiagnostics.model = model
    llmDiagnostics.endpoint = endpoint
    llmDiagnostics.startedAt = Date.now()
    llmDiagnostics.finishedAt = null
    llmDiagnostics.latencyMs = null
    llmDiagnostics.httpStatus = null
    llmDiagnostics.lastError = ''
    llmDiagnostics.responsePreview = ''
  }

  private markDiagnosticsSuccess(response: string) {
    llmDiagnostics.status = 'success'
    llmDiagnostics.finishedAt = Date.now()
    llmDiagnostics.latencyMs = llmDiagnostics.startedAt ? llmDiagnostics.finishedAt - llmDiagnostics.startedAt : null
    llmDiagnostics.lastError = ''
    if (!llmDiagnostics.responsePreview) {
      llmDiagnostics.responsePreview = response.slice(0, RESPONSE_PREVIEW_LIMIT)
    }
  }

  private markDiagnosticsError(message: string) {
    llmDiagnostics.status = 'error'
    llmDiagnostics.finishedAt = Date.now()
    llmDiagnostics.latencyMs = llmDiagnostics.startedAt ? llmDiagnostics.finishedAt - llmDiagnostics.startedAt : null
    llmDiagnostics.lastError = message
  }

  static PRODUCT_ANALYSIS_PROMPT = `你是专业电商选品分析师。请根据用户提供的数据，从以下维度输出结构化结论：

1. 市场需求：判断品类需求强弱、季节性和用户场景。
2. 竞争强度：识别同质化、价格竞争和进入难度。
3. 利润空间：结合价格带、客单价、物流体积和售后成本判断毛利空间。
4. 内容潜力：判断是否适合短视频、直播和图文种草。
5. 风险提示：指出供应链、合规、退货和库存风险。
6. 行动建议：给出可执行的选品、定价、标题和内容建议。

输出要简洁、明确，优先给结论和动作。`

  static HOTWORDS_ANALYSIS_PROMPT = `你是电商热词和趋势分析师。请分析用户提供的热词数据，并输出：

1. 热词分类：品类词、品牌词、功效词、场景词、人群词、痛点词。
2. 趋势判断：标注上升、平稳或下降，并说明可能原因。
3. 机会词：找出低竞争、高意图或适合内容种草的词。
4. 标题建议：给出可直接用于商品标题或内容标题的组合。
5. 投放建议：区分搜索投放、内容种草和直播间承接词。

如果数据不足，请明确说明缺口，并给出下一步应补充的数据。`

  static DATA_ANALYSIS_PROMPT = `你是直播带货和电商销售数据分析师。请分析用户提供的数据，并输出：

1. 整体表现：GMV、UV价值、GPM、转化率、客单价等关键指标。
2. 漏斗诊断：曝光、进入、停留、点击、加购、付款、退款的主要问题。
3. 商品判断：识别高潜商品、拖累商品和需要优化的价格带。
4. 投流判断：结合投产比和成交效率判断是否值得继续放量。
5. 优化动作：给出货盘、话术、价格、场景和投放方面的具体建议。

结论要直接，建议要能执行。`

  static GENERAL_ASSISTANT_PROMPT = `你是专业的电商 AI 助手，擅长电商运营、选品分析、关键词分析、直播带货分析和销售数据诊断。

回答时请遵守：
1. 优先给结论，再解释依据。
2. 默认使用软件提供的公开数据源结果、内置参考库和用户上传数据来回答，不要在开头说“无法提供”或“没有接入平台实时数据”。
3. 不编造具体销量、GMV、搜索指数或平台排名；如果没有精确数值，用“公开趋势线索显示”“从季节和品类规律看”等措辞。
4. 先给可执行建议，再在末尾用一句话说明数据边界。`
}

export function stripReasoningText(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^\s*(思考过程|思考|reasoning)\s*[:：][\s\S]*?(?=\n{2,}|$)/i, '')
    .trim()
}

export function clampMiniMaxTemperature(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(value, 0.1), 1)
}

export function normalizeMiniMaxMessages(messages: ChatMessage[]): ChatMessage[] {
  const systemContent = messages
    .filter(message => message.role === 'system' && message.content.trim())
    .map(message => message.content.trim())
    .join('\n\n')
    .slice(0, MINIMAX_MAX_SYSTEM_CHARS)

  const dialog = messages
    .filter(message => message.role !== 'system')
    .filter(message => message.content.trim())
    .filter(message => !(message.role === 'assistant' && /^错误[:：]/.test(message.content.trim())))
    .slice(-MINIMAX_MAX_HISTORY_MESSAGES)

  while (dialog.length && dialog[0].role !== 'user') {
    dialog.shift()
  }

  const normalized: ChatMessage[] = []
  if (systemContent) {
    normalized.push({ role: 'system', content: systemContent })
  }

  for (const message of dialog) {
    const previous = normalized[normalized.length - 1]
    if (previous && previous.role === message.role && message.role !== 'system') {
      previous.content = `${previous.content}\n\n${message.content.trim()}`
    } else {
      normalized.push({
        role: message.role,
        content: message.content.trim().slice(0, MINIMAX_MAX_MESSAGE_CHARS)
      })
    }
  }

  if (!normalized.some(message => message.role === 'user')) {
    normalized.push({ role: 'user', content: '你好' })
  }

  return normalized
}

export function formatLlmError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '请求失败')

  if (/401|unauthorized|invalid api key|鉴权|认证|api key/i.test(message)) {
    return `${message}\n\n建议：检查 API Key 是否正确，并确认当前模型平台与 API Key 属于同一家服务商。`
  }

  if (/403|forbidden|permission|权限/i.test(message)) {
    return `${message}\n\n建议：检查账号是否开通了该模型、余额是否充足、服务商是否限制当前地区或网络。`
  }

  if (/404|not found|model/i.test(message)) {
    return `${message}\n\n建议：检查模型名称和 API Endpoint 是否匹配，必要时点击“重置”恢复默认地址。`
  }

  if (/invalid chat setting|2013/i.test(message)) {
    return `${message}\n\n建议：如果使用 MiniMax，请把 Temperature 设置为 0.1 到 1 之间，并使用默认 Endpoint 后再测试连接。`
  }

  if (/timeout|超时|aborted/i.test(message)) {
    return `${message}\n\n建议：检查网络、代理或服务商可用性；如果使用本地 Ollama，请确认 Ollama 已启动。`
  }

  if (/empty|空内容/i.test(message)) {
    return `${message}\n\n建议：先在设置里点击“测试连接”，确认模型、Endpoint 和 API Key 可用。`
  }

  if (/failed to fetch|connection refused|请求模型 API 失败/i.test(message)) {
    return `${message}\n\n建议：检查网络连接、代理、防火墙或 Endpoint 是否可以访问。`
  }

  return message
}

export const llmService = new LLMService()
