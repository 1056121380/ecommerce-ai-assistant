<template>
  <el-dialog
    v-model="visible"
    title="生成分析报告"
    width="500px"
    @close="handleClose"
  >
    <el-form label-width="100px">
      <el-form-item label="报告格式">
        <el-radio-group v-model="format">
          <el-radio label="pdf">PDF 格式</el-radio>
          <el-radio label="docx">Word 格式</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="报告内容">
        <el-checkbox v-model="includeStats">包含统计数据</el-checkbox>
        <el-checkbox v-model="includeChart">包含数据图表</el-checkbox>
      </el-form-item>

      <el-form-item label="文件名">
        <el-input v-model="fileName" placeholder="留空自动生成" />
      </el-form-item>
    </el-form>

    <!-- 隐藏的图表容器用于导出 -->
    <div v-if="chartOption" style="position: absolute; left: -9999px; width: 800px; height: 500px">
      <div id="report-chart" ref="chartRef" style="width: 100%; height: 100%"></div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="isGenerating" @click="handleGenerate">
        <el-icon><Download /></el-icon>
        生成报告
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { generateReport, type ReportData, type ReportOptions } from '@/utils/reportGenerator'

interface Props {
  modelValue: boolean
  title: string
  type: 'product' | 'hotwords' | 'data'
  content: string
  stats?: Array<{ label: string; value: string | number }>
  chartOption?: EChartsOption
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = ref(false)
const format = ref<'pdf' | 'docx'>('pdf')
const includeStats = ref(true)
const includeChart = ref(true)
const fileName = ref('')
const isGenerating = ref(false)
const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.chartOption) {
    nextTick(() => {
      initChart()
    })
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
  if (!val && chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

const initChart = () => {
  if (!chartRef.value || !props.chartOption) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption(props.chartOption)
}

const handleGenerate = async () => {
  isGenerating.value = true

  try {
    const reportData: ReportData = {
      title: props.title,
      type: props.type,
      timestamp: new Date().toLocaleString('zh-CN'),
      stats: props.stats || [],
      content: props.content,
      chartOption: includeChart.value ? props.chartOption : undefined
    }

    const options: ReportOptions = {
      format: format.value,
      includeChart: includeChart.value && !!props.chartOption,
      includeStats: includeStats.value && (props.stats?.length || 0) > 0,
      fileName: fileName.value || undefined
    }

    await generateReport(reportData, options)
    ElMessage.success(`${format.value.toUpperCase()} 报告已生成`)
    visible.value = false
  } catch (error) {
    console.error('报告生成失败:', error)
    ElMessage.error('报告生成失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

const handleClose = () => {
  format.value = 'pdf'
  includeStats.value = true
  includeChart.value = true
  fileName.value = ''
}
</script>

<style scoped>
.el-checkbox {
  display: block;
  margin-bottom: 8px;
}
</style>
