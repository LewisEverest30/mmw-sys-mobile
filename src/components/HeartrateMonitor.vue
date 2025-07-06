<template>
  <div class="root-container">
    <div class="monitor-container">
      <div class="chart-header">
        <h3 class="section-title">心率监测</h3>
        <div class="status-text" :class="statusClass">
          <span class="status-text-label">心跳次数: </span>{{ heartRateText }}
        </div>
      </div>
      <div ref="chartRef" class="chart-container"></div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getHrWaveform } from '@/api/heart'
import { convertTimestampToTimeHM } from '@/utils/timestamp'
import { calculateEchartsFontSize, calculateEchartsLineWidth } from '@/utils/echarts'
import { generateHeartRateMockData } from '@/utils/mocks/HeartrateMock'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const tooltip = ref('每秒心脏跳动的次数， 60-100为正常')
const heartRate = ref(1)
const chartRef = ref<HTMLElement | null>(null)
const chartData = ref<number[]>([])
const timeStamps = ref<number[]>([])
const intervalId = ref<number | null>(null)
const isInBed = ref<boolean | null>(null)

let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// 计算属性
const statusClass = computed(() => {
  return {
    'status-normal': heartRate.value <= 100 && heartRate.value >= 60,
    'status-abnormal': heartRate.value > 100 || heartRate.value < 60,
    'status-dirty': heartRate.value === -1 || heartRate.value === -2,
  }
})
const heartRateText = computed(() => {
  if (heartRate.value !== -1 && heartRate.value !== -2) {
    return `${heartRate.value} 次/分钟`
  }
  return '未检测到心跳'
})

// 更新图表数据
const updateChart = async () => {
  try {
    // const res = await getHrWaveform(userId.value)

    const res = generateHeartRateMockData() // 使用模拟数据函数代替实际API调用

    console.log('获取最新心率数据:', res)

    if (!res?.data) return

    const heartWaveformTmp = res.data.heart_waveform
    const timeStampTmp = res.data.time_stamp
    isInBed.value = res.data.is_in_bed
    
    // 如果离床，清空图表数据
    if (!isInBed.value) {
      chartData.value = []
      timeStamps.value = []
      chartData.value = []
      heartRate.value = -1
      if (chart) {
        chart.setOption(getChartOption([], []))
      }
      return
    }

    // 如果刚回到床上，重新初始化数据
    if (chartData.value.length === 0) {
      chartData.value = heartWaveformTmp
      timeStamps.value = timeStampTmp
      heartRate.value = heartWaveformTmp[heartWaveformTmp.length - 1]
      chart?.setOption(getChartOption(
        chartData.value.map(rate => rate === -1 || rate === -2 ? null : rate),
        timeStamps.value.map(point => convertTimestampToTimeHM(point))
      ))
      return
    }

    const latestHeartRate = heartWaveformTmp[heartWaveformTmp.length - 1]
    const latestTimestamp = timeStampTmp[timeStampTmp.length - 1]
    
    if (latestTimestamp > timeStamps.value[timeStamps.value.length - 1]) {
      chartData.value.shift()
      timeStamps.value.shift()
      chartData.value.push(latestHeartRate)
      timeStamps.value.push(latestTimestamp)
      heartRate.value = latestHeartRate
      
      if (chart) {
        chart.setOption(getChartOption(
          chartData.value.map(rate => rate === -1 || rate === -2 ? null : rate),
          timeStamps.value.map(point => convertTimestampToTimeHM(point))
        ))
      }
    }
  } catch (error) {
    console.error('Error fetching latest heart rate data:', error)
  }
}

// 获取图表选项
const getChartOption = (displayData: (number | null)[], xAxisData: string[]) => {
  const fontSize = calculateEchartsFontSize(chartRef.value, 0.9) // 获取字体大小
  const lineWidth = calculateEchartsLineWidth(chartRef.value, 0.8) // 获取线宽
  const mainLineColor = 'rgb(255,68,68)'

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textStyle: { color: '#fff' },
      borderColor: 'rgba(255,255,255,0.2)'
    },
    xAxis: {
      show: true,
      position: 'bottom',
      type: 'category',
      data: xAxisData,
      axisLabel: {
        show: true,
        interval: Math.floor(xAxisData.length / 5),
        textStyle: {
          color: '#666',
          fontSize: fontSize
        }
      },
      axisTick: {
        alignWithLabel: true,
        length: lineWidth*2
      },
      axisLine: {
        lineStyle: {
          color: '#666',
          width: lineWidth*0.5
        }
      },
    },
    yAxis: {
      type: 'value',
      name: 'Bpm',
      min: 0,
      show: true,
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e0e0e0',
          type: 'solid',
          width: lineWidth*0.5,
        }
      },
      axisLine: {
        lineStyle: {
          color: '#666',
          width: lineWidth*0.5
        }
      },
    },
    series: [
      {
        name: 'Heart Rate',
        type: 'line',
        showSymbol: false,
        data: displayData,
        animationDuration: 5000,
        animationEasing: 'linear',
        lineStyle: {
          color: mainLineColor,
          width: lineWidth,
          shadowBlur: Math.max(3, lineWidth * 0.8),
          shadowColor: mainLineColor + '40',
          shadowOffsetX: Math.max(1, lineWidth * 0.1),
          shadowOffsetY: Math.max(1, lineWidth * 0.1),        
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: 'rgb(255, 105, 180)'
            },
            {
              offset: 1,
              color: 'rgb(255, 240, 245)'
            }
          ])
        },
        itemStyle: {
          color: 'rgb(255, 105, 180)'
        }
      }
    ]
  }
}

// 启动定时更新
const startUpdatingChart = () => {
  intervalId.value = window.setInterval(() => {
    updateChart()
  }, 5000)
}

// 调整图表大小
const resizeChart = () => {
  if (chart) {
    chart.resize()
  }
}

// 生命周期钩子
onMounted(async () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
  }
  // await updateChart()
  updateChart() // 使用模拟数据

  startUpdatingChart()
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeChart()
    })
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
  
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }

  if (resizeObserver && chartRef.value) {
    resizeObserver.unobserve(chartRef.value)
    resizeObserver = null
  }
})
</script>

<style scoped>
/* 根容器：居中 + 灰底 */
.root-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f4f8;
  font-family: 'Arial', sans-serif;
}

/* 白色内容卡片 */
.monitor-container {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 0.625em;
  box-shadow: 0 0.125em 0.25em rgba(0, 0, 0, 0.1);
  padding: 0.625em;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

/* 标题区：左边时间信息 + 右边状态 */
.chart-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 1% 2%;
}
.section-title {
  font-size: 1.5em;
  color: #2c3e50;
  letter-spacing: 0.03em;
  margin-bottom: 0;
  margin-top: 1%;
  padding-left: 1%;
}
.status-text {
  font-size: 1em;
  font-weight: bold;
  transition: color 0.3s ease;
  background-color: #f8f9fa;
  padding: 1%;
  margin-right: 1vw;
  border-radius: 0.3125em;
  border: #a3a3a3 0.0625em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}
.status-text-label {
  color: #2c3e50c4;
  margin-right: 0.1em;
}
.status-normal {
  color: #2ecc71;
}
.status-abnormal {
  color: #e74c3c;
}
.status-dirty {
  color: #808080;
}

/* 图表区域 */
.chart-container {
  width: 100%;
  height: calc(100% - 1vh);
  border-radius: 1.2em;
  overflow: hidden;
  box-shadow: 
    0 0.25em 0.5em rgba(0, 0, 0, 0.1),
    inset 0 0.0625em 0.125em rgba(255, 255, 255, 0.1)
    ;
  transition: all 0.3s ease;
  font-size: 1em;
}
</style>