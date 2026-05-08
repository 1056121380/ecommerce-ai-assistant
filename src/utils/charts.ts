import type { EChartsOption } from 'echarts'

export interface ChartData {
  labels: string[]
  values: number[]
  title?: string
}

export function createBarChart(data: ChartData): EChartsOption {
  return {
    title: {
      text: data.title || '柱状图',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    xAxis: {
      type: 'category',
      data: data.labels,
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: data.values,
      type: 'bar',
      itemStyle: {
        color: '#409eff'
      }
    }]
  }
}

export function createPieChart(data: ChartData): EChartsOption {
  const pieData = data.labels.map((label, index) => ({
    name: label,
    value: data.values[index]
  }))

  return {
    title: {
      text: data.title || '饼图',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [{
      name: '数据',
      type: 'pie',
      radius: '50%',
      data: pieData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }
}

export function createLineChart(data: ChartData): EChartsOption {
  return {
    title: {
      text: data.title || '趋势图',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: data.labels,
      boundaryGap: false
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: data.values,
      type: 'line',
      smooth: true,
      itemStyle: {
        color: '#409eff'
      },
      areaStyle: {
        color: 'rgba(64, 158, 255, 0.2)'
      }
    }]
  }
}

export function parseDataForChart(text: string): ChartData | null {
  const lines = text.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) return null

  const labels: string[] = []
  const values: number[] = []

  for (const line of lines) {
    const parts = line.split(/[,，\t|]/).map(p => p.trim())
    if (parts.length >= 2) {
      labels.push(parts[0])
      const value = parseFloat(parts[1])
      if (!isNaN(value)) {
        values.push(value)
      }
    }
  }

  if (labels.length === 0 || values.length === 0) return null

  return { labels, values }
}
