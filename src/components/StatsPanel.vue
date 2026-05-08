<template>
  <div class="stats-panel">
    <div v-for="stat in stats" :key="stat.label" class="stat-item">
      <div class="stat-icon" :style="{ backgroundColor: stat.color + '20', color: stat.color }">
        <el-icon :size="20">
          <component :is="stat.icon" />
        </el-icon>
      </div>
      <div class="stat-content">
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value">{{ stat.value }}</div>
        <div v-if="stat.trend" class="stat-trend" :class="stat.trend.type">
          <el-icon :size="12">
            <component :is="stat.trend.type === 'up' ? 'Top' : 'Bottom'" />
          </el-icon>
          {{ stat.trend.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DataAnalysis, TrendCharts, Histogram, PieChart } from '@element-plus/icons-vue'

export interface StatItem {
  label: string
  value: string | number
  icon: any
  color: string
  trend?: {
    type: 'up' | 'down'
    value: string
  }
}

defineProps<{
  stats: StatItem[]
}>()
</script>

<style scoped>
.stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition: all 0.3s;
}

.stat-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  margin-top: 4px;
  padding: 2px 6px;
  border-radius: 4px;
}

.stat-trend.up {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.stat-trend.down {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

/* 深色模式 */
.dark .stat-item {
  background: var(--el-bg-color-overlay);
}

.dark .stat-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
</style>
