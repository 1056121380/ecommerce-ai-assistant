import { invoke, isTauri } from '@tauri-apps/api/core'
import { loadJson, saveJson } from './storage'

interface BackendHttpResponse {
  status: number
  body: string
}

export interface PublicDataItem {
  source: string
  title: string
  url?: string
  summary?: string
  publishedAt?: string
  metrics?: Record<string, string | number>
}

export interface PublicDataResult {
  query: string
  updatedAt: number
  items: PublicDataItem[]
  errors: string[]
}

const PUBLIC_DATA_CACHE_TTL_MS = 30 * 60 * 1000
const PUBLIC_FETCH_TIMEOUT_MS = 8_000

const keywordMap: Array<[RegExp, string]> = [
  [/防晒|遮阳|冰丝|凉感/, 'sunscreen summer clothing'],
  [/露营|户外|徒步|骑行|钓鱼/, 'outdoor camping'],
  [/美妆|护肤|口红|面膜|香水/, 'beauty skincare'],
  [/手机|数码|耳机|电脑|平板/, 'phone electronics'],
  [/鞋|运动鞋|凉鞋|拖鞋/, 'shoes'],
  [/家居|家具|收纳|厨房/, 'home furniture'],
  [/食品|零食|饮料|咖啡|茶/, 'food beverage'],
  [/直播|带货|抖音|tiktok/, 'live commerce tiktok shop'],
  [/关键词|热词|搜索|趋势/, 'ecommerce search trends'],
  [/卖得好|卖的好|热卖|爆款|畅销|好卖|卖什么|什么卖|现在.*卖|近期.*卖/, 'trending ecommerce products'],
]

export async function fetchDefaultPublicData(question: string): Promise<PublicDataResult> {
  const query = buildPublicDataQuery(question)
  const cached = await loadPublicDataCache(query)
  if (cached) return cached

  const results = await Promise.allSettled([
    fetchDouyinHotList(query),
    fetchGoogleCnTrends(query),
    fetchGdeltArticles(query)
  ])

  const items: PublicDataItem[] = []
  const errors: string[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  }

  const snapshot: PublicDataResult = {
    query,
    updatedAt: Date.now(),
    items: items.slice(0, 15),
    errors
  }

  await savePublicDataCache(snapshot)
  return snapshot
}

export function formatPublicDataForPrompt(result: PublicDataResult): string {
  if (!result.items.length) {
    const errorText = result.errors.length ? `\n抓取异常：${result.errors.slice(0, 3).join('；')}` : ''
    return `公开数据源未返回可用结果。查询词：${result.query}${errorText}`
  }

  const rows = result.items.map((item, index) => {
    const metrics = item.metrics
      ? `\n指标：${Object.entries(item.metrics).map(([key, value]) => `${key}=${value}`).join('，')}`
      : ''
    const url = item.url ? `\n链接：${item.url}` : ''
    const publishedAt = item.publishedAt ? `\n时间：${item.publishedAt}` : ''
    return `${index + 1}. [${item.source}] ${item.title}${publishedAt}${metrics}${item.summary ? `\n摘要：${item.summary}` : ''}${url}`
  })

  const errors = result.errors.length
    ? `\n\n部分公开数据源不可用：${result.errors.slice(0, 3).join('；')}`
    : ''

  return `查询词：${result.query}\n更新时间：${new Date(result.updatedAt).toLocaleString()}\n\n${rows.join('\n\n')}${errors}`
}

export function buildPublicDataQuery(question: string): string {
  const normalized = question.replace(/\s+/g, ' ').trim()
  for (const [pattern, keyword] of keywordMap) {
    if (pattern.test(normalized)) return keyword
  }

  const englishTokens = normalized.match(/[A-Za-z][A-Za-z0-9-]{2,}/g)
  if (englishTokens?.length) {
    return englishTokens.slice(0, 5).join(' ')
  }

  const chinese = normalized
    .replace(/[，。！？、：；,.!?;:()[\]{}"'`~@#$%^&*_+=|\\/<>-]/g, ' ')
    .replace(/请|帮我|分析|一下|这个|那个|是否|可以|怎么|如何|什么|为什么|电商|商品|产品/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return chinese.slice(0, 40) || 'ecommerce trends'
}

// --- 抖音热搜榜 ---
async function fetchDouyinHotList(query: string): Promise<PublicDataItem[]> {
  // 抖音热搜版 API（公开可用，无需登录）
  const text = await requestPublicText('https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1')
  const data = JSON.parse(text) as {
    status_code?: number
    data?: Array<{
      word: string
      hot_value?: number
      label?: string
      challenge_id?: string
    }>
  }

  if (!data?.data?.length) return []

  return data.data.slice(0, 10).map((item, index) => ({
    source: '抖音热搜',
    title: `#${index + 1} ${item.word}${item.label ? ` [${item.label}]` : ''}`,
    summary: item.hot_value ? `热度值：${item.hot_value}` : undefined,
    url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`
  }))
}

// --- Google 中国趋势 ---
async function fetchGoogleCnTrends(query: string): Promise<PublicDataItem[]> {
  // Google Trends 中国每日趋势（繁体中文RSS）
  const text = await requestPublicText('https://trends.google.com/trends/trendingsearches/daily/rss?geo=CN')
  const items = extractRssItems(text).slice(0, 8)
  return items.map(item => ({
    source: '百度热搜',
    title: item.title,
    url: item.link,
    publishedAt: item.pubDate,
    summary: item.description
  }))
}

// --- GDELT 新闻（优化中文电商查询）---
async function fetchGdeltArticles(query: string): Promise<PublicDataItem[]> {
  // 去掉硬编码的英文后缀，保留中文相关性
  const gdeltQuery = encodeURIComponent(`${query}`)
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=artlist&format=json&maxrecords=5&sort=hybridrel&sourcecountry=CN`
  const text = await requestPublicText(url)
  const data = JSON.parse(text) as {
    articles?: Array<{ title?: string; url?: string; seendate?: string; sourcecountry?: string; domain?: string }>
  }

  return (data.articles || []).slice(0, 5).map(article => ({
    source: 'GDELT公开新闻',
    title: article.title || '未命名新闻',
    url: article.url,
    publishedAt: article.seendate,
    summary: [article.domain, article.sourcecountry].filter(Boolean).join(' / ')
  }))
}

async function requestPublicText(endpoint: string): Promise<string> {
  if (isTauri()) {
    const response = await invoke<BackendHttpResponse>('get_text', {
      endpoint,
      timeoutSecs: Math.ceil(PUBLIC_FETCH_TIMEOUT_MS / 1000)
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`公开数据源 HTTP ${response.status}`)
    }
    return response.body
  }

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), PUBLIC_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    if (!response.ok) throw new Error(`公开数据源 HTTP ${response.status}`)
    return await response.text()
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function extractRssItems(xml: string): Array<{ title: string; link?: string; pubDate?: string; description?: string }> {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(match => {
    const item = match[1]
    return {
      title: decodeXml(readXmlTag(item, 'title') || '未命名趋势'),
      link: decodeXml(readXmlTag(item, 'link') || ''),
      pubDate: decodeXml(readXmlTag(item, 'pubDate') || ''),
      description: stripHtml(decodeXml(readXmlTag(item, 'description') || ''))
    }
  })
}

function readXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || ''
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function loadPublicDataCache(query: string): Promise<PublicDataResult | null> {
  const cache = await loadJson<Record<string, PublicDataResult>>('public_data_cache.json')
  const item = cache?.[query]
  if (!item) return null
  if (Date.now() - item.updatedAt > PUBLIC_DATA_CACHE_TTL_MS) return null
  return item
}

async function savePublicDataCache(result: PublicDataResult): Promise<void> {
  const cache = await loadJson<Record<string, PublicDataResult>>('public_data_cache.json') || {}
  cache[result.query] = result
  await saveJson('public_data_cache.json', cache)
}
