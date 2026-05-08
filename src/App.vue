<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="logo">
        <el-icon :size="28"><Shop /></el-icon>
        <div>
          <span>电商AI助手</span>
          <small>v{{ appVersion }}</small>
        </div>
      </div>

      <nav class="nav-menu">
        <router-link to="/" class="nav-item" :class="{ active: $route.name === 'chat' }">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI对话</span>
        </router-link>
        <router-link to="/product" class="nav-item" :class="{ active: $route.name === 'product' }">
          <el-icon><Goods /></el-icon>
          <span>选品分析</span>
        </router-link>
        <router-link to="/hotwords" class="nav-item" :class="{ active: $route.name === 'hotwords' }">
          <el-icon><TrendCharts /></el-icon>
          <span>热词分析</span>
        </router-link>
        <router-link to="/data" class="nav-item" :class="{ active: $route.name === 'data' }">
          <el-icon><DataLine /></el-icon>
          <span>带货分析</span>
        </router-link>
        <router-link to="/batch" class="nav-item" :class="{ active: $route.name === 'batch' }">
          <el-icon><FolderOpened /></el-icon>
          <span>批量分析</span>
        </router-link>
        <router-link to="/templates" class="nav-item" :class="{ active: $route.name === 'templates' }">
          <el-icon><Document /></el-icon>
          <span>模板管理</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <el-button text @click="toggleDarkMode()">
          <el-icon><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
          <span>{{ isDark ? '浅色模式' : '深色模式' }}</span>
        </el-button>
        <el-button text @click="showSettings = true">
          <el-icon><Setting /></el-icon>
          <span>设置与诊断</span>
        </el-button>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>

    <el-dialog v-model="showSettings" title="设置与诊断" width="720px">
      <el-tabs v-model="settingsTab">
        <el-tab-pane label="API设置" name="api">
          <el-form label-width="112px">
            <el-form-item label="当前模型">
              <el-select v-model="settingsStore.currentModel" style="width: 100%">
                <el-option label="MiniMax" value="minimax" />
                <el-option label="MiniMax Global" value="minimax_global" />
                <el-option label="Kimi / Moonshot" value="kimi" />
                <el-option label="Claude" value="claude" />
                <el-option label="硅基流动" value="siliconflow" />
                <el-option label="OpenAI" value="openai" />
                <el-option label="Ollama 本地" value="ollama" />
              </el-select>
            </el-form-item>

            <el-form-item label="模型名称">
              <el-input :model-value="settingsStore.effectiveModel" disabled />
            </el-form-item>

            <el-form-item label="API Key">
              <el-input
                v-model="settingsStore.apiKey"
                type="password"
                show-password
                placeholder="输入当前服务商的 API Key，本地 Ollama 可留空"
              />
            </el-form-item>

            <el-form-item label="API Endpoint">
              <el-input
                v-model="settingsStore.apiEndpoint"
                :placeholder="settingsStore.currentPreset.apiEndpoint"
              />
              <div class="form-help">留空时使用当前模型的默认 Endpoint。</div>
            </el-form-item>

            <el-form-item label="Temperature">
              <el-slider v-model="settingsStore.temperature" :min="temperatureMin" :max="1" :step="0.1" show-stops />
              <div class="form-help">MiniMax 要求 Temperature 大于 0，推荐 1.0；过低会自动按 0.1 发送。</div>
            </el-form-item>

            <el-form-item label="Max Tokens">
              <el-input-number v-model="settingsStore.maxTokens" :min="100" :max="maxTokensLimit" :step="100" />
              <div class="form-help">MiniMax OpenAI 兼容接口单次输出上限按 2048 处理。</div>
            </el-form-item>

            <el-form-item label="连接状态">
              <el-tag v-if="testStatus" :type="testStatusType">{{ testStatus }}</el-tag>
              <span v-else class="settings-tip">保存后可测试当前模型连接。</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="连接诊断" name="diagnostics">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="状态">
              <el-tag :type="diagnosticTagType">{{ diagnosticStatusText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="服务商">{{ llmDiagnostics.provider || '-' }}</el-descriptions-item>
            <el-descriptions-item label="模型">{{ llmDiagnostics.model || settingsStore.effectiveModel }}</el-descriptions-item>
            <el-descriptions-item label="Endpoint">{{ llmDiagnostics.endpoint || settingsStore.effectiveEndpoint }}</el-descriptions-item>
            <el-descriptions-item label="HTTP状态">{{ llmDiagnostics.httpStatus ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{ llmDiagnostics.latencyMs ? `${llmDiagnostics.latencyMs} ms` : '-' }}</el-descriptions-item>
            <el-descriptions-item label="最近错误">
              <pre class="diagnostic-text">{{ llmDiagnostics.lastError || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="响应摘要">
              <pre class="diagnostic-text">{{ llmDiagnostics.responsePreview || '-' }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="默认数据源" name="dataSources">
          <div class="source-toolbar">
            <div>
              <strong>数据源注册中心</strong>
              <p>当前默认启用内置参考库；公开网页和授权 API 连接器已预留，但不会在未授权时自动抓取。</p>
            </div>
            <el-button :loading="isRefreshingSources" @click="refreshSources">
              <el-icon><Refresh /></el-icon>
              刷新缓存
            </el-button>
          </div>

          <el-table :data="dataSources" size="small" height="300">
            <el-table-column prop="name" label="名称" min-width="180" />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ sourceKindText(row.kind) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="sourceStatusType(row.status)" size="small">
                  {{ sourceStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updateFrequency" label="更新频率" width="110" />
            <el-table-column prop="summary" label="说明" min-width="260" />
          </el-table>

          <div class="cache-info">
            本地缓存：{{ cacheText }}
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="resetSettings">重置</el-button>
        <el-button :loading="isTesting" @click="testConnection">测试连接</el-button>
        <el-button @click="showSettings = false">关闭</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from './stores/settings'
import { formatLlmError, llmDiagnostics, llmService } from './services/llm'
import { toggleDarkMode, useDarkMode } from './composables/useDarkMode'
import {
  DATA_SOURCE_REGISTRY,
  loadDataSourceCache,
  refreshDataSourceCache,
  type DataSourceKind,
  type DataSourceStatus
} from './services/dataSources'

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

const { isDark } = useDarkMode()
const settingsStore = useSettingsStore()
const showSettings = ref(false)
const settingsTab = ref('api')
const isTesting = ref(false)
const isRefreshingSources = ref(false)
const testStatus = ref('')
const testStatusType = ref<'success' | 'warning' | 'danger' | 'info'>('info')
const sourceCacheUpdatedAt = ref<number | null>(null)

const appVersion = __APP_VERSION__
const dataSources = DATA_SOURCE_REGISTRY

const diagnosticStatusText = computed(() => {
  const map = {
    idle: '未请求',
    running: '请求中',
    success: '正常',
    error: '异常'
  }
  return map[llmDiagnostics.status]
})

const diagnosticTagType = computed(() => {
  if (llmDiagnostics.status === 'success') return 'success'
  if (llmDiagnostics.status === 'error') return 'danger'
  if (llmDiagnostics.status === 'running') return 'warning'
  return 'info'
})

const cacheText = computed(() => {
  if (!sourceCacheUpdatedAt.value) return `未刷新，本次构建 ${__BUILD_TIME__}`
  return new Date(sourceCacheUpdatedAt.value).toLocaleString()
})

const isMiniMax = computed(() => settingsStore.currentModel === 'minimax' || settingsStore.currentModel === 'minimax_global')
const temperatureMin = computed(() => isMiniMax.value ? 0.1 : 0)
const maxTokensLimit = computed(() => isMiniMax.value ? 2048 : 8000)

onMounted(async () => {
  const cache = await loadDataSourceCache()
  sourceCacheUpdatedAt.value = cache?.updatedAt || null
})

const saveSettings = async () => {
  try {
    normalizeSettings()
    await settingsStore.saveConfig()
    showSettings.value = false
    ElMessage.success('设置已保存')
  } catch (error) {
    const err = error as Error
    ElMessage.error(err.message || '设置保存失败')
  }
}

const testConnection = async () => {
  isTesting.value = true
  testStatus.value = '测试中...'
  testStatusType.value = 'info'

  try {
    normalizeSettings()
    await settingsStore.saveConfig()
    const reply = await llmService.testConnection()
    testStatus.value = reply || '连接成功'
    testStatusType.value = 'success'
    settingsTab.value = 'diagnostics'
    ElMessage.success('模型连接正常')
  } catch (error) {
    testStatus.value = '连接失败'
    testStatusType.value = 'danger'
    settingsTab.value = 'diagnostics'
    ElMessage.error(formatLlmError(error))
  } finally {
    isTesting.value = false
  }
}

const normalizeSettings = () => {
  if (isMiniMax.value) {
    if (settingsStore.temperature < 0.1) {
      settingsStore.temperature = 0.1
    }
    if (settingsStore.maxTokens > 2048) {
      settingsStore.maxTokens = 2048
    }
  }
}

const resetSettings = async () => {
  try {
    await settingsStore.resetConfig()
    testStatus.value = ''
    ElMessage.success('设置已重置')
  } catch (error) {
    const err = error as Error
    ElMessage.error(err.message || '重置失败')
  }
}

const refreshSources = async () => {
  isRefreshingSources.value = true
  try {
    const snapshot = await refreshDataSourceCache()
    sourceCacheUpdatedAt.value = snapshot.updatedAt
    ElMessage.success('数据源缓存已刷新')
  } catch (error) {
    const err = error as Error
    ElMessage.error(err.message || '刷新数据源缓存失败')
  } finally {
    isRefreshingSources.value = false
  }
}

const sourceKindText = (kind: DataSourceKind) => {
  const map: Record<DataSourceKind, string> = {
    builtin: '内置',
    public_web: '公开网页',
    api: 'API',
    local_file: '本地文件'
  }
  return map[kind]
}

const sourceStatusText = (status: DataSourceStatus) => {
  const map: Record<DataSourceStatus, string> = {
    active: '已启用',
    planned: '规划中',
    needs_auth: '需授权'
  }
  return map[status]
}

const sourceStatusType = (status: DataSourceStatus) => {
  if (status === 'active') return 'success'
  if (status === 'needs_auth') return 'warning'
  return 'info'
}
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 220px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px 24px;
  color: #409eff;
  border-bottom: 1px solid #f0f0f0;
}

.logo span {
  display: block;
  font-size: 18px;
  font-weight: 700;
}

.logo small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.nav-menu {
  flex: 1;
  padding: 12px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 4px;
  border-radius: 8px;
  color: #606266;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #ecf5ff;
  color: #409eff;
}

.nav-item.active {
  background: #409eff;
  color: #fff;
}

.nav-item span {
  font-size: 15px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.sidebar-footer .el-button {
  width: 100%;
  justify-content: flex-start;
  gap: 8px;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-tip,
.form-help {
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}

.diagnostic-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
}

.source-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.source-toolbar p {
  margin-top: 6px;
  color: #606266;
  font-size: 13px;
}

.cache-info {
  margin-top: 12px;
  color: #909399;
  font-size: 13px;
}
</style>
