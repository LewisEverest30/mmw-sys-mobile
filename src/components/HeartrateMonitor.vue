<template>
  <div class="heart-rate-monitor">
    <div class="monitor-container">
      <div class="chart-header">
        <h3 class="section-title">心律失常监测</h3>
        <div class="status-text" :class="statusClass">
          {{ statusText }}
        </div>
      </div>
      <div ref="chartRef" class="chart-container"></div>
      <div class="chart-note">
        <span class="heart-status-icon" :class="heartStatusClass"></span>
        <span class="heart-status-text">{{ statusMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getWaveform } from '@/api/heart'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const tooltip = ref('这是心律')
const status = ref(1)
const chartRef = ref<HTMLElement | null>(null)
const intervalId = ref<number | null>(null)
const currentIndex = ref(0)
const nodeText = ref('常见的窦性心律失常')
const chartData = ref<number[]>([])
const isInBed = ref<boolean | null>(null)

let chart: ECharts | null = null

// 计算属性
const statusText = computed(() => {
  if (isInBed.value === false) {
    return '已离开'
  }
  if (status.value === -1) {
    return '脏数据'
  }
  return `心律状态：${status.value === 0 ? '正常' : '不正常'}`
})

const statusClass = computed(() => {
  if (isInBed.value === false) {
    return 'status-out-of-bed'
  }
  if (status.value === -1) {
    return 'status-dirty'
  }
  return status.value === 0 ? 'status-normal' : 'status-abnormal'
})

const statusMessage = computed(() => {
  if (!isInBed.value) {
    return '监测对象离开，无法检测。'
  }
  if (status.value === -1) {
    return '您的节律数据质量较差导致无法判断是否正常'
  }
  return status.value === 0
    ? '您处于窦性心律，请继续保持良好的生活习惯。'
    : '您可能发生了心律失常，可能是由于睡眠不足或营养不良。如果多次出现异常，请及时就医。'
})

const heartStatusClass = computed(() => {
  if (!isInBed.value) {
    return 'heart-status-out-of-bed'
  }
  if (status.value === -1) {
    return 'heart-status-dirty'
  }
  return status.value === 0 ? 'heart-status-normal' : 'heart-status-warning'
})

// 图表配置函数
const getChartOption = (data: number[]) => {
  return {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      show: true,
      position: 'bottom',
      type: 'category',
      data: Array.from({ length: 1000 + 1 }, (_, index) => index),
      axisLabel: {
        formatter: (value: number) => {
          if (value % 200 === 0) {
            return `${value / 200}s`
          }
          return ''
        },
        interval: 199
      },
      axisTick: {
        show: true,
        interval: (index: number) => {
          return index % 200 === 0 ? 1 : 0
        }
      },
      axisLine: {
        show: true
      }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: !isInBed.value ? [] : [{
      type: 'line',
      data: data,
      animationDuration: 5000,
      animationEasing: 'linear',
      lineStyle: {
        color: status.value === -1 ? '#808080' : (status.value === 0 ? '#4CAF50' : '#FF0000'),
        width: 2
      }
    }]
  }
}

// 更新图表数据
const updateChart = async () => {
  try {
    const res = await getWaveform(userId.value)
    if (res?.data) {
      const min = Math.min(...res.data.scg_waveform)
      chartData.value = res.data.scg_waveform.map(item => item - min)
      status.value = res.data.isArrhythmia
      isInBed.value = res.data.is_in_bed
      
      if (chart) {
        chart.clear()
        chart.setOption(getChartOption(chartData.value))
      }
    }
  } catch (error) {
    console.error('Error updating heart rate chart:', error)
  }
}

// 启动定时更新
const startUpdatingChart = () => {
  intervalId.value = window.setInterval(() => {
    updateChart()
  }, 5000)
}

// 生命周期钩子
onMounted(async () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
  }
  
  await updateChart()
  startUpdatingChart()
})

onBeforeUnmount(() => {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }
  
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
.heart-rate-monitor {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f4f8;
  font-family: 'Arial', sans-serif;
}

.monitor-container {
  width: 100%;
  height: 100%;
  background-color: #FFFFFF;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 10px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.chart-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 10px;
}

.time-info {
  text-align: left;
}

.date {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 2px;
}

.time {
  font-size: 14px;
  font-weight: bold;
}

.status-text {
  font-size: 14px;
  font-weight: bold;
  transition: color 0.3s ease;
}

.status-normal {
  color: #4CAF50;
}

.status-abnormal {
  color: #F44336;
}

.status-dirty {
  color: #808080;
}

.chart-container {
  width: 100%;
  height: calc(100% - 80px);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.chart-note {
  width: 100%;
  margin-top: 5px;
  padding: 5px;
  border-radius: 5px;
  background-color: #f8f9fa;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 5px;
}

.heart-status-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 5px;
}

.heart-status-normal {
  background-color: #4caf50;
}

.heart-status-warning {
  background-color: #f44336;
}

.heart-status-dirty {
  background-color: #808080;
}

.heart-status-text {
  font-size: 12px;
  font-weight: bold;
  color: #333;
}

.status-out-of-bed {
  color: #FFA500;
}

.heart-status-out-of-bed {
  background-color: #FFA500;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0 0 10px 0;
}
</style>