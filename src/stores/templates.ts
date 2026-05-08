import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PromptTemplate {
  id: string
  name: string
  description: string
  type: 'product' | 'hotwords' | 'data' | 'custom'
  prompt: string
  variables: string[] // 模板变量，如 {data}, {platform}, {dateRange}
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'prompt_templates'

export const useTemplateStore = defineStore('templates', () => {
  const templates = ref<PromptTemplate[]>([])
  const isLoaded = ref(false)

  // 内置模板
  const builtInTemplates: PromptTemplate[] = [
    {
      id: 'builtin-product-1',
      name: '选品分析 - 标准版',
      description: '全面分析商品数据，包括市场潜力、竞争态势、定价策略',
      type: 'product',
      prompt: `你是一位资深的电商选品专家。请分析以下商品数据：

{data}

请从以下维度进行分析：
1. 市场潜力评估
2. 竞争态势分析
3. 定价策略建议
4. 目标人群画像
5. 营销推广建议

请用专业、清晰的语言给出分析报告。`,
      variables: ['data'],
      isBuiltIn: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'builtin-product-2',
      name: '选品分析 - 快速版',
      description: '快速分析商品核心指标，给出简明建议',
      type: 'product',
      prompt: `请快速分析以下商品数据，给出核心建议：

{data}

请简明扼要地回答：
1. 是否值得选品？（是/否/待定）
2. 主要优势（3点）
3. 主要风险（3点）
4. 关键行动建议（3点）`,
      variables: ['data'],
      isBuiltIn: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'builtin-hotwords-1',
      name: '热词分析 - 标准版',
      description: '分析热词趋势，给出内容创作和营销建议',
      type: 'hotwords',
      prompt: `你是一位资深的内容营销专家。请分析以下热词数据：

{data}

请从以下维度进行分析：
1. 热词趋势解读
2. 用户需求洞察
3. 内容创作方向
4. 营销切入点
5. 时机把握建议

请用专业、清晰的语言给出分析报告。`,
      variables: ['data'],
      isBuiltIn: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'builtin-data-1',
      name: '带货分析 - 标准版',
      description: '分析直播带货数据，优化运营策略',
      type: 'data',
      prompt: `你是一位资深的直播带货运营专家。请分析以下数据：

{data}

请从以下维度进行分析：
1. 整体表现评估
2. 关键指标分析（GMV、转化率、客单价等）
3. 优势与不足
4. 优化建议
5. 下一步行动计划

请用专业、清晰的语言给出分析报告。`,
      variables: ['data'],
      isBuiltIn: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]

  // 加载模板
  const loadTemplates = async () => {
    if (isLoaded.value) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as PromptTemplate[]
        // 合并内置模板和用户模板
        templates.value = [...builtInTemplates, ...parsed.filter(t => !t.isBuiltIn)]
      } else {
        templates.value = [...builtInTemplates]
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      templates.value = [...builtInTemplates]
    }

    isLoaded.value = true
  }

  // 保存模板
  const saveTemplates = async () => {
    try {
      // 只保存用户自定义模板
      const userTemplates = templates.value.filter(t => !t.isBuiltIn)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userTemplates, null, 2))
    } catch (error) {
      console.error('Failed to save templates:', error)
      throw error
    }
  }

  // 添加模板
  const addTemplate = async (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => {
    const newTemplate: PromptTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    templates.value.push(newTemplate)
    await saveTemplates()
    return newTemplate
  }

  // 更新模板
  const updateTemplate = async (id: string, updates: Partial<PromptTemplate>) => {
    const index = templates.value.findIndex(t => t.id === id)
    if (index === -1) throw new Error('Template not found')

    const template = templates.value[index]
    if (template.isBuiltIn) throw new Error('Cannot modify built-in template')

    templates.value[index] = {
      ...template,
      ...updates,
      id: template.id,
      isBuiltIn: false,
      createdAt: template.createdAt,
      updatedAt: Date.now()
    }

    await saveTemplates()
  }

  // 删除模板
  const deleteTemplate = async (id: string) => {
    const template = templates.value.find(t => t.id === id)
    if (template?.isBuiltIn) throw new Error('Cannot delete built-in template')

    templates.value = templates.value.filter(t => t.id !== id)
    await saveTemplates()
  }

  // 复制模板
  const duplicateTemplate = async (id: string) => {
    const template = templates.value.find(t => t.id === id)
    if (!template) throw new Error('Template not found')

    return addTemplate({
      name: `${template.name} (副本)`,
      description: template.description,
      type: template.type,
      prompt: template.prompt,
      variables: [...template.variables]
    })
  }

  // 获取指定类型的模板
  const getTemplatesByType = (type: PromptTemplate['type']) => {
    return templates.value.filter(t => t.type === type || t.type === 'custom')
  }

  // 获取模板
  const getTemplate = (id: string) => {
    return templates.value.find(t => t.id === id)
  }

  // 应用模板（替换变量）
  const applyTemplate = (templateId: string, variables: Record<string, string>) => {
    const template = getTemplate(templateId)
    if (!template) throw new Error('Template not found')

    let result = template.prompt
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }

    return result
  }

  return {
    templates,
    isLoaded,
    loadTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    getTemplatesByType,
    getTemplate,
    applyTemplate
  }
})
