<template>
  <el-dialog v-model="visible" title="分析结果对比" width="90%" top="5vh">
    <div class="compare-container">
      <div class="compare-header">
        <el-tag type="info">已选择 {{ selectedResults.length }} 个结果进行对比</el-tag>
        <el-button size="small" @click="clearSelection">清空选择</el-button>
      </div>

      <div class="compare-grid">
        <div v-for="result in selectedResults" :key="result.id" class="compare-item">
          <div class="compare-item-header">
            <div>
              <strong>{{ result.title }}</strong>
              <el-tag size="small" :type="getTypeTag(result.type)" style="margin-left: 8px">
                {{ getTypeText(result.type) }}
              </el-tag>
            </div>
            <div class="compare-item-meta">
              <span>{{ new Date(result.createdAt).toLocaleString() }}</span>
              <el-button text type="danger" size="small" @click="removeFromCompare(result.id)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="compare-item-content">
            <MarkdownRenderer :content="result.content" />
          </div>
        </div>
      </div>

      <div v-if="selectedResults.length === 0" class="empty-compare">
        <el-icon :size="48" color="#dcdfe6"><DataAnalysis /></el-icon>
        <p>请从历史记录中选择要对比的分析结果</p>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" @click="exportComparison">
        <el-icon><Download /></el-icon>
        导出对比结果
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { AnalysisResult } from '@/stores/analysis'
import { exportTextFile } from '@/services/storage'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  modelValue: boolean
  selectedIds: string[]
  results: AnalysisResult[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:selectedIds': [ids: string[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const selectedResults = computed(() => {
  return props.results.filter(r => props.selectedIds.includes(r.id))
})

const getTypeText = (type: string) => {
  const map: Record<string, string> = {
    product: '选品分析',
    hotwords: '热词分析',
    data: '带货分析'
  }
  return map[type] || type
}

const getTypeTag = (type: string) => {
  const map: Record<string, 'success' | 'warning' | 'info'> = {
    product: 'success',
    hotwords: 'warning',
    data: 'info'
  }
  return map[type] || 'info'
}

const removeFromCompare = (id: string) => {
  const newIds = props.selectedIds.filter(i => i !== id)
  emit('update:selectedIds', newIds)
}

const clearSelection = () => {
  emit('update:selectedIds', [])
}

const exportComparison = () => {
  if (selectedResults.value.length === 0) {
    ElMessage.warning('没有可导出的对比结果')
    return
  }

  const content = selectedResults.value
    .map((result, index) => {
      return `## ${index + 1}. ${result.title}\n\n**类型**: ${getTypeText(result.type)}\n**时间**: ${new Date(result.createdAt).toLocaleString()}\n\n${result.content}\n\n---\n`
    })
    .join('\n')

  const timestamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-')
  exportTextFile(`分析对比_${timestamp}.md`, `# 分析结果对比\n\n${content}`)
  ElMessage.success('对比结果已导出')
}
</script>

<style scoped>
.compare-container {
  min-height: 400px;
}

.compare-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.compare-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
}

.compare-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.compare-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}

.compare-item-content {
  max-height: 400px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
}

.empty-compare {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
  gap: 12px;
}

:root.dark .compare-item {
  background: #2a2a2a;
  border-color: #3a3a3a;
}

:root.dark .compare-item-header {
  border-bottom-color: #3a3a3a;
}
</style>
