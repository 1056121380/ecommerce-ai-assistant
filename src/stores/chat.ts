import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadJson, saveJson } from '@/services/storage'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const isLoading = ref(false)

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveSessions()
      saveTimer = null
    }, 1000)
  }

  const currentSession = () => {
    return sessions.value.find(s => s.id === currentSessionId.value)
  }

  function createSession(title: string = '新对话'): ChatSession {
    const session: ChatSession = {
      id: Date.now().toString(),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    sessions.value.unshift(session)
    currentSessionId.value = session.id
    debouncedSave()
    return session
  }

  function addMessage(role: 'user' | 'assistant', content: string): Message {
    const session = currentSession()
    if (!session) {
      createSession()
    }
    const target = sessions.value.find(s => s.id === currentSessionId.value)!
    const message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: Date.now()
    }
    target.messages.push(message)
    target.updatedAt = Date.now()
    // 第一条用户消息作为标题（按字符截断，避免截断中文）
    if (target.messages.length === 1 && role === 'user') {
      target.title = content.length > 20 ? content.slice(0, 20) + '...' : content
    }
    debouncedSave()
    return message
  }

  function updateMessage(id: string, content: string) {
    const session = currentSession()
    const message = session?.messages.find(item => item.id === id)
    if (!message) return
    message.content = content
    session!.updatedAt = Date.now()
    debouncedSave()
  }

  function deleteMessage(id: string) {
    const session = currentSession()
    if (!session) return
    const idx = session.messages.findIndex(item => item.id === id)
    if (idx === -1) return
    session.messages.splice(idx, 1)
    session.updatedAt = Date.now()
    debouncedSave()
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function switchSession(id: string) {
    currentSessionId.value = id
  }

  function deleteSession(id: string) {
    const idx = sessions.value.findIndex(s => s.id === id)
    if (idx !== -1) {
      sessions.value.splice(idx, 1)
      if (currentSessionId.value === id) {
        currentSessionId.value = sessions.value[0]?.id || null
      }
      debouncedSave()
    }
  }

  async function saveSessions() {
    try {
      await saveJson('chat_sessions.json', sessions.value)
    } catch (e) {
      console.error('保存对话失败', e)
    }
  }

  async function loadSessions() {
    try {
      const saved = await loadJson<ChatSession[]>('chat_sessions.json')
      if (saved) {
        sessions.value = saved.map(session => ({
          ...session,
          messages: session.messages.filter(message => message.role !== 'assistant' || message.content.trim())
        }))
        if (sessions.value.length > 0) {
          currentSessionId.value = sessions.value[0].id
        }
      } else {
        createSession()
      }
    } catch (e) {
      console.error('加载对话失败', e)
      createSession()
    }
  }

  function clearCurrentSession() {
    const session = sessions.value.find(s => s.id === currentSessionId.value)
    if (session) {
      session.messages = []
      session.title = '新对话'
      debouncedSave()
    }
  }

  // 初始化
  loadSessions()

  return {
    sessions,
    currentSessionId,
    isLoading,
    currentSession,
    createSession,
    addMessage,
    updateMessage,
    deleteMessage,
    setLoading,
    switchSession,
    deleteSession,
    clearCurrentSession,
    loadSessions
  }
})
