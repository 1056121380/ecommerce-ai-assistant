<template>
  <div class="template-list">
    <el-empty v-if="!templates.length" description="暂无模板" />
    <div v-else class="list-grid">
      <el-card v-for="template in templates" :key="template.id" class="template-card">
        <div class="card-header">
          <div class="title-row">
            <strong>{{ template.name }}</strong>
            <el-tag v-if="template.isBuiltIn" size="small" type="info">内置</el-tag>
          </div>
          <div class="actions">
            <el-button text @click="$emit('duplicate', template)">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button v-if="!template.isBuiltIn" text @click="$emit('edit', template)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button v-if="!template.isBuiltIn" text type="danger" @click="$emit('delete', template)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="card-body">
          <p class="description">{{ template.description }}</p>
          <div class="meta">
            <el-tag size="small">{{ template.variables.length }} 个变量</el-tag>
            <span class="time">{{ formatDate(template.updatedAt) }}</span>
          </div>
          <div class="preview">
            <div class="preview-label">Prompt 预览：</div>
            <div class="preview-content">{{ template.prompt.slice(0, 150) }}...</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CopyDocument, Edit, Delete } from '@element-plus/icons-vue'
import type { PromptTemplate } from '@/stores/templates'

defineProps<{
  templates: PromptTemplate[]
}>()

defineEmits<{
  edit: [template: PromptTemplate]
  delete: [template: PromptTemplate]
  duplicate: [template: PromptTemplate]
}>()

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.template-list {
  min-height: 300px;
}

.list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.template-card {
  transition: all 0.2s;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.title-row strong {
  font-size: 15px;
}

.actions {
  display: flex;
  gap: 4px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0;
}

.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time {
  font-size: 12px;
  color: #909399;
}

.preview {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
}

.preview-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.preview-content {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 深色模式 */
.dark .preview {
  background: var(--el-bg-color-overlay);
}
</style>
