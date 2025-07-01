<template>
  <div class="monitor-container">
    <div class="header">
      <h1 class="title">毫米波无感健康检测</h1>
      <div class="time-display">
        <div class="date">{{ currentDate }}</div>
        <div class="time">{{ currentTime }}</div>
        <span v-if="!isInBed" class="bed-status">已离开</span>
      </div>
    </div>
    <div class="grid-container">
      <!-- 心率监测 -->
      <div class="grid-item">
        <HeartrateMonitor :userId="userId" />
      </div>
      
      <!-- 心电监测 -->
      <div class="grid-item">
        <HeartMonitor :userId="userId" />
      </div>
      
      <!-- 呼吸监测 -->
      <div class="grid-item">
        <BreathMonitor :userId="userId" />
      </div>
      
      <!-- hrv监测 -->
      <div class="grid-item">
        <HRVMonitor :userId="userId" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import HeartrateMonitor from '@/components/HeartrateMonitor.vue'
import HeartMonitor from '@/components/HeartMonitor.vue'
import BreathMonitor from '@/components/BreathMonitor.vue'
import HRVMonitor from '@/components/HRVMonitor.vue'
import { getBWaveform } from '@/api/breath'

// 定义响应式状态
const userId = ref<string | null>(null)
const currentDate = ref('')
const currentTime = ref('')
const isInBed = ref(true)
let timer: number | null = null
let bedStatusTimer: number | null = null

// 获取路由参数
const route = useRoute()
userId.value = route.params.userId as string

// 更新时间函数
const updateTime = () => {
  const now = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekday = weekdays[now.getDay()]
  currentDate.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekday}`
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

// 检查床位状态
const checkBedStatus = async () => {
  try {
    if (userId.value) {
      const res = await getBWaveform(userId.value)
      if (res && res.data) {
        isInBed.value = res.data.is_in_bed
      }
    }
  } catch (error) {
    console.error('获取离床状态失败:', error)
  }
}

// 开始定时检查床位状态
const startCheckingBedStatus = () => {
  checkBedStatus()
  bedStatusTimer = window.setInterval(() => {
    checkBedStatus()
  }, 5000)
}

// 组件挂载时执行
onMounted(() => {
  updateTime()
  timer = window.setInterval(() => {
    updateTime()
  }, 1000)
  startCheckingBedStatus()
})

// 组件卸载前清理定时器
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (bedStatusTimer) {
    clearInterval(bedStatusTimer)
    bedStatusTimer = null
  }
})
</script>

<style scoped>
.monitor-container {
  width: 100%;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f0f4f8;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 auto 20px;
  padding: 10px 20px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  width: calc(100% - 40px);
  max-width: 2000px;
  box-sizing: border-box;
}

.title {
  font-size: 1.5rem;
  color: #333;
  margin: 0 auto;
  font-weight: bold;
  flex: 1;
  text-align: center;
}

.time-display {
  min-width: 200px;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 10px;
}

.date {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 4px;
}

.time {
  font-size: 1.25rem;
  color: #333;
  font-weight: bold;
}

.bed-status {
  color: #ff4d4f;
  font-size: 0.875rem;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(255, 77, 79, 0.1);
}

/* 为内容区域添加滚动 */
.chart-container {
  flex: 1;
  min-height: 300px;
  overflow-y: auto;
  padding: 15px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(300px, 1fr);
  gap: 20px;
  height: calc(100vh - 120px);
  width: calc(100% - 40px);
  max-width: 2000px;
  margin: 0 auto;
}

.grid-item {
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
  min-height: 350px;
  display: flex;
  flex-direction: column;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  border: 2px dashed #dee2e6;
}

.empty-placeholder {
  color: #6c757d;
  font-size: 1.2rem;
  text-align: center;
}

.empty-placeholder span {
  display: block;
  margin-top: 10px;
}

/* 响应式布局 */
@media screen and (max-width: 1200px) {
  .grid-container {
    grid-auto-rows: minmax(250px, 1fr);
    gap: 15px;
  }
  
  .grid-item {
    min-height: 250px;
  }
}

@media screen and (max-width: 768px) {
  .grid-container {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100vh;
  }
  
  .grid-item {
    min-height: 400px;
    height: auto;
  }
  
  .header {
    flex-direction: column;
    padding: 10px;
  }

  .title {
    margin-bottom: 10px;
  }

  .time-display {
    width: 100%;
    justify-content: center;
  }
}

@media screen and (max-width: 480px) {
  .monitor-container {
    padding: 10px;
  }
  
  .grid-container {
    gap: 10px;
    width: calc(100% - 20px);
  }
}

@media screen and (min-width: 2000px) {
  .grid-container {
    max-width: 2400px;
  }
  
  .grid-item {
    min-height: 500px;
  }
}
</style>