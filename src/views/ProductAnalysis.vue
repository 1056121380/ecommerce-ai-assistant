<template>
  <div class="analysis-view">
    <div class="page-header">
      <h2>📦 选品分析</h2>
      <p class="sub">导入商品数据，AI帮你分析市场潜力和选品策略</p>
    </div>

    <div class="content-grid">
      <!-- 数据输入区 -->
      <div class="card data-input">
        <div class="section-title">
          <el-icon><Upload /></el-icon>
          数据导入
        </div>

        <!-- 模板选择 -->
        <el-form label-width="80px" style="margin-bottom: 16px">
          <el-form-item label="分析模板">
            <el-select v-model="selectedTemplateId" placeholder="选择分析模板" style="width: 100%">
              <el-option
                v-for="template in availableTemplates"
                :key="template.id"
                :label="template.name"
                :value="template.id"
              >
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <span>{{ template.name }}</span>
                  <el-tag v-if="template.isBuiltIn" size="small" type="info">内置</el-tag>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <el-tabs v-model="dataMode">
          <el-tab-pane label="粘贴数据" name="paste">
            <el-input
              v-model="rawData"
              type="textarea"
              :rows="10"
              placeholder="粘贴商品数据，支持CSV格式或纯文本

示例格式：
商品名称,销量,价格,评价数
防晒衣,5000,89,1200
运动鞋,3200,199,850
..."
            />
          </el-tab-pane>
          <el-tab-pane label="上传文件" name="upload">
            <el-upload
              drag
              accept=".csv,.txt,.json,.xlsx,.xls"
              :auto-upload="false"
              :show-file-list="false"
              @change="handleFileChange"
            >
              <el-icon><UploadFilled /></el-icon>
              <div>将CSV/TXT/JSON/Excel文件拖到此处，或<em>点击上传</em></div>
            </el-upload>
          </el-tab-pane>
        </el-tabs>

        <!-- 数据预览 -->
        <div v-if="parsedData.headers.length" class="data-preview">
          <div class="section-title">
            数据预览
            <el-tag v-if="cleaningStats" size="small" type="success" style="margin-left: 8px">
              已清洗
            </el-tag>
          </div>
          <div v-if="cleaningStats" class="cleaning-info">
            <el-alert type="info" :closable="false" style="margin-bottom: 12px">
              <template #title>
                <span style="font-size: 13px">
                  原始 {{ cleaningStats.originalRows }} 行 → 清洗后 {{ cleaningStats.cleanedRows }} 行
                  <span v-if="cleaningStats.duplicatesRemoved > 0">（去重 {{ cleaningStats.duplicatesRemoved }} 行）</span>
                </span>
              </template>
            </el-alert>
          </div>
          <el-table :data="parsedData.rows.slice(0, 5)" style="font-size: 12px">
            <el-table-column v-for="(h, i) in parsedData.headers" :key="i" :prop="i.toString()" :label="h" min-width="100" />
          </el-table>
          <p v-if="parsedData.rows.length > 5" class="preview-tip">
            共 {{ parsedData.rows.length }} 条数据，显示前5条
          </p>
        </div>

        <div class="action-bar">
          <el-button type="primary" size="large" :loading="isAnalyzing" :disabled="!rawData.trim()" @click="startAnalysis">
            <el-icon><DataAnalysis /></el-icon>
            开始分析
          </el-button>
        </div>
      </div>

      <!-- 分析结果区 -->
      <div class="card result-area">
        <div class="section-title">
          <el-icon><Document /></el-icon>
          分析结果
        </div>

        <div v-if="!analysisResult" class="empty-result">
          <el-icon :size="48" color="#dcdfe6"><ChatLineSquare /></el-icon>
          <p>暂无分析结果</p>
          <p class="sub">请先导入数据并点击"开始分析"</p>
        </div>

        <div v-else class="result-content">
          <div class="result-meta">
            <el-tag type="success">分析完成</el-tag>
            <el-tag type="info">{{ parsedData.rows.length }} 条数据</el-tag>
            <span class="time">{{ new Date().toLocaleString() }}</span>
          </div>

          <!-- 统计面板 -->
          <StatsPanel v-if="analysisStats.length" :stats="analysisStats" />

          <!-- 图表可视化 -->
          <div v-if="chartData" class="chart-section">
            <div class="section-title">
              <el-icon><TrendCharts /></el-icon>
              数据可视化
            </div>
            <ChartRenderer :option="chartData" height="300px" />
          </div>

          <!-- 分析结果 -->
          <div class="result-box">
            <MarkdownRenderer :content="analysisResult" />
          </div>

          <div class="result-actions">
            <el-button @click="copyResult">
              <el-icon><CopyDocument /></el-icon> 复制结果
            </el-button>
            <el-button @click="exportResult">
              <el-icon><Download /></el-icon> 导出结果
            </el-button>
            <el-button type="primary" @click="showReportDialog = true">
              <el-icon><Document /></el-icon> 生成报告
            </el-button>
            <el-button @click="saveToHistory">
              <el-icon><Collection /></el-icon> 保存记录
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div class="card history-area">
      <div class="section-title">
        <el-icon><Clock /></el-icon>
        分析历史
        <div style="margin-left: auto; display: flex; gap: 12px; align-items: center;">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索历史记录..."
            clearable
            style="width: 200px"
            size="small"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button
            v-if="analysisStore.results.filter(r => r.type === 'product').length > 0"
            size="small"
            :disabled="selectedForCompare.length < 2"
            @click="showCompare = true"
          >
            <el-icon><DataAnalysis /></el-icon>
            对比分析 ({{ selectedForCompare.length }})
          </el-button>
        </div>
      </div>
      <el-empty v-if="!filteredHistory.length" :description="searchKeyword ? '未找到匹配的记录' : '暂无历史记录'" />
      <div v-else class="history-list">
        <el-card v-for="item in filteredHistory" :key="item.id" class="history-item">
          <div class="history-header">
            <el-checkbox
              :model-value="selectedForCompare.includes(item.id)"
              @change="toggleCompareSelection(item.id)"
            />
            <strong>{{ item.title }}</strong>
            <el-button text type="danger" @click="analysisStore.deleteResult(item.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div class="history-content">{{ item.content.slice(0, 100) }}...</div>
          <div class="history-time">{{ new Date(item.createdAt).toLocaleString() }}</div>
        </el-card>
      </div>
    </div>

    <CompareDialog
      v-model="showCompare"
      v-model:selected-ids="selectedForCompare"
      :results="analysisStore.results"
    />

    <ReportGenerator
      v-model="showReportDialog"
      title="选品分析报告"
      type="product"
      :content="analysisResult"
      :stats="analysisStats"
      :chart-option="chartData || undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { DataAnalysis, TrendCharts, Histogram, PieChart } from '@element-plus/icons-vue'
import { useAnalysisStore } from '@/stores/analysis'
import { useTemplateStore } from '@/stores/templates'
import { analysisService } from '@/services/analyzer'
import { formatLlmError, LLMService } from '@/services/llm'
import { exportTextFile } from '@/services/storage'
import { readDataFile } from '@/services/fileImport'
import { cleanCSVData, validateDataQuality } from '@/utils/dataProcessing'
import { parseDataForChart, createBarChart } from '@/utils/charts'
import CompareDialog from '@/components/CompareDialog.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import StatsPanel, { type StatItem } from '@/components/StatsPanel.vue'
import ChartRenderer from '@/components/ChartRenderer.vue'
import ReportGenerator from '@/components/ReportGenerator.vue'

const analysisStore = useAnalysisStore()
const templateStore = useTemplateStore()
const dataMode = ref('paste')
const rawData = ref('')
const isAnalyzing = ref(false)
const analysisResult = ref('')
const showCompare = ref(false)
const selectedForCompare = ref<string[]>([])
const searchKeyword = ref('')
const cleaningStats = ref<any>(null)
const selectedTemplateId = ref<string>('')
const showReportDialog = ref(false)

const availableTemplates = computed(() => templateStore.getTemplatesByType('product'))

onMounted(async () => {
  await templateStore.loadTemplates()
  // 默认选择第一个模板
  if (availableTemplates.value.length > 0) {
    selectedTemplateId.value = availableTemplates.value[0].id
  }
})

const filteredHistory = computed(() => {
  const results = analysisStore.results.filter(r => r.type === 'product')
  if (!searchKeyword.value.trim()) return results

  const keyword = searchKeyword.value.toLowerCase()
  return results.filter(item =>
    item.title.toLowerCase().includes(keyword) ||
    item.content.toLowerCase().includes(keyword)
  )
})

const analysisStats = computed<StatItem[]>(() => {
  if (!analysisResult.value) return []

  const stats: StatItem[] = []
  const dataRows = parsedData.value.rows.length
  const dataColumns = parsedData.value.headers.length

  // 数据行数
  stats.push({
    label: '数据行数',
    value: dataRows,
    icon: DataAnalysis,
    color: '#409eff'
  })

  // 数据列数
  stats.push({
    label: '数据维度',
    value: dataColumns,
    icon: Histogram,
    color: '#67c23a'
  })

  // 数据质量
  if (cleaningStats.value) {
    const quality = cleaningStats.value.duplicatesRemoved === 0 &&
                   cleaningStats.value.invalidRowsRemoved === 0 ? '优秀' : '良好'
    stats.push({
      label: '数据质量',
      value: quality,
      icon: TrendCharts,
      color: '#e6a23c'
    })
  }

  // 分析时间
  stats.push({
    label: '分析完成',
    value: new Date().toLocaleTimeString(),
    icon: PieChart,
    color: '#909399'
  })

  return stats
})

const chartData = computed(() => {
  if (!analysisResult.value) return null
  const data = parseDataForChart(analysisResult.value)
  return data ? createBarChart(data) : null
})

const toggleCompareSelection = (id: string) => {
  const index = selectedForCompare.value.indexOf(id)
  if (index > -1) {
    selectedForCompare.value.splice(index, 1)
  } else {
    selectedForCompare.value.push(id)
  }
}

const parsedData = computed(() => {
  if (!rawData.value.trim()) return { headers: [], rows: [] }
  try {
    return analysisService.parseData(rawData.value)
  } catch {
    return { headers: ['原始内容'], rows: [[rawData.value.slice(0, 200)]] }
  }
})

const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  const text = await readDataFile(file)
  rawData.value = text

  // 自动清洗数据
  if (text.includes(',') || text.includes('\t')) {
    const result = cleanCSVData(text)
    if (result.warnings.length > 0) {
      rawData.value = result.cleaned
      cleaningStats.value = result.stats
      ElMessage.success({
        message: `文件加载成功，已自动清洗数据`,
        duration: 3000
      })
      if (result.warnings.length > 0) {
        ElMessage.info({
          message: result.warnings.join('；'),
          duration: 5000
        })
      }
    } else {
      ElMessage.success('文件加载成功')
    }
  } else {
    ElMessage.success('文件加载成功')
  }
}

const startAnalysis = async () => {
  // 数据质量检查
  const quality = validateDataQuality(rawData.value)
  if (!quality.isValid) {
    ElMessage.warning(`数据质量较差：${quality.issues.join('；')}`)
    return
  }

  if (quality.quality === 'low') {
    ElMessage.warning({
      message: `数据质量较低，建议检查后重试：${quality.issues.join('；')}`,
      duration: 5000
    })
  }

  const validation = analysisService.validateData('product', rawData.value)
  if (!validation.valid) {
    ElMessage.warning(validation.error)
    return
  }

  isAnalyzing.value = true
  analysisResult.value = ''

  try {
    // 使用选中的模板或默认 Prompt
    let promptTemplate = LLMService.PRODUCT_ANALYSIS_PROMPT

    if (selectedTemplateId.value) {
      const template = templateStore.getTemplate(selectedTemplateId.value)
      if (template) {
        promptTemplate = templateStore.applyTemplate(selectedTemplateId.value, {
          data: rawData.value
        })
      }
    }

    analysisResult.value = await analysisService.analyze({
      type: 'product',
      title: '选品分析',
      promptTemplate,
      userData: rawData.value
    })
  } catch (error: unknown) {
    ElMessage.error(formatLlmError(error))
  } finally {
    isAnalyzing.value = false
  }
}

const copyResult = async () => {
  await navigator.clipboard.writeText(analysisResult.value)
  ElMessage.success('已复制到剪贴板')
}

const exportResult = () => {
  exportTextFile(`选品分析_${Date.now()}.md`, analysisResult.value)
  ElMessage.success('分析结果已导出')
}

const saveToHistory = () => {
  analysisStore.addResult('product', '选品分析', analysisResult.value, rawData.value)
  ElMessage.success('已保存到历史记录')
}
</script>

<style scoped>
.analysis-view {
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

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.data-input, .result-area {
  min-height: 450px;
  display: flex;
  flex-direction: column;
}

.data-preview {
  margin-top: 16px;
  flex: 1;
}

.preview-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.action-bar {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.action-bar .el-button {
  flex: 1;
}

.empty-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 12px;
}

.empty-result .sub {
  font-size: 13px;
  color: #c0c4cc;
}

.result-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.result-meta .time {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.result-box {
  flex: 1;
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
  max-height: 350px;
  font-size: 13px;
  line-height: 1.8;
}

.chart-section {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.chart-section .section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.result-box pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  margin: 0;
}

.result-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

.history-area {
  margin-top: 20px;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.history-item {
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  transform: translateY(-2px);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.history-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.history-time {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
