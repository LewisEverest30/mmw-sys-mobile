<template>
  <div class="heart-rate-monitor">
    <div class="tab-content">
      <div class="chart-section">
        <div class="chart-header">
          <h3 class="section-title">心率监测</h3>
          <div class="heart-rate-info">
            <template v-if="heartRate !== -1 && heartRate !== -2">
              心跳次数: 
              <span class="heart-rate-value" :style="statusTextStyle">{{ heartRate }}</span>次/分钟
            </template>
            <template v-else>
              <span class="heart-rate-value" :style="statusTextStyle">未检测到心跳</span>
            </template>
          </div>
        </div>
        <div ref="chartRef" class="chart-container" />
        <div class="chart-note">
          <i class="el-icon-star-off"></i>: {{ noteText }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getHrWaveform } from '@/api/heart'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const tooltip = ref('每秒心脏跳动的次数， 60-100为正常')
const heartRate = ref(1)
const chartRef = ref<HTMLElement | null>(null)
const heartRateData = ref<number[]>([])
const timeStamps = ref<number[]>([])
const chartData = ref<Array<{name: string, value: [string, number]}>>([])
const intervalId = ref<number | null>(null)
const noteText = ref('心率简要')
const isInBed = ref<boolean | null>(null)

let chart: ECharts | null = null

// 计算属性
const statusTextStyle = computed(() => {
  return {
    color: heartRate.value < 100 && heartRate.value > 60 ? '#2ecc71' : '#e74c3c',
    fontSize: '20px',
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif'
  }
})

// 数据转换工具函数
const convertTimestampToDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}

const convertTimestampToTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// 处理数据
const processData = () => {
  chartData.value = heartRateData.value.map((rate, index) => ({
    name: convertTimestampToTime(timeStamps.value[index]),
    value: [convertTimestampToTime(timeStamps.value[index]), rate]
  }))
}

// 初始化数据
const initData = async () => {
  try {
    const res = await getHrWaveform(userId.value)
    if (res?.data) {
      heartRateData.value = res.data.heart_waveform
      timeStamps.value = res.data.time_stamp
      heartRate.value = heartRateData.value[heartRateData.value.length - 1]
      isInBed.value = res.data.is_in_bed
      processData()
    }
  } catch (error) {
    console.error('Error initializing heart rate data:', error)
  }
}

// 更新图表数据
const updateChartData = async () => {
  try {
    const res = await getHrWaveform(userId.value)
    if (!res?.data) return

    const heartWaveformTmp = res.data.heart_waveform
    const timeStampTmp = res.data.time_stamp
    isInBed.value = res.data.is_in_bed
    
    // 如果离床，清空图表数据
    if (!isInBed.value) {
      heartRateData.value = []
      timeStamps.value = []
      chartData.value = []
      heartRate.value = -1
      if (chart) {
        chart.setOption({
          series: [{ data: [] }],
          xAxis: { data: [] }
        })
      }
      return
    }

    // 如果刚回到床上，重新初始化数据
    if (heartRateData.value.length === 0) {
      heartRateData.value = heartWaveformTmp
      timeStamps.value = timeStampTmp
      heartRate.value = heartWaveformTmp[heartWaveformTmp.length - 1]
      processData()
      setChartOptions()
      return
    }

    const latestHeartRate = heartWaveformTmp[heartWaveformTmp.length - 1]
    const latestTimestamp = timeStampTmp[timeStampTmp.length - 1]
    
    if (latestTimestamp > timeStamps.value[timeStamps.value.length - 1]) {
      heartRateData.value.shift()
      timeStamps.value.shift()
      heartRateData.value.push(latestHeartRate)
      timeStamps.value.push(latestTimestamp)
      
      chartData.value.shift()
      chartData.value.push({
        name: convertTimestampToTime(latestTimestamp),
        value: [convertTimestampToTime(latestTimestamp), latestHeartRate]
      })
      
      heartRate.value = latestHeartRate
      processData()
      
      if (chart) {
        chart.setOption({
          series: [
            {
              data: chartData.value.map(point => ({
                name: point.name,
                value: point.value[1] === -1 || point.value[1] === -2 ? null : point.value
              })),
              type: 'line'
            }
          ],
          xAxis: {
            data: chartData.value.map(point => point.value[0])
          }
        })
      }
    }
  } catch (error) {
    console.error('Error fetching latest heart rate data:', error)
  }
}

// 设置图表选项
const setChartOptions = () => {
  if (!chart) return
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        animation: false
      }
    },
    xAxis: {
      type: 'category',
      data: chartData.value.map(point => point.value[0]),
      splitLine: {
        show: false
      },
      axisLabel: {
        show: true,
        interval: Math.floor(chartData.value.length / 5),
        textStyle: {
          color: '#333',
          fontSize: 10
        }
      },
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 150,
      interval: 30,
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e0e0e0',
          type: 'solid'
        }
      },
      axisLabel: {
        formatter: function(value: number) {
          if (value % 30 === 0) {
            return value
          }
          return ''
        }
      }
    },
    series: [
      {
        name: 'Heart Rate',
        type: 'line',
        showSymbol: false,
        data: chartData.value.map(point => ({
          name: point.name,
          value: point.value[1] === -1 || point.value[1] === -2 ? null : point.value
        })),
        animationDuration: 5000,
        animationEasing: 'linear',
        lineStyle: {
          color: 'rgb(255,68,68)'
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
        }
      }
    ]
  }
  
  chart.setOption(option)
}

// 启动定时更新
const startUpdating = () => {
  intervalId.value = window.setInterval(() => {
    updateChartData()
  }, 5000)
}

// 生命周期钩子
onMounted(async () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
  }
  
  await initData()
  setChartOptions()
  startUpdating()
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

.tab-content {
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

.chart-section {
  width: 100%;
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  padding: 0 5px;
}

.heart-rate-info {
  font-size: 12px;
  color: #333;
}

.heart-rate-value {
  font-size: 16px;
  font-weight: bold;
  color: #ff6b6b;
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
  margin-top: 5px;
  padding: 5px;
  border-radius: 5px;
  background-color: #f8f9fa;
  font-size: 12px;
  color: #666;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0 0 10px 0;
}
</style>