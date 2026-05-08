<template>
  <div class="batch-analysis-view">
    <div class="page-header">
      <h2>📦 批量分析</h2>
      <p class="sub">一次性处理多个文件，提升工作效率</p>
    </div>

    <div class="content-layout">
      <!-- 创建批量任务 -->
      <el-card v-if="!batchStore.isProcessing" class="create-card">
        <template #header>
          <div class="card-header">
            <span>创建批量任务</span>
          </div>
        </template>

        <el-form label-width="100px">
          <el-form-item label="任务名称">
            <el-input v-model="jobName" placeholder="例如：2024年Q1选品分析" />
          </el-form-item>

          <el-form-item label="分析类型">
            <el-radio-group v-model="analysisType">
              <el-radio label="product">选品分析</el-radio>
              <el-radio label="hotwords">热词分析</el-radio>
              <el-radio label="data">带货分析</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="选择模板">
            <el-select v-model="selectedTemplateId" placeholder="选择分析模板" style="width: 100%">
              <el-option
                v-for="template in availableTemplates"
                :key="template.id"
                :label="template.name"
                :value="template.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="上传文件">
            <el-upload
              ref="uploadRef"
              drag
              multiple
              accept=".csv,.txt,.json,.xlsx,.xls"
              :auto-upload="false"
              :on-change="handleFileChange"
              :file-list="fileList"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  支持 CSV、TXT、JSON、Excel 格式，最多 20 个文件
                </div>
              </template>
            </el-upload>
          </el-form-item>
        </el-form>

        <div class="action-bar">
          <el-button type="primary" size="large" :disabled="!canStart" @click="startBatchAnalysis">
            <el-icon><DataAnalysis /></el-icon>
            开始批量分析 ({{ fileList.length }} 个文件)
          </el-button>
        </div>
      </el-card>

      <!-- 处理中的任务 -->
      <el-card v-if="batchStore.currentJob" class="processing-card">
        <template #header>
          <div class="card-header">
            <span>正在处理：{{ batchStore.currentJob.name }}</span>
            <el-button type="danger" size="small" @click="cancelJob">取消</el-button>
          </div>
        </template>

        <div class="job-progress">
          <el-progress
            :percentage="jobProgress"
            :status="jobProgress === 100 ? 'success' : undefined"
          />
          <div class="progress-text">
            已完成 {{ batchStore.currentJob.completedFiles }} / {{ batchStore.currentJob.totalFiles }} 个文件
            <span v-if="batchStore.currentJob.failedFiles > 0" class="failed-count">
              (失败 {{ batchStore.currentJob.failedFiles }} 个)
            </span>
          </div>
        </div>

        <div class="task-list">
          <div
            v-for="task in batchStore.currentJob.tasks"
            :key="task.id"
            class="task-item"
            :class="task.status"
          >
            <div class="task-info">
              <el-icon v-if="task.status === 'completed'" class="status-icon success"><CircleCheck /></el-icon>
              <el-icon v-else-if="task.status === 'failed'" class="status-icon error"><CircleClose /></el-icon>
              <el-icon v-else-if="task.status === 'processing'" class="status-icon processing"><Loading /></el-icon>
              <el-icon v-else class="status-icon pending"><Clock /></el-icon>
              <span class="file-name">{{ task.fileName }}</span>
              <span class="file-size">{{ formatFileSize(task.fileSize) }}</span>
            </div>
            <el-progress
              v-if="task.status === 'processing'"
              :percentage="task.progress"
              :show-text="false"
              style="margin-top: 8px"
            />
          </div>
        </div>
      </el-card>

      <!-- 历史任务 -->
      <el-card class="history-card">
        <template #header>
          <div class="card-header">
            <span>历史任务</span>
          </div>
        </template>

        <el-empty v-if="!batchStore.jobs.length" description="暂无批量任务" />
        <div v-else class="job-list">
          <div v-for="job in batchStore.jobs" :key="job.id" class="job-item">
            <div class="job-header">
              <div class="job-title">
                <strong>{{ job.name }}</strong>
                <el-tag :type="getJobStatusType(job.status)" size="small">
                  {{ getJobStatusText(job.status) }}
                </el-tag>
              </div>
              <div class="job-actions">
                <el-button v-if="job.status === 'completed'" text @click="viewJobResults(job.id)">
                  <el-icon><View /></el-icon>
                </el-button>
                <el-button v-if="job.status === 'completed'" text @click="exportJobResults(job.id)">
                  <el-icon><Download /></el-icon>
                </el-button>
                <el-button text type="danger" @click="deleteJob(job.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="job-stats">
              <span>{{ job.totalFiles }} 个文件</span>
              <span>完成 {{ job.completedFiles }}</span>
              <span v-if="job.failedFiles > 0" class="failed">失败 {{ job.failedFiles }}</span>
              <span class="time">{{ formatTime(job.createdAt) }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 结果查看对话框 -->
    <el-dialog v-model="showResults" title="批量分析结果" width="80%" top="5vh">
      <div v-if="selectedJob" class="results-container">
        <div
          v-for="task in selectedJob.tasks.filter(t => t.status === 'completed')"
          :key="task.id"
          class="result-item"
        >
          <div class="result-header">
            <strong>{{ task.fileName }}</strong>
            <el-tag size="small">
              {{ task.endTime && task.startTime ? ((task.endTime - task.startTime) / 1000).toFixed(2) + 's' : 'N/A' }}
            </el-tag>
          </div>
          <div class="result-content">
            <MarkdownRenderer v-if="task.result" :content="task.result.content" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile, type UploadInstance } from 'element-plus'
import {
  UploadFilled,
  DataAnalysis,
  CircleCheck,
  CircleClose,
  Loading,
  Clock,
  View,
  Download,
  Delete
} from '@element-plus/icons-vue'
import { useBatchStore } from '@/stores/batch'
import { useTemplateStore } from '@/stores/templates'
import { analysisService } from '@/services/analyzer'
import { LLMService } from '@/services/llm'
import { exportTextFile } from '@/services/storage'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { BatchJob } from '@/stores/batch'

const batchStore = useBatchStore()
const templateStore = useTemplateStore()

const uploadRef = ref<UploadInstance>()
const jobName = ref('')
const analysisType = ref<'product' | 'hotwords' | 'data'>('product')
const selectedTemplateId = ref('')
const fileList = ref<UploadFile[]>([])
const showResults = ref(false)
const selectedJob = ref<BatchJob | null>(null)

const availableTemplates = computed(() =>
  templateStore.getTemplatesByType(analysisType.value)
)

const canStart = computed(() =>
  jobName.value.trim() && fileList.value.length > 0 && fileList.value.length <= 20
)

const jobProgress = computed(() => {
  const job = batchStore.currentJob
  if (!job || job.totalFiles === 0) return 0
  return Math.round((job.completedFiles / job.totalFiles) * 100)
})

onMounted(async () => {
  await templateStore.loadTemplates()
  if (availableTemplates.value.length > 0) {
    selectedTemplateId.value = availableTemplates.value[0].id
  }
})

const handleFileChange = (file: UploadFile, files: UploadFile[]) => {
  fileList.value = files
}

const startBatchAnalysis = async () => {
  if (!canStart.value) return

  const files = fileList.value.map(f => f.raw).filter(Boolean) as File[]

  try {
    const job = await batchStore.createBatchJob(jobName.value, analysisType.value, files)

    // 开始处理
    await batchStore.startBatchJob(job.id, async (content: string) => {
      // 使用选中的模板或默认 Prompt
      let promptTemplate = ''
      if (analysisType.value === 'product') {
        promptTemplate = LLMService.PRODUCT_ANALYSIS_PROMPT
      } else if (analysisType.value === 'hotwords') {
        promptTemplate = LLMService.HOTWORDS_ANALYSIS_PROMPT
      } else {
        promptTemplate = LLMService.DATA_ANALYSIS_PROMPT
      }

      if (selectedTemplateId.value) {
        const template = templateStore.getTemplate(selectedTemplateId.value)
        if (template) {
          promptTemplate = templateStore.applyTemplate(selectedTemplateId.value, { data: content })
        }
      }

      const result = await analysisService.analyze({
        type: analysisType.value,
        title: jobName.value,
        promptTemplate,
        userData: content
      })

      return {
        id: `result_${Date.now()}`,
        type: analysisType.value,
        title: jobName.value,
        content: result,
        rawData: content,
        createdAt: Date.now()
      }
    })

    ElMessage.success('批量分析完成')

    // 重置表单
    jobName.value = ''
    fileList.value = []
    uploadRef.value?.clearFiles()
  } catch (error) {
    ElMessage.error('批量分析失败')
  }
}

const cancelJob = () => {
  if (batchStore.currentJob) {
    batchStore.cancelBatchJob(batchStore.currentJob.id)
    ElMessage.info('已取消批量任务')
  }
}

const viewJobResults = (jobId: string) => {
  selectedJob.value = batchStore.getBatchJob(jobId) || null
  showResults.value = true
}

const exportJobResults = (jobId: string) => {
  const results = batchStore.exportBatchResults(jobId)
  const job = batchStore.getBatchJob(jobId)
  if (job) {
    exportTextFile(`批量分析_${job.name}_${Date.now()}.json`, results)
    ElMessage.success('结果已导出')
  }
}

const deleteJob = async (jobId: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个批量任务吗？', '确认删除', {
      type: 'warning'
    })
    batchStore.deleteBatchJob(jobId)
    ElMessage.success('任务已删除')
  } catch {
    // 用户取消
  }
}

const getJobStatusType = (status: string) => {
  const map: Record<string, any> = {
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return map[status] || 'info'
}

const getJobStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return map[status] || status
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.batch-analysis-view {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 22px;
  margin-bottom: 8px;
}

.page-header .sub {
  color: #909399;
  font-size: 14px;
}

.content-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-bar {
  margin-top: 16px;
}

.job-progress {
  margin-bottom: 20px;
}

.progress-text {
  margin-top: 8px;
  font-size: 14px;
  color: #606266;
}

.failed-count {
  color: #f56c6c;
  margin-left: 8px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.2s;
}

.task-item.completed {
  border-color: #67c23a;
  background: #f0f9ff;
}

.task-item.failed {
  border-color: #f56c6c;
  background: #fef0f0;
}

.task-item.processing {
  border-color: #409eff;
  background: #ecf5ff;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  font-size: 18px;
}

.status-icon.success {
  color: #67c23a;
}

.status-icon.error {
  color: #f56c6c;
}

.status-icon.processing {
  color: #409eff;
}

.status-icon.pending {
  color: #909399;
}

.file-name {
  flex: 1;
  font-size: 14px;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.job-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.2s;
}

.job-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.job-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.job-actions {
  display: flex;
  gap: 4px;
}

.job-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}

.job-stats .failed {
  color: #f56c6c;
}

.job-stats .time {
  margin-left: auto;
  color: #909399;
}

.results-container {
  max-height: 70vh;
  overflow-y: auto;
}

.result-item {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e4e7ed;
}

.result-item:last-child {
  border-bottom: none;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-content {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.8;
}
</style>
