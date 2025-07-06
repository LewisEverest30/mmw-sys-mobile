<template>
  <div class="root-container">
    <div class="monitor-container">
      <div class="chart-header">
        <h2 class="section-title">
          心率变异性 (HRV)
          <div class="info-icon" @mouseover="showHRVInfo = true" @mouseleave="showHRVInfo = false">
            <span style="font-size: 0.8em;">i</span>
          </div>
        </h2>
        <div class="status-text">
          <span class="status-text-label">当前HRV值: </span><span class="status-text-content">{{ stressValue }}</span>
        </div>
      </div>
      <div ref="chartRef" class="chart-container"></div>
      <div v-if="showHRVInfo" class="sdnn-info-box">
        <h2>HRV是指心跳间隔（RR间期）的微小波动</h2>
        <h3>SDNN（标准差）：</h3>
        <p>单位为毫秒（ms），表示RR间期(心跳间隔)的标准差。</p>
        <h4>SDNN参考范围:</h4>
        <ul>
          <li><strong>高水平（> 100 ms）：</strong> 良好的心血管健康</li>
          <li><strong>中等水平（50–100 ms）：</strong> 正常范围</li>
          <li><strong>低水平（< 50 ms）：</strong> 潜在健康风险</li>
        </ul>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { getHrvData } from '@/api/history'
import { convertTimestampToTimeHM } from '@/utils/timestamp'
import { calculateEchartsFontSize, calculateEchartsLineWidth } from '@/utils/echarts'
import { generateMockData } from '@/utils/mocks/HRVMock'

// 路由信息
const route = useRoute()
const userId = computed(() => route.params.userId as string)

// 状态定义
const showHRVInfo = ref(false)
const stressValue = ref('0')
const chartRef = ref<HTMLElement | null>(null)
const intervalId = ref<number | null>(null)
const chartData = ref<(number | null)[]>([])
const timeStamps = ref<number[]>([])
const isInBed = ref<boolean | null>(null)

let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// 使用模拟数据的函数
const useMockData = () => {
  const { mockData, mockTimestamps } = generateMockData()
  
  chartData.value = mockData
  timeStamps.value = mockTimestamps
  isInBed.value = true // 模拟在床状态
  
  // 设置当前HRV值
  const lastValidValue = [...mockData].reverse().find(v => v !== null)
  stressValue.value = lastValidValue == null ? '/' : lastValidValue.toString()
  
  if (chart) {
    chart.clear()
    chart.setOption(getChartOption(mockData, mockTimestamps.map(convertTimestampToTimeHM)))
  }
}


// 更新图表数据
const updateChart = async () => {
  try {
    const now = Math.floor(Date.now() / 1000)
    const tenMinAgo = now - 10 * 60
    const endTime = now
    const startTime = tenMinAgo

    const res = await getHrvData({
      uid: userId.value,
      start_time: new Date(startTime * 1000).toISOString().slice(0, 19).replace('T', ' '),
      end_time: new Date(endTime * 1000).toISOString().slice(0, 19).replace('T', ' '),
    })
    if (res?.code === 20000 && res.data) {
      chartData.value = res.data.hrv_data.map((v: number) => v === -1 ? null : v)
      timeStamps.value = res.data.time_stamp
      isInBed.value = res.data.is_in_bed

      // HRV值显示
      const lastValidValue = [...chartData.value].reverse().find(v => v !== null)
      stressValue.value = lastValidValue == null ? '/' : Math.round(lastValidValue).toString()

      if (chart) {
        chart.clear()
        chart.setOption(getChartOption(chartData.value, timeStamps.value.map(convertTimestampToTimeHM)))
      }
    }
  } catch (error) {
    console.error('Error updating HRV chart:', error)
  }
}

// 图表配置函数
const getChartOption = (displayData: (number | null)[], xAxisData: string[]) => {
  const fontSize = calculateEchartsFontSize(chartRef.value, 0.9) // 获取字体大小
  const lineWidth = calculateEchartsLineWidth(chartRef.value, 1) // 获取线宽

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textStyle: { color: '#fff' },
      borderColor: 'rgba(255,255,255,0.2)'
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      splitLine: {
        show: false
      },
      axisLabel: {
        show: true,
        interval: Math.floor(chartData.value.length / 5),
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
      name: 'SDNN(ms)',
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
    series: !isInBed.value ? [] : [{
      name: 'HRV',
      type: 'line',
      data: displayData,
      smooth: true,
      symbol: 'none',
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(139, 92, 246, 0.6)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0)' }
          ]
        }
      },
      itemStyle: {
        color: '#8B5CF6'
      }
    }]
  }
}

// 启动定时更新
const startUpdatingChart = () => {
  intervalId.value = window.setInterval(() => {
    // updateChart()
    useMockData() // 使用模拟数据
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
  useMockData() // 使用模拟数据

  startUpdatingChart()
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeChart()
    })
    resizeObserver.observe(chartRef.value)
  }
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
  position: relative; /* 添加相对定位作为参考点 */
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

/* 标题区 */
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
.status-text-content {
  color: #8B5CF6;
  margin-left: 0.25em;
}
.status-text-label {
  color: #2c3e50c4;
  margin-right: 0.1em;
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

/* 小提示图标 */
.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  background-color: #8B5CF6;
  color: #fff;
  font-size: 0.8em;
  margin-left: 0.3em;
  cursor: pointer;
  transition: background-color 0.2s;
}

.info-icon:hover {
  background-color: #7c3aed;
}

/* 提示气泡 */
.tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 0.75em 1em;
  border-radius: 0.375em;
  max-width: 21.875em;
  font-size: 0.9em;
  line-height: 1.5;
  box-shadow: 0 0.25em 0.75em rgba(0, 0, 0, 0.15);
}

/* SDNN 信息块 */
.sdnn-info-box {
  position: absolute;        /* 相对于 root-container 绝对定位 */
  bottom: 3vh;              /* 距离 root-container 底部的距离 */
  z-index: 100;
  box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.15);
  background: #f8f9fa;
  padding: 1em;
  border-radius: 0.5em;
  margin-top: 1.25em;
  border-left: 0.25em solid #8B5CF6;
}

.sdnn-info-box h3 {
  font-size: 1em;
  margin-top: 0;
  color: #4b5563;
}

.sdnn-info-box h4 {
  font-size: 0.9em;
  margin-bottom: 0.5em;
  color: #4b5563;
}

.sdnn-info-box p {
  margin: 0.5em 0;
  color: #6b7280;
}

.sdnn-info-box ul {
  padding-left: 1.25em;
  margin: 0.5em 0;
}

.sdnn-info-box li {
  margin-bottom: 0.375em;
  color: #6b7280;
}
</style>
