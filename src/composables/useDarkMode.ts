import { ref, watch } from 'vue'

const STORAGE_KEY = 'ecommerce_ai_dark_mode'

// 全局状态
const isDark = ref(localStorage.getItem(STORAGE_KEY) === 'true')

// 初始化时应用
if (isDark.value) {
  document.documentElement.classList.add('dark')
}

// 切换函数
export function toggleDarkMode() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem(STORAGE_KEY, 'true')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem(STORAGE_KEY, 'false')
  }
}

// 监听变化
watch(isDark, (val) => {
  if (val) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})

export function useDarkMode() {
  return {
    isDark
  }
}
