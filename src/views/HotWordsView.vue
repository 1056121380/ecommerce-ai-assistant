<template>
  <div class="analysis-view">
    <div class="page-header">
      <h2>🔥 热词分析</h2>
      <p class="sub">导入热词数据，AI帮你分析趋势和内容创作方向</p>
    </div>

    <div class="content-grid">
      <!-- 数据输入 -->
      <div class="card data-input">
        <div class="section-title">
          <el-icon><Upload /></el-icon>
          数据导入
        </div>

        <el-form label-width="80px">
          <el-form-item label="来源平台">
            <el-checkbox-group v-model="selectedPlatforms">
              <el-checkbox label="douyin">抖音</el-checkbox>
              <el-checkbox label="xiaohongshu">小红书</el-checkbox>
              <el-checkbox label="taobao">淘宝</el-checkbox>
              <el-checkbox label="weibo">微博</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>

        <el-tabs v-model="dataMode">
          <el-tab-pane label="粘贴数据" name="paste">
            <el-input
              v-model="rawData"
              type="textarea"
              :rows="10"
              placeholder="粘贴热词数据，每行一个，格式：热词|热度|趋势（可选）

示例格式：
防晒衣,98000,上升
露营装备,85000,平稳
618大促,72000,下降
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

        <div class="quick-templates">
          <span class="label">快速示例：</span>
          <el-button size="small" @click="loadSampleData">加载示例数据</el-button>
        </div>

        <div class="action-bar">
          <el-button type="primary" size="large" :loading="isAnalyzing" :disabled="!rawData.trim()" @click="startAnalysis">
            <el-icon><DataAnalysis /></el-icon>
            开始分析
          </el-button>
        </div>
      </div>

      <!-- 分析结果 -->
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
            <el-tag type="info">{{ selectedPlatforms.map(p => platformLabels[p] || p).join('/') || '全平台' }}</el-tag>
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
      </div>
      <el-empty v-if="!analysisStore.results.filter(r => r.type === 'hotwords').length" description="暂无历史记录" />
      <div v-else class="history-list">
        <el-card v-for="item in analysisStore.results.filter(r => r.type === 'hotwords')" :key="item.id" class="history-item">
          <div class="history-header">
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

    <ReportGenerator
      v-model="showReportDialog"
      title="热词分析报告"
      type="hotwords"
      :content="analysisResult"
      :stats="analysisStats"
      :chart-option="chartData || undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { DataAnalysis, TrendCharts, Histogram, PieChart } from '@element-plus/icons-vue'
import { useAnalysisStore } from '@/stores/analysis'
import { analysisService } from '@/services/analyzer'
import { formatLlmError, LLMService } from '@/services/llm'
import { exportTextFile } from '@/services/storage'
import { readDataFile } from '@/services/fileImport'
import { parseDataForChart, createBarChart } from '@/utils/charts'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import StatsPanel, { type StatItem } from '@/components/StatsPanel.vue'
import ChartRenderer from '@/components/ChartRenderer.vue'
import ReportGenerator from '@/components/ReportGenerator.vue'

const analysisStore = useAnalysisStore()
const dataMode = ref('paste')
const rawData = ref('')
const selectedPlatforms = ref<string[]>(['douyin', 'xiaohongshu'])
const isAnalyzing = ref(false)
const analysisResult = ref('')
const showReportDialog = ref(false)

const platformLabels: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  taobao: '淘宝',
  weibo: '微博'
}

const sampleData = `防晒衣,98000,上升
露营装备,85000,上升
618大促预热,72000,上升
父亲节礼物,65000,平稳
空调被,58000,上升
小龙虾,52000,下降
夏季凉鞋,48000,平稳
驱蚊产品,45000,上升
墨镜,42000,平稳
便携风扇,38000,上升`

const parsedData = computed(() => {
  if (!rawData.value.trim()) return { rows: [] }
  try {
    const parsed = analysisService.parseData(rawData.value)
    return { rows: parsed.rows }
  } catch {
    return { rows: [] }
  }
})

const analysisStats = computed<StatItem[]>(() => {
  if (!analysisResult.value) return []

  const stats: StatItem[] = []
  const dataRows = parsedData.value.rows.length

  // 热词数量
  stats.push({
    label: '热词数量',
    value: dataRows,
    icon: DataAnalysis,
    color: '#409eff'
  })

  // 平台数量
  stats.push({
    label: '分析平台',
    value: selectedPlatforms.value.length || '全部',
    icon: Histogram,
    color: '#67c23a'
  })

  // 趋势统计
  const upTrend = rawData.value.split('\n').filter(line => line.includes('上升')).length
  if (upTrend > 0) {
    stats.push({
      label: '上升趋势',
      value: upTrend,
      icon: TrendCharts,
      color: '#e6a23c',
      trend: {
        type: 'up',
        value: `${((upTrend / dataRows) * 100).toFixed(0)}%`
      }
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

const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  const text = await readDataFile(file)
  rawData.value = text
  ElMessage.success('文件加载成功')
}

const loadSampleData = () => {
  rawData.value = sampleData
  ElMessage.success('示例数据已加载')
}

const startAnalysis = async () => {
  const validation = analysisService.validateData('hotwords', rawData.value)
  if (!validation.valid) {
    ElMessage.warning(validation.error)
    return
  }

  isAnalyzing.value = true
  analysisResult.value = ''

  try {
    const platformInfo = `数据来源平台：${selectedPlatforms.value.join('、') || '未指定'}`
    analysisResult.value = await analysisService.analyze({
      type: 'hotwords',
      title: '热词分析',
      promptTemplate: LLMService.HOTWORDS_ANALYSIS_PROMPT,
      userData: `${platformInfo}\n\n${rawData.value}`
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
  exportTextFile(`热词分析_${Date.now()}.md`, analysisResult.value)
  ElMessage.success('分析结果已导出')
}

const saveToHistory = () => {
  analysisStore.addResult('hotwords', '热词分析', analysisResult.value, rawData.value)
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

.quick-templates {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.quick-templates .label {
  font-size: 14px;
  color: #909399;
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
  gap: 8px;
  margin-bottom: 12px;
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

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
