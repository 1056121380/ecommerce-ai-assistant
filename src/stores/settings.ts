import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { deleteSecret, loadJson, loadSecret, saveJson, saveSecret } from '@/services/storage'

export interface LLMConfig {
  model: string
  name: string
  apiEndpoint: string
  apiKey: string
  temperature: number
  maxTokens: number
}

export const MODEL_PRESETS: Record<string, Omit<LLMConfig, 'apiKey'>> = {
  minimax: {
    model: 'MiniMax-M2.7',
    name: 'MiniMax',
    apiEndpoint: 'https://api.minimaxi.com/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  },
  minimax_global: {
    model: 'MiniMax-M2.7',
    name: 'MiniMax Global',
    apiEndpoint: 'https://api.minimax.io/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  },
  kimi: {
    model: 'moonshot-v1-8k',
    name: 'Kimi',
    apiEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  },
  claude: {
    model: 'claude-3-5-sonnet-latest',
    name: 'Claude',
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    temperature: 0.7,
    maxTokens: 2000
  },
  siliconflow: {
    model: 'Qwen/Qwen2.5-7B-Instruct',
    name: '硅基流动',
    apiEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  },
  openai: {
    model: 'gpt-3.5-turbo',
    name: 'OpenAI',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  },
  ollama: {
    model: 'llama3',
    name: 'Ollama 本地',
    apiEndpoint: 'http://localhost:11434/v1/chat/completions',
    temperature: 0.7,
    maxTokens: 2000
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const currentModel = ref<string>('minimax')
  const apiKey = ref<string>('')
  const apiEndpoint = ref<string>('')
  const temperature = ref<number>(0.7)
  const maxTokens = ref<number>(2000)
  const isLoaded = ref(false)

  const currentPreset = computed(() => MODEL_PRESETS[currentModel.value] || MODEL_PRESETS.minimax)

  const effectiveEndpoint = computed(() => {
    return apiEndpoint.value || currentPreset.value.apiEndpoint
  })

  const effectiveModel = computed(() => {
    return currentPreset.value.model
  })

  async function loadConfig() {
    try {
      const config = await loadJson<{
        currentModel?: string
        apiKey?: string
        apiEndpoint?: string
        temperature?: number
        maxTokens?: number
      }>('llm_config.json')

      if (config) {
        currentModel.value = MODEL_PRESETS[config.currentModel || ''] ? config.currentModel! : 'minimax'
        apiEndpoint.value = config.apiEndpoint || ''
        temperature.value = config.temperature ?? 0.7
        maxTokens.value = config.maxTokens ?? 2000

        if (config.apiKey) {
          await saveSecret(currentModel.value, config.apiKey)
          localStorage.removeItem('llm_config')
        }
      }

      apiKey.value = await loadSecret(currentModel.value)
    } catch (error) {
      console.error('加载配置失败', error)
    }
    isLoaded.value = true
  }

  async function saveConfig() {
    const config = {
      currentModel: currentModel.value,
      apiEndpoint: apiEndpoint.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value
    }
    const results = await Promise.allSettled([
      saveJson('llm_config.json', config),
      saveSecret(currentModel.value, apiKey.value)
    ])
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      throw new Error(`配置保存部分失败：${(failures[0].reason as Error).message}`)
    }
  }

  async function resetConfig() {
    await deleteSecret(currentModel.value)
    currentModel.value = 'minimax'
    apiKey.value = ''
    apiEndpoint.value = ''
    temperature.value = 0.7
    maxTokens.value = 2000
    await saveJson('llm_config.json', {
      currentModel: currentModel.value,
      apiEndpoint: apiEndpoint.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value
    })
  }

  // 初始化时加载配置
  loadConfig()

  watch(currentModel, async (model) => {
    apiKey.value = ''
    try {
      apiKey.value = await loadSecret(model)
    } catch (error) {
      apiKey.value = ''
      console.error('加载 API Key 失败', error)
    }
  })

  return {
    currentModel,
    apiKey,
    apiEndpoint,
    temperature,
    maxTokens,
    isLoaded,
    currentPreset,
    effectiveEndpoint,
    effectiveModel,
    loadConfig,
    saveConfig,
    resetConfig
  }
})
