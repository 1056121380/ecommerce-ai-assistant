import { createRouter, createWebHashHistory } from 'vue-router'
import ChatView from './views/ChatView.vue'
import ProductAnalysis from './views/ProductAnalysis.vue'
import HotWordsView from './views/HotWordsView.vue'
import DataAnalysis from './views/DataAnalysis.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView,
      meta: { title: 'AI对话' }
    },
    {
      path: '/product',
      name: 'product',
      component: ProductAnalysis,
      meta: { title: '选品分析' }
    },
    {
      path: '/hotwords',
      name: 'hotwords',
      component: HotWordsView,
      meta: { title: '热词分析' }
    },
    {
      path: '/data',
      name: 'data',
      component: DataAnalysis,
      meta: { title: '带货分析' }
    }
  ]
})

// 路由切换时更新页面标题
router.beforeEach((to) => {
  document.title = `${to.meta.title || '页面'} - 电商AI助手`
})

export default router
