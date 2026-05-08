import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadJson, saveJson } from '@/services/storage'

export interface AnalysisResult {
  id: string
  type: 'product' | 'hotwords' | 'data'
  title: string
  content: string
  rawData: string
  createdAt: number
}

export const useAnalysisStore = defineStore('analysis', () => {
  const results = ref<AnalysisResult[]>([])

  function addResult(type: 'product' | 'hotwords' | 'data', title: string, content: string, rawData: string) {
    results.value.unshift({
      id: Date.now().toString(),
      type,
      title,
      content,
      rawData,
      createdAt: Date.now()
    })
    saveResults()
  }

  function deleteResult(id: string) {
    const idx = results.value.findIndex(r => r.id === id)
    if (idx !== -1) {
      results.value.splice(idx, 1)
      saveResults()
    }
  }

  async function saveResults() {
    try {
      await saveJson('analysis_results.json', results.value)
    } catch (e) {
      console.error('保存分析结果失败', e)
    }
  }

  async function loadResults() {
    try {
      const saved = await loadJson<AnalysisResult[]>('analysis_results.json')
      if (saved) {
        results.value = saved
      }
    } catch (e) {
      console.error('加载分析结果失败', e)
    }
  }

  loadResults()

  return {
    results,
    addResult,
    deleteResult,
    loadResults
  }
})
