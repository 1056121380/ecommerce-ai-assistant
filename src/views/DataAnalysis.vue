<template>
  <div class="analysis-view">
    <div class="page-header">
      <h2>📊 带货数据分析</h2>
      <p class="sub">导入带货数据，AI帮你分析直播效果和优化方向</p>
    </div>

    <div class="content-grid">
      <!-- 数据输入 -->
      <div class="card data-input">
        <div class="section-title">
          <el-icon><Upload /></el-icon>
          数据导入
        </div>

        <el-form label-width="100px">
          <el-form-item label="数据类型">
            <el-radio-group v-model="dataType">
              <el-radio label="live">直播数据</el-radio>
              <el-radio label="product">商品销售</el-radio>
              <el-radio label="competitor">竞品数据</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <el-tabs v-model="dataMode">
          <el-tab-pane label="粘贴数据" name="paste">
            <el-input
              v-model="rawData"
              type="textarea"
              :rows="10"
              placeholder="粘贴带货数据，支持CSV格式

直播数据示例：
场次,GMV,在线峰值,观看人数,转化率,客单价
1,50000,1200,50000,3.2%,89
2,72000,1500,65000,4.1%,95
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
          <el-button size="small" @click="loadSampleData('live')">直播数据</el-button>
          <el-button size="small" @click="loadSampleData('product')">商品销售</el-button>
        </div>

        <div class="action-bar">
          <el-button v-if="isAnalyzing" type="danger" size="large" @click="cancelAnalysis">
            <el-icon><Close /></el-icon>
            停止
          </el-button>
          <el-button v-else type="primary" size="large" :disabled="!rawData.trim()" @click="startAnalysis">
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
            <el-tag v-if="isAnalyzing" type="warning">分析中...</el-tag>
            <el-tag v-else type="success">分析完成</el-tag>
            <el-tag type="info">{{ dataTypeLabels[dataType] }}</el-tag>
          </div>
          <div class="result-box">
            <pre>{{ isAnalyzing ? streamResult || '正在分析...' : analysisResult }}</pre>
          </div>
          <div class="result-actions">
            <el-button :disabled="!analysisResult" @click="copyResult">
              <el-icon><CopyDocument /></el-icon> 复制结果
            </el-button>
            <el-button :disabled="!analysisResult" @click="exportResult">
              <el-icon><Download /></el-icon> 导出结果
            </el-button>
            <el-button :disabled="!analysisResult" @click="saveToHistory">
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
      <el-empty v-if="!analysisStore.results.filter(r => r.type === 'data').length" description="暂无历史记录" />
      <div v-else class="history-list">
        <el-card v-for="item in analysisStore.results.filter(r => r.type === 'data')" :key="item.id" class="history-item" @click="loadFromHistory(item)">
          <div class="history-header">
            <strong>{{ item.title }}</strong>
            <el-button text type="danger" @click.stop="analysisStore.deleteResult(item.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div class="history-content">{{ item.content.slice(0, 200) }}{{ item.content.length > 200 ? '...' : '' }}</div>
          <div class="history-time">{{ new Date(item.createdAt).toLocaleString() }}</div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAnalysisStore } from '@/stores/analysis'
import { analysisService } from '@/services/analyzer'
import { formatLlmError, LLMService } from '@/services/llm'
import { exportTextFile } from '@/services/storage'
import { readDataFile } from '@/services/fileImport'

const analysisStore = useAnalysisStore()
const dataMode = ref('paste')
const dataType = ref('live')
const rawData = ref('')
const isAnalyzing = ref(false)
const analysisResult = ref('')
const streamResult = ref('')

const dataTypeLabels: Record<string, string> = {
  live: '直播数据',
  product: '商品销售',
  competitor: '竞品数据'
}

const sampleData = {
  live: `场次,GMV,在线峰值,观看人数,转化率,客单价
1,50000,1200,50000,3.2%,89
2,72000,1500,65000,4.1%,95
3,45000,1000,42000,2.8%,86
4,68000,1400,58000,3.8%,92
5,82000,1800,72000,4.5%,98`,
  product: `商品,曝光,点击,加购,付款,客单价
防晒衣A,50000,2500,800,400,89
运动鞋B,45000,2200,650,320,199
露营套装C,38000,1800,550,280,299
空调被D,35000,1600,480,250,129`
}

const handleFileChange: any = async (uploadFile: any) => {
  const file = uploadFile.raw
  if (!file) return
  const text = await readDataFile(file)
  rawData.value = text
  ElMessage.success('文件加载成功')
}

const loadSampleData = (type: string) => {
  rawData.value = sampleData[type as keyof typeof sampleData]
  dataType.value = type
  ElMessage.success('示例数据已加载')
}

const cancelAnalysis = () => {
  llmService.abort()
}

const startAnalysis = async () => {
  const validation = analysisService.validateData('data', rawData.value)
  if (!validation.valid) {
    ElMessage.warning(validation.error)
    return
  }

  isAnalyzing.value = true
  analysisResult.value = ''
  streamResult.value = ''

  try {
    const dataTypeInfo = `数据类型：${dataTypeLabels[dataType.value]}`
    analysisResult.value = await analysisService.analyze({
      type: 'data',
      title: '带货分析',
      promptTemplate: LLMService.DATA_ANALYSIS_PROMPT,
      userData: `${dataTypeInfo}\n\n${rawData.value}`,
      onChunk: (chunk) => {
        streamResult.value = (streamResult.value + chunk).slice(-2000)
      }
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
  exportTextFile(`带货数据分析_${Date.now()}.md`, analysisResult.value)
  ElMessage.success('分析结果已导出')
}

const saveToHistory = () => {
  analysisStore.addResult('data', '带货数据分析', analysisResult.value, rawData.value)
  ElMessage.success('已保存到历史记录')
}

const loadFromHistory = (item: { content: string; rawData: string }) => {
  analysisResult.value = item.content
  rawData.value = item.rawData
  ElMessage.success('已加载历史记录')
}
</script>

<style scoped>
.analysis-view {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  background: var(--main-bg);
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 22px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.page-header .sub {
  color: var(--text-muted);
  font-size: 14px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: background-color 0.3s, box-shadow 0.3s;
}

.dark .card {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.data-input, .result-area {
  min-height: 450px;
  display: flex;
  flex-direction: column;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-templates {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.quick-templates .label {
  font-size: 14px;
  color: var(--text-muted);
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
  color: var(--text-muted);
  gap: 12px;
}

.empty-result .sub {
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.7;
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
  background: var(--main-bg);
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
  max-height: 350px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
  transition: background-color 0.3s;
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
  transition: all 0.2s ease;
  background: var(--card-bg);
}

.history-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.dark .history-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.history-time {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 深色模式适配 */
.dark .el-form-item__label {
  color: var(--text-primary);
}

.dark .el-tabs__item {
  color: var(--text-secondary);
}

.dark .el-tabs__item.is-active {
  color: var(--el-color-primary);
}

.dark .el-upload-dragger {
  background: var(--input-bg);
  border-color: var(--sidebar-border);
}

.dark .el-upload-dragger:hover {
  border-color: var(--el-color-primary);
}

.dark .el-upload-dragger .el-icon {
  color: var(--text-muted);
}
</style>
