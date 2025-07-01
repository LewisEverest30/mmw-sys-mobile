<template>
  <div class="health-dashboard">
    <div class="dashboard-content">
      <div class="chart-panel">
        <div class="chart-container">
          <div class="chart-header">
            <h2>心率变异性 (HRV)
              <div class="info-icon" @mouseover="showHRVInfo = true" @mouseleave="showHRVInfo = false">
                <span>i</span>
              </div>
            </h2>
            <div class="stress-value">
              当前HRV值: <span>{{ stressValue }}</span>
            </div>
            <div v-show="showHRVInfo" class="tooltip">
              HRV是指心跳间隔（RR间期）的微小波动，反映了心脏在自主神经系统调节下的健康状态。
              较高的HRV通常表示更好的压力适应能力和较强的心血管健康水平，而较低的HRV可能提示压力过大或健康状态受损。
            </div>
          </div>
          <div class="chart-wrapper">
            <canvas ref="hrvChartRef"></canvas>
          </div>
          <div v-if="showHRVInfo" class="sdnn-info-box">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Chart, ChartType } from 'chart.js/auto'
import { getHrvData } from '@/api/history'
import { getStress } from '@/api/heart'

// 路由信息
const route = useRoute()
const uid = computed(() => route.params.userId as string || '1')

// 状态定义
const showHRVInfo = ref(false)
const stressValue = ref('0')
const hrvChartRef = ref<HTMLCanvasElement | null>(null)
const hrvData = ref<number[]>([])
const timeStamps = ref<number[]>([])
const isInBed = ref(true)
const startTime = ref('')
const endTime = ref('')
const updateTimer = ref<number | null>(null)

let hrvChart: Chart<ChartType> | null = null

// 时间格式化函数
const formatDateTime = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 更新时间范围
const updateTimeRange = (): void => {
  const end = new Date()
  const start = new Date(end.getTime() - 60 * 10 * 1000) // 10分钟前
  endTime.value = formatDateTime(end)
  startTime.value = formatDateTime(start)
}

// 格式化时间戳
const formatTimeStamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 初始化HRV图表
const initHRVChart = async (): Promise<void> => {
  if (!hrvChartRef.value) return

  try {
    const ctx = hrvChartRef.value.getContext('2d')
    if (!ctx) return

    const response = await getHrvData({
      uid: uid.value,
      start_time: startTime.value,
      end_time: endTime.value,
    })

    if (response.code === 20000 && response.data) {
      hrvData.value = response.data.hrv_data
      timeStamps.value = response.data.time_stamp
      
      // 找到最后一个非-1的值作为当前HRV值
      const lastValidValue = [...hrvData.value].reverse().find(value => value !== -1)
      stressValue.value = hrvData.value[hrvData.value.length - 1] === -1 
        ? '/' 
        : (lastValidValue ? Math.round(lastValidValue).toString() : '0')

      if (hrvChart) hrvChart.destroy()
      
      const formattedLabels = timeStamps.value.map(formatTimeStamp)
      const purpleGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
      purpleGradient.addColorStop(0, 'rgba(139, 92, 246, 0.6)')
      purpleGradient.addColorStop(1, 'rgba(139, 92, 246, 0)')

      hrvChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: formattedLabels,
          datasets: [{
            label: 'HRV',
            data: hrvData.value.map(value => value === -1 ? null : value),
            borderColor: '#8B5CF6',
            backgroundColor: purpleGradient,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 5,
            spanGaps: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'SDNN(ms)'
              }
            },
            x: {
              title: {
                display: true,
                text: '时间'
              },
              ticks: {
                autoSkip: true,
                maxRotation: 0
              },
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#666',
                boxWidth: 12
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.7)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255,255,255,0.2)',
              borderWidth: 1,
              mode: 'index',
              intersect: false
            }
          },
          hover: {
            mode: 'index',
            intersect: false
          }
        }
      })
    }
  } catch (error) {
    console.error('初始化HRV图表出错:', error)
  }
}

// 更新图表数据
const updateChartData = async (): Promise<void> => {
  try {
    const response = await getHrvData({
      uid: uid.value,
      start_time: startTime.value,
      end_time: endTime.value,
    })

    if (response.code === 20000 && response.data) {
      const newHrvData = response.data.hrv_data
      const newTimeStamps = response.data.time_stamp
      isInBed.value = response.data.is_in_bed
      
      // 清空图表逻辑
      if (!isInBed.value) {
        stressValue.value = '/'
        if (hrvChart) {
          hrvChart.data.labels = []
          hrvChart.data.datasets[0].data = []
          hrvChart.update()
        }
        return
      }
      
      // 只显示最新的 HRV 值，并转换为整数
      const latestHrvValue = newHrvData[newHrvData.length - 1]
      stressValue.value = latestHrvValue === -1 ? '/' : Math.round(latestHrvValue).toString()

      // 更新图表数据
      if (hrvChart) {
        hrvChart.data.labels = newTimeStamps.map(formatTimeStamp)
        hrvChart.data.datasets[0].data = newHrvData.map(value => value === -1 ? null : Math.round(value))
        hrvChart.update()
      }
    }
  } catch (error) {
    console.error('更新图表时出错:', error)
  }
}

// 启动自动更新
const startAutoUpdate = (): void => {
  // 先执行一次更新
  updateTimeRange()
  initHRVChart()
  
  // 设置5秒定时更新
  updateTimer.value = window.setInterval(() => {
    updateTimeRange()
    updateChartData()
  }, 5000)
}

// 生命周期钩子
onMounted(() => {
  // 启动自动更新
  startAutoUpdate()
})

onBeforeUnmount(() => {
  // 清理定时器
  if (updateTimer.value) {
    clearInterval(updateTimer.value)
    updateTimer.value = null
  }
  
  // 销毁图表
  if (hrvChart) {
    hrvChart.destroy()
    hrvChart = null
  }
})
</script>

<style scoped>
.health-dashboard {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 10px;
  height: 100%;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
}

.chart-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  height: 100%;
}

@media (min-width: 1024px) {
  .chart-panel {
    grid-template-columns: 1fr;
  }
}

.chart-container {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  align-items: center;
  position: relative;
  justify-content: space-between;
  margin-bottom: 20px;
}

.chart-header h2 {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin: 0;
  display: flex;
  align-items: center;
}

.stress-value {
  font-size: 14px;
  color: #333;
  font-weight: bold;
}

.stress-value span {
  color: #8B5CF6;
  margin-left: 4px;
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #8B5CF6;
  color: white;
  font-size: 12px;
  margin-left: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.info-icon:hover {
  background-color: #7c3aed;
}

.chart-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.tooltip {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  max-width: 350px;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sdnn-info-box {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;
  border-left: 4px solid #8B5CF6;
}

.sdnn-info-box h3 {
  font-size: 16px;
  margin-top: 0;
  color: #4b5563;
}

.sdnn-info-box h4 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #4b5563;
}

.sdnn-info-box p {
  margin: 8px 0;
  color: #6b7280;
}

.sdnn-info-box ul {
  padding-left: 20px;
  margin: 8px 0;
}

.sdnn-info-box li {
  margin-bottom: 6px;
  color: #6b7280;
}
</style>