import { loadJson, saveJson } from './storage'

export type DataSourceKind = 'builtin' | 'public_web' | 'api' | 'local_file'
export type DataSourceStatus = 'active' | 'planned' | 'needs_auth'
export type DataSourceCategory = 'product' | 'keyword' | 'live' | 'sales' | 'platform' | 'general'

export interface DataSourceDefinition {
  id: string
  name: string
  category: DataSourceCategory
  kind: DataSourceKind
  status: DataSourceStatus
  requiresAuth: boolean
  crawlable: boolean
  updateFrequency: string
  fields: string[]
  queryPatterns: RegExp[]
  summary: string
  usageNote: string
}

export interface DataSourceContext {
  id: string
  source: string
  category: DataSourceCategory
  kind: DataSourceKind
  status: DataSourceStatus
  content: string
}

export interface DataSourceCacheSnapshot {
  updatedAt: number
  sources: Array<Omit<DataSourceDefinition, 'queryPatterns'>>
}

export const DATA_SOURCE_REGISTRY: DataSourceDefinition[] = [
  {
    id: 'builtin-seasonal-products',
    name: '内置季节性选品参考库',
    category: 'product',
    kind: 'builtin',
    status: 'active',
    requiresAuth: false,
    crawlable: false,
    updateFrequency: '随版本更新',
    fields: ['季节', '场景', '品类', '价格带', '风险点'],
    queryPatterns: [/防晒|遮阳|夏季|冰丝|凉感|空调被|驱蚊|保暖|冬季|节日|礼物/],
    summary: '按季节、场景、价格带和售后风险整理常见电商品类分析框架。',
    usageNote: '适合做选品判断、标题方向和商品卖点拆解；不是实时销量数据。'
  },
  {
    id: 'builtin-outdoor-products',
    name: '内置户外品类参考库',
    category: 'product',
    kind: 'builtin',
    status: 'active',
    requiresAuth: false,
    crawlable: false,
    updateFrequency: '随版本更新',
    fields: ['场景', '人群', '材料', '客单价', '退货风险'],
    queryPatterns: [/露营|户外|徒步|骑行|钓鱼|登山|野餐/],
    summary: '覆盖露营、徒步、骑行、钓鱼、亲子出游等场景，关注展示效果、体积、材质和退货风险。',
    usageNote: '适合判断内容种草潜力和供应链注意点。'
  },
  {
    id: 'builtin-live-commerce-metrics',
    name: '内置直播带货指标库',
    category: 'live',
    kind: 'builtin',
    status: 'active',
    requiresAuth: false,
    crawlable: false,
    updateFrequency: '随版本更新',
    fields: ['GMV', 'UV价值', 'GPM', '点击率', '转化率', '客单价', '投产比', '退款率'],
    queryPatterns: [/直播|带货|转化|gmv|客单价|uv|投流|gpm|停留|加购/],
    summary: '将直播分析拆成曝光、进入、停留、互动、点击、加购、成交、退款等环节。',
    usageNote: '适合诊断直播间漏斗和投流效率；不代表平台实时大盘。'
  },
  {
    id: 'builtin-keyword-framework',
    name: '内置关键词分析框架',
    category: 'keyword',
    kind: 'builtin',
    status: 'active',
    requiresAuth: false,
    crawlable: false,
    updateFrequency: '随版本更新',
    fields: ['品类词', '品牌词', '功效词', '场景词', '人群词', '痛点词'],
    queryPatterns: [/关键词|热词|搜索|小红书|抖音|淘宝|京东|标题|长尾词/],
    summary: '按搜索意图和内容场景拆分关键词，判断热度、增长、竞争强度和商业转化意图。',
    usageNote: '适合扩词、标题优化和投放词包整理；需要真实热度时应接平台数据。'
  },
  {
    id: 'builtin-product-evaluation',
    name: '内置选品评估框架',
    category: 'product',
    kind: 'builtin',
    status: 'active',
    requiresAuth: false,
    crawlable: false,
    updateFrequency: '随版本更新',
    fields: ['市场容量', '竞争强度', '毛利空间', '供应链', '差异化', '售后风险'],
    queryPatterns: [/竞品|竞争|价格|利润|选品|毛利|供应链|差异化/],
    summary: '综合市场容量、竞争强度、价格带、毛利空间、供应链稳定性、差异化卖点和售后风险。',
    usageNote: '适合形成选品结论和行动建议。'
  },
  {
    id: 'public-trend-search',
    name: '公开趋势与新闻数据连接器',
    category: 'platform',
    kind: 'public_web',
    status: 'active',
    requiresAuth: false,
    crawlable: true,
    updateFrequency: '按需刷新',
    fields: ['关键词', '趋势词', '新闻标题', '发布时间', '来源链接'],
    queryPatterns: [/趋势|指数|公开数据|搜索|热搜|热点|新闻|舆情|关键词|热词|选品|竞品|直播|带货|销售|销量/],
    summary: '默认接入 GDELT 全球公开新闻/网页索引和 Google Trends Daily RSS，提供公开趋势和新闻线索。',
    usageNote: '适合发现公开热点和行业线索；不是平台后台销量、搜索指数或直播榜单。'
  },
  {
    id: 'public-product-catalog',
    name: '公开热榜数据连接器',
    category: 'product',
    kind: 'public_web',
    status: 'active',
    requiresAuth: false,
    crawlable: true,
    updateFrequency: '按需刷新',
    fields: ['热搜词', '热度值', '平台', '类别'],
    queryPatterns: [/商品|产品|价格|品牌|类目|选品|竞品|销售|销量|库存|评价|评分|热搜|热门|爆款/],
    summary: '默认接入抖音热搜榜、百度热搜，提供真实公开热榜数据参考。',
    usageNote: '该来源是公开热榜数据，不代表平台后台真实销售数据。'
  },
  {
    id: 'platform-authorized-sales',
    name: '授权平台销售数据连接器',
    category: 'sales',
    kind: 'api',
    status: 'needs_auth',
    requiresAuth: true,
    crawlable: false,
    updateFrequency: '按授权接口配置',
    fields: ['商品', '销量', 'GMV', '退款率', '流量来源', '转化率'],
    queryPatterns: [/销售|销量|订单|退款|店铺|商品数据|生意参谋|罗盘|千川/],
    summary: '规划接入用户已授权的平台 API 或导出的店铺数据。',
    usageNote: '涉及账号和店铺数据，必须由用户授权或上传文件后使用。'
  }
]

const DEFAULT_CONTEXT: DataSourceContext = {
  id: 'builtin-general-commerce-framework',
  source: '内置电商分析框架',
  category: 'general',
  kind: 'builtin',
  status: 'active',
  content: '回答电商问题时，默认从市场需求、竞争强度、价格带、利润空间、目标人群、渠道打法、内容方向、供应链和风险点进行分析。'
}

export function buildDefaultDataContext(question: string): DataSourceContext[] {
  const normalized = question.trim()
  const matched = DATA_SOURCE_REGISTRY.filter(source => (
    source.queryPatterns.some(pattern => pattern.test(normalized))
  ))

  if (!matched.length) return [DEFAULT_CONTEXT]

  return matched.map(source => ({
    id: source.id,
    source: source.name,
    category: source.category,
    kind: source.kind,
    status: source.status,
    content: `${source.summary}\n字段：${source.fields.join('、')}。\n使用说明：${source.usageNote}`
  }))
}

export function formatDataContext(contexts: DataSourceContext[]): string {
  return contexts
    .map((item, index) => {
      const statusLabel = item.status === 'active'
        ? '已启用'
        : item.status === 'needs_auth'
          ? '需要授权'
          : '规划中'
      return `${index + 1}. ${item.source}（${statusLabel}）\n${item.content}`
    })
    .join('\n\n')
}

export function summarizeAvailableDataSources(): string {
  return DATA_SOURCE_REGISTRY
    .map(source => `- ${source.name}：${source.summary}（${source.status === 'active' ? '已启用' : source.status === 'needs_auth' ? '需要授权' : '规划中'}）`)
    .join('\n')
}

export async function refreshDataSourceCache(): Promise<DataSourceCacheSnapshot> {
  const snapshot: DataSourceCacheSnapshot = {
    updatedAt: Date.now(),
    sources: DATA_SOURCE_REGISTRY.map(({ queryPatterns: _queryPatterns, ...source }) => source)
  }
  await saveJson('data_source_cache.json', snapshot)
  return snapshot
}

export async function loadDataSourceCache(): Promise<DataSourceCacheSnapshot | null> {
  return await loadJson<DataSourceCacheSnapshot>('data_source_cache.json')
}
