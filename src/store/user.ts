import { defineStore } from 'pinia'
import { getToken, setToken, removeToken } from '@/utils/auth'


export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    name: '',
    avatar: '',
    roles: [] as string[]
  }),
  
  getters: {
  },
  
  actions: {
    // 设置token
    setToken(token: string) {
      this.token = token
      setToken(token)
    },
    
    // 重置Token
    resetToken() {
      return new Promise<void>((resolve) => {
        this.token = ''
        this.roles = []
        removeToken()
        resolve()
      })
    }
  }
})