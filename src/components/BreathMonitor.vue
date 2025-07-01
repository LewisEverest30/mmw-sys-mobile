<template>
  <div class="dashboard">
    <div class="container">
      <div class="charts-section">
        <div class="chart-container waveform-container">
          <div class="chart-header">
            <h3 class="section-title">呼吸波形</h3>
          </div>
          <div ref="waveformChartRef" class="chart" />
        </div>

        <div class="chart-container ring-container">
          <div class="chart-header">
            <h3 class="section-title">呼吸流速-容量环</h3>
            <div class="info-icon" @mouseover="showRingInfo = true" @mouseleave="showRingInfo = false">i</div>
            <div v-if="showRingInfo" class="tooltip">
              自主呼吸的流速容量环其实就是一张用来测量和分析呼吸功能的图，它显示了人在呼吸时，肺里的气流速度和空气量之间的关系。图上有两部分，一部分是呼气（把气呼出来），另一部分是吸气（把气吸进去）。
            </div>
          </div>
          <div ref="ringChartRef" class="chart ring-chart" />
        </div>
      </div>

      <div class="status-section">
        <h3 class="section-title">健康状态</h3>
        <div class="status-item">
          <div class="status-item-item">
            <div class="status-header">
              <img src="/breath_imgs/breath_hold.svg" alt="呼吸暂停" class="status-icon" />
              <h3>呼吸暂停</h3>
              <div class="info-icon" @mouseover="showApneaInfo = true" @mouseleave="showApneaInfo = false">i</div>
              <div v-if="showApneaInfo" class="tooltip">
                夜间呼吸暂停是一种睡眠时呼吸暂时停止的现象，可能导致缺氧和睡眠质量下降，需及时关注和治疗。
              </div>
            </div>
            <div class="status-content">
              <div class="status-light"
                   :class="{'status-red': isInBed && breathWarningId === 21 }"></div>
            </div>
          </div>

          <div class="status-item-item">
            <div class="status-header">
              <img src="/breath_imgs/lung.svg" alt="通气阻塞" class="status-icon" style="filter: brightness(0)" />
              <h3>通气阻塞</h3>
              <div class="info-icon" @mouseover="showObstructionInfo = true" @mouseleave="showObstructionInfo = false">i</div>
              <div v-if="showObstructionInfo" class="tooltip">
                夜间通气阻塞是指睡眠时上呼吸道部分或完全堵塞，导致呼吸暂停或气流受限，影响正常呼吸和睡眠质量。
              </div>
            </div>
            <div class="status-content">
              <div class="status-light"
                   :class="{'status-red': isInBed && breathWarningId === 22 }"></div>
            </div>
          </div>

          <div class="status-item-item">
            <div class="status-header">
              <h3>正常</h3>
            </div>
            <div class="status-content">
              <div class="status-light"
                   :class="{ 'status-green': isInBed && breathWarningId === 0 }"></div>
            </div>
          </div>
        </div>
        <div class="note-description">
          ps: 当出现呼吸暂停/通气阻塞时，对应的指示灯变红
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getBWaveform, getBRingform, getWarning } from '@/api/breath'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const waveformChartRef = ref<HTMLElement | null>(null)
const ringChartRef = ref<HTMLElement | null>(null)
const waveformData = ref<number[]>([])
const ringData = reactive({
  breath_ring_x: [] as number[],
  breath_ring_y: [] as number[]
})
const showRingInfo = ref(false)
const showApneaInfo = ref(false)
const showObstructionInfo = ref(false)
const breathWarningId = ref(0)
const isInBed = ref(true)
const intervalId = ref<number | null>(null)

let waveformChart: ECharts | null = null
let ringChart: ECharts | null = null

// 图表配置函数
const getWaveformChartOption = (data: number[]) => {
  const samplingRate = 100
  const displaySeconds = 10
  const totalPoints = samplingRate * displaySeconds
  
  // 当发生呼吸暂停或用户离床时，生成0.5直线数据
  let displayData: number[];
  if (!isInBed.value) {
    displayData = []
  } else if (isInBed.value && breathWarningId.value === 21) {
    displayData = new Array(totalPoints).fill(0.5)
  } else {
    displayData = data.slice(-totalPoints)
  }
  
  const xAxisData = Array.from(
    { length: totalPoints },
    (_, index) => (index / samplingRate).toFixed(2)
  )

  return {
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%'
    },
    xAxis: {
      type: 'category',
      name: '时间(s)',
      nameLocation: 'center',
      nameGap: 20,
      axisLine: { show: true },
      axisTick: {
        show: true,
        interval: (index: number) => index % samplingRate === 0
      },
      axisLabel: {
        formatter: (value: string, index: number) => {
          if (index % samplingRate === 0) {
            return `${(index / samplingRate).toFixed(0)}s`
          }
          return ''
        },
        interval: samplingRate - 1
      },
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      name: '归一化幅度',
      nameLocation: 'center',
      nameGap: 20,
      axisLine: { show: true },
      axisTick: { show: true },
      ...(isInBed.value && breathWarningId.value === 21 ? {
        min: -1,
        max: 1
      } : {})
    },
    series: [{
      type: 'line',
      showSymbol: false,
      data: displayData,
      lineStyle: {
        color: '#3B82F6',
        width: 2
      },
      smooth: true,
      animation: true,
      animationDuration: 10000,
      animationEasing: 'linear'
    }]
  }
}

const getRingChartOption = (data: { breath_ring_x: number[], breath_ring_y: number[] }) => {
  const shouldShowData = isInBed.value && breathWarningId.value !== 21
  return {
    grid: {
      left: '5%',
      right: '5%',
      bottom: '10%'
    },
    xAxis: {
      type: 'value',
      name: '流量',
      nameLocation: 'center',
      nameGap: 20,
      axisLine: { show: true },
      axisTick: { show: true }
    },
    yAxis: {
      type: 'value',
      name: '流速',
      nameLocation: 'center',
      nameGap: 20,
      axisLine: { show: true },
      axisTick: { show: true }
    },
    series: shouldShowData ? [{
      type: 'line',
      data: data.breath_ring_x.map((x, i) => [x, data.breath_ring_y[i]]),
      lineStyle: {
        color: '#F59E0B',
        width: 2
      },
      showSymbol: false,
      smooth: true,
    }] : []
  }
}

// 数据更新函数
const updateAll = async () => {
  try {
    const warningRes = await getWarning(userId.value)
    if (warningRes.data) {
      breathWarningId.value = warningRes.data.breath_warning_id
      isInBed.value = warningRes.data.is_in_bed
    }

    await Promise.all([
      updateWaveform(),
      updateRing()
    ])
  } catch (error) {
    console.error('Error updating data:', error)
  }
}

const updateWaveform = async () => {
  try {
    const res = await getBWaveform(userId.value)
    if (res?.data) {
      // 更新是否在床状态
      if ('is_in_bed' in res.data) {
        isInBed.value = res.data.is_in_bed
      }
      waveformData.value = res.data.breath_waveform
      
      if (waveformChart) {
        waveformChart.clear()
        waveformChart.setOption(getWaveformChartOption(waveformData.value))
      }
    }
  } catch (error) {
    console.error('Error fetching waveform data:', error)
  }
}

const updateRing = async () => {
  try {
    const res = await getBRingform(userId.value)
    if (res?.data) {
      ringData.breath_ring_x = res.data.breath_ring_x || []
      ringData.breath_ring_y = res.data.breath_ring_y || []
      
      if (ringChart) {
        ringChart.clear()
        ringChart.setOption(getRingChartOption(ringData))
      }
    }
  } catch (error) {
    console.error('Error fetching ring data:', error)
  }
}

const startUpdatingCharts = () => {
  intervalId.value = window.setInterval(() => {
    updateAll()
  }, 10000)
}

// 生命周期钩子
onMounted(() => {
  // 初始化图表
  if (waveformChartRef.value) {
    waveformChart = echarts.init(waveformChartRef.value)
  }
  if (ringChartRef.value) {
    ringChart = echarts.init(ringChartRef.value)
  }
  
  updateAll()
  startUpdatingCharts()
})

onBeforeUnmount(() => {
  if (intervalId.value) {
    clearInterval(intervalId.value)
  }
  if (waveformChart) {
    waveformChart.dispose()
    waveformChart = null
  }
  if (ringChart) {
    ringChart.dispose()
    ringChart = null
  }
})
</script>

<style scoped>
.dashboard {
  width: 100%;
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  background-color: #ffffff;
}

.container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.charts-section {
  display: flex;
  gap: 10px;
  flex: 1;
}

.chart-container {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.waveform-container {
  flex: 2;
}

.ring-container {
  flex: 1;
}

.chart-header {
  position: relative;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0 0 10px 0;
}

.chart {
  flex: 1;
  min-height: 0;
}

.ring-chart {
  aspect-ratio: 1;
}

.status-section {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-item {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-top: 10px;
}

.status-item-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-icon {
  width: 20px;
  height: 20px;
}

.status-light {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: gray;
}

.status-red {
  background-color: #EF4444;
}

.status-green {
  background-color: #10B981;
}

.info-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f0f0f0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  font-style: italic;
  font-size: 10px;
  color: #666;
  position: relative;
}

.tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 10px;
  z-index: 1000;
  max-width: 200px;
  width: max-content;
  white-space: normal;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.note-description {
  margin-top: 10px;
  color: #888;
  font-size: 10px;
  text-align: center;
}
</style>