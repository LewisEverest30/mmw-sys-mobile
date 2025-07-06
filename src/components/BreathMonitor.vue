<template>
  <div class="root-container">
    <div class="monitor-container">
      
      <!-- 状态区 -->
      <div class="chart-header">
        <h3 class="section-title">呼吸监测</h3>
        <div class="status-section">
          <!-- 呼吸暂停状态 -->
          <div class="status-item" v-if="isInBed && breathWarningId === 21">
              <img src="/breath_imgs/breath_hold.svg" alt="呼吸暂停" class="status-icon status-active" />
              <h3 class="status-text-active">呼吸暂停</h3>
              <div class="info-icon" @mouseover="showApneaInfo = true" @mouseleave="showApneaInfo = false">i</div>
              <div v-if="showApneaInfo" class="tooltip">
                夜间呼吸暂停是一种睡眠时呼吸暂时停止的现象，可能导致缺氧和睡眠质量下降，需及时关注和治疗。
              </div>
          </div>

          <!-- 通气阻塞状态 -->
          <div class="status-item" v-if="isInBed && breathWarningId === 22">
              <img src="/breath_imgs/lung.svg" alt="通气阻塞" class="status-icon status-active" />
              <h3 class="status-text-active">通气阻塞</h3>
              <div class="info-icon" @mouseover="showObstructionInfo = true" @mouseleave="showObstructionInfo = false">i</div>
              <div v-if="showObstructionInfo" class="tooltip">
                夜间通气阻塞是指睡眠时上呼吸道部分或完全堵塞，导致呼吸暂停或气流受限，影响正常呼吸和睡眠质量。
              </div>
          </div>

          <!-- 正常状态 -->
          <div class="status-item" v-if="isInBed && breathWarningId === 0">
              <h3 class="status-text-normal">呼吸正常</h3>
          </div>

          <!-- 离床状态 -->
          <div class="status-item" v-if="!isInBed">
            <img src="/breath_imgs/lung.svg" alt="通气阻塞" class="status-icon status-active" />
            <h3 class="status-text-out-of-bed">已离床</h3>
          </div>
        </div>
      </div>

      <!-- 图表区 -->
      <div class="charts-section">
        <div class="waveform-container">
          <div class="chart-container">
            <div class="sub-chart-title-container">
              <h3 class="sub-chart-title">呼吸波形</h3>
            </div>
            <div ref="waveformChartRef" class="chart-content" />
          </div>
        </div>

        <div class="ring-container">
          <div class="chart-container">
            <div class="sub-chart-title-container">
              <h3 class="sub-chart-title">呼吸流速-容量环</h3>
              <div class="info-icon" @mouseover="showRingInfo = true" @mouseleave="showRingInfo = false">i</div>
              <div v-if="showRingInfo" class="tooltip">
                自主呼吸的流速容量环是测量呼吸功能的图，显示气流速度和容量关系，包括呼气和吸气两部分。
              </div>
            </div>
            <div ref="ringChartRef" class="chart-content" />
          </div>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="chart-note">
        <span class="breath-status-icon" :class="breathStatusClass"></span>
        <span class="breath-status-text">{{ breathStatusMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getBWaveform, getBRingform, getWarning } from '@/api/breath'
import { calculateEchartsFontSize, calculateEchartsLineWidth } from '@/utils/echarts'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const waveformChartRef = ref<HTMLElement | null>(null)
const ringChartRef = ref<HTMLElement | null>(null)
const waveformData = ref<number[]>([])
const ringData = ref<{ breath_ring_x: number[], breath_ring_y: number[] }>({
  breath_ring_x: [],
  breath_ring_y: []
})
const showRingInfo = ref(false)
const showApneaInfo = ref(false)
const showObstructionInfo = ref(false)
const breathWarningId = ref(0)
const isInBed = ref(true)
const intervalId = ref<number | null>(null)

// 计算呼吸状态消息
const breathStatusMessage = computed(() => {
  if (!isInBed.value) {
    return '监测对象离开，无法检测。'
  }
  if (breathWarningId.value === 21) {
    return '检测到呼吸暂停异常，请注意！'
  }
  if (breathWarningId.value === 22) {
    return '检测到通气阻塞异常，请注意！'
  }
  return '呼吸状态正常'
})

// 计算呼吸状态图标样式
const breathStatusClass = computed(() => {
  if (!isInBed.value) {
    return 'breath-status-out-of-bed'
  }
  if (breathWarningId.value === 21 || breathWarningId.value === 22) {
    return 'breath-status-warning'
  }
  return 'breath-status-normal'
})

let waveformChart: ECharts | null = null
let ringChart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// 呼吸波形图表配置函数
const getWaveformChartOption = (displayData: number[], xAxisData: string[]) => {
  const fontSize = calculateEchartsFontSize(waveformChartRef.value, 0.8)
  const lineWidth = calculateEchartsLineWidth(waveformChartRef.value, 1)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        animation: false
      },
      backgroundColor: 'rgba(0,0,0,0.7)',
      textStyle: { 
        color: '#fff',
        fontSize: fontSize
      },
      borderColor: 'rgba(255,255,255,0.2)'
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      name: '时间(s)',
      nameLocation: 'center',
      nameGap: 30,
      nameTextStyle: {
        color: '#333',
        fontSize: fontSize * 0.9
      },
      data: xAxisData,
      splitLine: {
        show: false
      },
      axisLabel: {
        show: true,
        formatter: (value: string, index: number) => {
          if (index % 100 === 0) { // samplingRate
            return `${(index / 100).toFixed(0)}s`
          }
          return ''
        },
        interval: 99, // samplingRate - 1
        textStyle: {
          color: '#666',
          fontSize: fontSize
        }
      },
      axisTick: {
        show: true,
        interval: (index: number) => index % 100 === 0, // samplingRate
        alignWithLabel: true,
        length: lineWidth * 2
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#666',
          width: lineWidth * 0.5
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '归一化幅度',
      nameLocation: 'middle',
      nameGap: 50,
      nameRotate: 90,
      nameTextStyle: {
        color: '#333',
        fontSize: fontSize * 0.9,
        fontWeight: 'normal',
        align: 'center'
      },
      show: true,
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e0e0e0',
          type: 'solid',
          width: lineWidth * 0.5
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#666',
          width: lineWidth * 0.5
        }
      },
      axisTick: {
        show: true,
        length: lineWidth * 2
      },
      axisLabel: {
        textStyle: {
          color: '#666',
          fontSize: fontSize
        }
      },
      ...(isInBed.value && breathWarningId.value === 21 ? {
        min: -1,
        max: 1
      } : {})
    },
    series: !isInBed.value ? [] : [{
      name: '呼吸波形',
      type: 'line',
      data: displayData,
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      lineStyle: {
        color: '#3B82F6',
        width: lineWidth,
        shadowBlur: Math.max(3, lineWidth * 0.8),
        shadowColor: '#3B82F6' + '40',
        shadowOffsetX: Math.max(1, lineWidth * 0.1),
        shadowOffsetY: Math.max(1, lineWidth * 0.1)
      },
      itemStyle: {
        color: '#3B82F6'
      },
      animation: true,
      animationDuration: 10000,
      animationEasing: 'linear',
    }]
  }
}

// 呼吸容量环图表配置函数
const getRingChartOption = (seriesData: [number, number][], shouldShowData: boolean) => {
  const fontSize = calculateEchartsFontSize(ringChartRef.value, 0.8)
  const lineWidth = calculateEchartsLineWidth(ringChartRef.value, 1)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        animation: false
      },
      backgroundColor: 'rgba(0,0,0,0.7)',
      textStyle: { 
        color: '#fff',
        fontSize: fontSize
      },
      borderColor: 'rgba(255,255,255,0.2)'
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '流量',
      nameLocation: 'center',
      nameGap: 30,
      nameTextStyle: {
        color: '#666',
        fontSize: fontSize * 0.9
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e0e0e0',
          type: 'solid',
          width: lineWidth * 0.5
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#666',
          width: lineWidth * 0.5
        }
      },
      axisTick: {
        show: true,
        length: lineWidth * 2
      },
      axisLabel: {
        textStyle: {
          color: '#666',
          fontSize: fontSize
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '流速',
      nameLocation: 'middle',
      nameGap: 50,
      nameRotate: 90,
      nameTextStyle: {
        color: '#666',
        fontSize: fontSize * 0.9,
        fontWeight: 'normal',
        align: 'center'
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#e0e0e0',
          type: 'solid',
          width: lineWidth * 0.5
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: '#666',
          width: lineWidth * 0.5
        }
      },
      axisTick: {
        show: true,
        length: lineWidth * 2
      },
      axisLabel: {
        textStyle: {
          color: '#666',
          fontSize: fontSize
        }
      }
    },
    series: shouldShowData ? [{
      name: '呼吸环',
      type: 'line',
      data: seriesData,
      smooth: true,
      symbol: 'none',
      showSymbol: false,
      lineStyle: {
        color: '#F59E0B',
        width: lineWidth,
        shadowBlur: Math.max(3, lineWidth * 0.8),
        shadowColor: '#F59E0B' + '40',
        shadowOffsetX: Math.max(1, lineWidth * 0.1),
        shadowOffsetY: Math.max(1, lineWidth * 0.1)
      },
      itemStyle: {
        color: '#F59E0B'
      },
      animation: true,
      animationDuration: 10000,
      animationEasing: 'linear',
    }] : []
  }
}

// 更新呼吸波形图表数据
const updateWaveform = async () => {
  try {
    const res = await getBWaveform(userId.value)
    if (res?.data) {
      if ('is_in_bed' in res.data) {
        isInBed.value = res.data.is_in_bed
      }
      waveformData.value = res.data.breath_waveform
      
      // 计算显示数据
      const samplingRate = 100
      const displaySeconds = 10
      const totalPoints = samplingRate * displaySeconds
      let displayData: number[]
      if (!isInBed.value) {
        displayData = new Array(totalPoints).fill(0)
      } else if (isInBed.value && breathWarningId.value === 21) {
        displayData = new Array(totalPoints).fill(0.5)
      } else {
        displayData = waveformData.value.length > 0 ? waveformData.value.slice(-totalPoints) : new Array(totalPoints).fill(0)
      }
      const xAxisData = Array.from(
        { length: totalPoints },
        (_, index) => (index / samplingRate).toFixed(2)
      )

      if (waveformChart) {
        waveformChart.clear()
        waveformChart.setOption(getWaveformChartOption(displayData, xAxisData))
      }
    }
  } catch (error) {
    console.error('Error updating waveform chart:', error)
  }
}

// 更新呼吸环图表数据
const updateRing = async () => {
  try {
    const res = await getBRingform(userId.value)
    if (res?.data) {
      ringData.value = {
        breath_ring_x: res.data.breath_ring_x || [],
        breath_ring_y: res.data.breath_ring_y || []
      }
      
      const shouldShowData = isInBed.value && breathWarningId.value !== 21
      const seriesData = ringData.value.breath_ring_x.map((x, i) => [x, ringData.value.breath_ring_y[i]] as [number, number])
      
      if (ringChart) {
        ringChart.clear()
        ringChart.setOption(getRingChartOption(seriesData, shouldShowData))
      }
    }
  } catch (error) {
    console.error('Error updating ring chart:', error)
  }
}

// 更新警告状态
const updateWarning = async () => {
  try {
    const warningRes = await getWarning(userId.value)
    if (warningRes.data) {
      breathWarningId.value = warningRes.data.breath_warning_id
      breathWarningId.value = 22
    }
  } catch (error) {
    console.error('Error updating warning:', error)
  }
}

// 更新所有数据
const updateCharts = async () => {
  try {
    await updateWarning()
    await Promise.all([
      updateWaveform(),
      updateRing()
    ])
  } catch (error) {
    console.error('Error updating charts:', error)
  }
}

// 启动定时更新
const startUpdatingCharts = () => {
  intervalId.value = window.setInterval(() => {
    updateCharts()
  }, 10000)
}

// 调整图表大小
const resizeCharts = () => {
  if (waveformChart) {
    waveformChart.resize()
  }
  if (ringChart) {
    ringChart.resize()
  }
}

// 生命周期钩子
onMounted(async () => {
  if (waveformChartRef.value) {
    waveformChart = echarts.init(waveformChartRef.value)
  }
  
  if (ringChartRef.value) {
    ringChart = echarts.init(ringChartRef.value)
  }
  
  await updateCharts()
  startUpdatingCharts()
  
  if (waveformChartRef.value && ringChartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeCharts()
    })
    resizeObserver.observe(waveformChartRef.value)
    resizeObserver.observe(ringChartRef.value)
  }
})

onBeforeUnmount(() => {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }
  
  if (waveformChart) {
    waveformChart.dispose()
    waveformChart = null
  }
  if (ringChart) {
    ringChart.dispose()
    ringChart = null
  }
  
  if (resizeObserver && waveformChartRef.value && ringChartRef.value) {
    resizeObserver.unobserve(waveformChartRef.value)
    resizeObserver.unobserve(ringChartRef.value)
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
}

/* 标题区 */
.chart-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 1% 2%;
  flex-shrink: 0;
}

.section-title {
  font-size: 1.5em;
  color: #2c3e50;
  letter-spacing: 0.03em;
  margin-bottom: 0;
  margin-top: 1%;
  padding-left: 1%;
}

/* 状态区域样式 */
.status-section {
  font-size: 1em;
  font-weight: bold;
  transition: color 0.3s ease;
  background-color: #f8f9fa;
  padding: 1%;
  margin-right: 1.5vw;
  border-radius: 0.3125em;
  border: #a3a3a3 0.0625em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  max-width: fit-content;
  white-space: nowrap;
}

.status-item {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  /* 确保内容紧凑排列 */
  gap: 0.5em;
  flex-shrink: 0;
}

/* 状态文字样式 */
.status-text-active {
  color: #EF4444;
  font-weight: bold;
  font-size: 16px;
  margin: 0;
}

.status-text-normal {
  color: #10B981;
  font-weight: bold;
  font-size: 16px;
  margin: 0;
}

.status-text-out-of-bed {
  color: #F59E0B;
  font-weight: bold;
  font-size: 16px;
  margin: 0;
}

/* 状态图标样式 */
.status-icon {
  width: 28px;
  height: 28px;
  transition: transform 0.3s ease;
  margin-right: 0.5em; /* 减少右边距 */
  flex-shrink: 0; /* 防止图标被压缩 */
}

.status-icon.status-active {
  filter: brightness(0) saturate(100%) invert(18%) sepia(98%) saturate(7040%) hue-rotate(358deg) brightness(100%) contrast(106%);
  animation: pulse 2s infinite;
}

.status-icon.status-normal {
  filter: brightness(0) saturate(100%) invert(48%) sepia(87%) saturate(3151%) hue-rotate(130deg) brightness(93%) contrast(80%);
}

.status-icon.status-out-of-bed {
  filter: brightness(0) saturate(100%) invert(60%) sepia(98%) saturate(1352%) hue-rotate(21deg) brightness(96%) contrast(101%);
}

/* 图表区域 */
.charts-section {
  display: flex;
  gap: 1em;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 1vh;
  padding-top: 1vh;
  font-size: 1em;
}

.waveform-container {
  flex: 2;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ring-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
}

.chart-title {
  font-size: 1.1em;
  color: #2c3e50;
  letter-spacing: 0.03em;
  margin: 0;
  padding-left: 1%;
  flex-shrink: 0;
}

.chart-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  margin: 0.5em 0 0.5em 0.5em;
  flex-shrink: 0;
}

.sub-chart-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  /* padding: 12px 16px 8px 16px; */
  flex-shrink: 0;
  background: rgba(248, 249, 250, 0.8);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.chart-container {
  width: 100%;
  flex: 1;
  min-height: 200px;
  border-radius: 1.2em;
  overflow: hidden;
  box-shadow: 
    0 0.25em 0.5em rgba(0, 0, 0, 0.1),
    inset 0 0.0625em 0.125em rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  background: #fff;
  position: relative;
}

.chart-content {
  width: 100%;
  flex: 1;
  min-height: 0;
  position: relative;
}

.sub-chart-title {
  font-size: 0.9em;
  color: #2c3e508e;
  letter-spacing: 0.03em;
  margin: 0;
  padding: 12px 16px 8px 16px;
  flex-shrink: 0;
  background: rgba(248, 249, 250, 0.8);
  font-weight: 600;
}

.chart-content {
  width: 100%;
  flex: 1;
  min-height: 0;
}

/* 信息图标样式 */
.info-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

/* 状态区域内的信息图标需要左边距 */
.status-item .info-icon {
  margin-left: 0.5em; /* 减少左边距 */
}

.info-icon:hover {
  background-color: #0056b3;
}

.tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  z-index: 1000;
  max-width: 220px;
  white-space: normal;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  margin-top: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid rgba(0, 0, 0, 0.9);
}

/* 图表下方提示条 */
.chart-note {
  width: 100%;
  margin-top: 0.3125em;
  padding: 0.3125em;
  border-radius: 0.3125em;
  background-color: #f8f9fa;
  font-size: 0.75em;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: left;
  gap: 0.3125em;
}

/* 小圆点图标 */
.breath-status-icon {
  width: 0.5em;
  height: 0.5em;
  border-radius: 50%;
  margin-right: 0.3125em;
}

.breath-status-normal {
  background-color: #4CAF50;
}

.breath-status-warning {
  background-color: #F44336;
}

.breath-status-out-of-bed {
  background-color: #FFA500;
}

/* 小圆点右边的文字 */
.breath-status-text {
  font-size: 1em;
  font-weight: bold;
  color: #333;
  padding: 0.3125em 0.625em;
  margin-left: 0.3125em;
  text-align: center;
}

/* 动画效果 */
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .charts-section {
    /* flex-direction: column; */
    gap: 1vw;
  }
  
  .waveform-container,
  .ring-container {
    flex: 1;
    /* min-height: 250px; */
  }
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5em;
  }
  
  .section-title {
    font-size: 1.3em;
  }
  
  .status-section {
    font-size: 0.9em;
    margin-right: 0;
  }
  
  .status-text-active,
  .status-text-normal,
  .status-text-out-of-bed {
    font-size: 14px;
  }
  
  .status-icon {
    width: 24px;
    height: 24px;
  }
  
  .chart-title,
  .sub-chart-title {
    font-size: 1em;
  }
  
  .charts-section {
    flex-direction: column;
    gap: 0.5em;
  }
  
  .waveform-container,
  .ring-container {
    flex: 1;
    min-height: 220px;
  }
  
  .chart-note {
    font-size: 0.7em;
  }
  
  .breath-status-text {
    font-size: 0.9em;
    padding: 0.25em 0.5em;
  }
}

@media (max-width: 480px) {
  .monitor-container {
    padding: 0.5em;
  }
  
  .section-title {
    font-size: 1.2em;
  }
  
  .status-section {
    font-size: 0.8em;
    padding: 0.5%;
  }
  
  .chart-title,
  .sub-chart-title {
    font-size: 0.9em;
  }
  
  .info-icon {
    width: 16px;
    height: 16px;
    font-size: 10px;
  }
  
  .waveform-container,
  .ring-container {
    min-height: 180px;
  }
}
</style>