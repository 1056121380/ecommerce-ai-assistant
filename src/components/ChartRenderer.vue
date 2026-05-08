<template>
  <div ref="chartRef" :style="{ width: width, height: height }"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const props = withDefaults(defineProps<{
  option: EChartsOption
  width?: string
  height?: string
}>(), {
  width: '100%',
  height: '300px'
})

const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

onMounted(() => {
  if (chartRef.value) {
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(props.option)

    window.addEventListener('resize', handleResize)
  }
})

watch(() => props.option, (newOption) => {
  if (chartInstance) {
    chartInstance.setOption(newOption, true)
  }
}, { deep: true })

const handleResize = () => {
  chartInstance?.resize()
}

defineExpose({
  getInstance: () => chartInstance
})
</script>
