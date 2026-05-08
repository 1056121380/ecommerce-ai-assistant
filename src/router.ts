import { createRouter, createWebHashHistory } from 'vue-router'
import ChatView from './views/ChatView.vue'
import ProductAnalysis from './views/ProductAnalysis.vue'
import HotWordsView from './views/HotWordsView.vue'
import DataAnalysis from './views/DataAnalysis.vue'
import TemplatesView from './views/TemplatesView.vue'
import BatchAnalysisView from './views/BatchAnalysisView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView
    },
    {
      path: '/product',
      name: 'product',
      component: ProductAnalysis
    },
    {
      path: '/hotwords',
      name: 'hotwords',
      component: HotWordsView
    },
    {
      path: '/data',
      name: 'data',
      component: DataAnalysis
    },
    {
      path: '/templates',
      name: 'templates',
      component: TemplatesView
    },
    {
      path: '/batch',
      name: 'batch',
      component: BatchAnalysisView
    }
  ]
})

export default router
