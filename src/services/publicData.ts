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
  [/卖得好|卖的好|热卖|爆款|畅销|好卖|卖什么|什么卖|现在.*卖|近期.*卖/, 'trending ecommerce products'],
  [/防晒|遮阳|冰丝|凉感/, 'sunscreen summer clothing'],
  [/露营|户外|徒步|骑行|钓鱼/, 'outdoor camping'],
  [/美妆|护肤|口红|面膜|香水/, 'beauty skincare'],
  [/手机|数码|耳机|电脑|平板/, 'phone electronics'],
  [/鞋|运动鞋|凉鞋|拖鞋/, 'shoes'],
  [/家居|家具|收纳|厨房/, 'home furniture'],
  [/食品|零食|饮料|咖啡|茶/, 'food beverage'],
  [/直播|带货|抖音|tiktok/, 'live commerce tiktok shop'],
  [/关键词|热词|搜索|趋势/, 'ecommerce search trends']
]

export async function fetchDefaultPublicData(question: string): Promise<PublicDataResult> {
  const query = buildPublicDataQuery(question)
  const cached = await loadPublicDataCache(query)
  if (cached) return cached

  const results = await Promise.allSettled([
    fetchGdeltArticles(query),
    fetchGoogleDailyTrends(),
    fetchDummyProducts(query)
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
    items: items.slice(0, 12),
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

async function fetchGdeltArticles(query: string): Promise<PublicDataItem[]> {
  const gdeltQuery = `${query} ecommerce OR "online retail" OR "social commerce"`
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(gdeltQuery)}&mode=artlist&format=json&maxrecords=5&sort=hybridrel`
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

async function fetchGoogleDailyTrends(): Promise<PublicDataItem[]> {
  const text = await requestPublicText('https://trends.google.com/trends/trendingsearches/daily/rss?geo=US')
  return extractRssItems(text).slice(0, 5).map(item => ({
    source: 'Google Trends Daily',
    title: item.title,
    url: item.link,
    publishedAt: item.pubDate,
    summary: item.description
  }))
}

async function fetchDummyProducts(query: string): Promise<PublicDataItem[]> {
  const url = `https://dummyjson.com/products/search?q=${encodeURIComponent(query)}&limit=5`
  const text = await requestPublicText(url)
  const data = JSON.parse(text) as {
    products?: Array<{ title?: string; brand?: string; category?: string; price?: number; rating?: number; stock?: number; thumbnail?: string }>
  }

  return (data.products || []).slice(0, 5).map(product => ({
    source: 'DummyJSON公开商品',
    title: product.title || '未命名商品',
    summary: [product.brand, product.category].filter(Boolean).join(' / '),
    metrics: {
      price: product.price ?? '-',
      rating: product.rating ?? '-',
      stock: product.stock ?? '-'
    },
    url: product.thumbnail
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
