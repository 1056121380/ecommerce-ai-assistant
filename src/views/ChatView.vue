<template>
  <div class="chat-view">
    <div class="chat-header">
      <div class="header-left">
        <el-select
          v-model="chatStore.currentSessionId"
          placeholder="选择对话"
          style="width: 220px"
          @change="chatStore.switchSession($event)"
        >
          <el-option
            v-for="session in chatStore.sessions"
            :key="session.id"
            :label="session.title"
            :value="session.id"
          />
        </el-select>
        <el-button @click="chatStore.createSession()">
          <el-icon><Plus /></el-icon>
          新对话
        </el-button>
        <el-button @click="chatStore.clearCurrentSession()">
          <el-icon><Delete /></el-icon>
          清空
        </el-button>
      </div>
    </div>

    <div class="template-bar">
      <span class="template-label">快捷模板：</span>
      <el-button-group>
        <el-button size="small" @click="applyTemplate('product')">选品分析</el-button>
        <el-button size="small" @click="applyTemplate('hotwords')">热词分析</el-button>
        <el-button size="small" @click="applyTemplate('data')">带货分析</el-button>
      </el-button-group>
      <span class="source-hint">默认引用：{{ activeSourceNames }}</span>
    </div>

    <div class="message-list" ref="messageListRef">
      <div v-if="!currentSession?.messages.length" class="empty-state">
        <el-icon :size="60" color="#dcdfe6"><ChatDotRound /></el-icon>
        <p>开始一段新对话</p>
        <p class="sub">可以直接提问，也可以选择上方模板进入结构化分析。</p>
        <p class="hint">
          <el-icon><Keyboard /></el-icon>
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>

      <TransitionGroup name="message" tag="div">
        <div v-for="msg in currentSession?.messages" :key="msg.id" class="message" :class="msg.role">
          <div class="message-avatar">
            <el-icon v-if="msg.role === 'user'" :size="24"><User /></el-icon>
            <el-icon v-else :size="24"><MagicStick /></el-icon>
          </div>
          <div class="message-content">
            <pre>{{ msg.content }}</pre>
            <div v-if="msg.role === 'assistant'" class="message-actions">
              <el-button text size="small" @click="copyMessage(msg.content)">
                <el-icon><CopyDocument /></el-icon>
                复制
              </el-button>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="chatStore.isLoading && !pendingAssistantId" class="message assistant">
        <div class="message-avatar">
          <el-icon :size="24" class="loading-pulse"><Loading /></el-icon>
        </div>
        <div class="message-content">
          <span class="loading-text">正在连接模型...</span>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="data-source-preview">
        <el-tag
          v-for="source in activeContexts"
          :key="source.id"
          size="small"
          :type="source.status === 'active' ? 'success' : source.status === 'needs_auth' ? 'warning' : 'info'"
        >
          {{ source.source }}
        </el-tag>
      </div>

      <div class="input-wrapper">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入你的问题，按 Shift+Enter 换行，Enter 发送..."
          @keydown.enter.exact.prevent="sendMessage"
          resize="none"
        />
        <el-button type="primary" size="large" :loading="chatStore.isLoading" @click="sendMessage">
          <el-icon><Promotion /></el-icon>
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useChatStore } from '@/stores/chat'
import { formatLlmError, llmService, LLMService, type ChatMessage, stripReasoningText } from '@/services/llm'
import { buildDefaultDataContext, formatDataContext, summarizeAvailableDataSources } from '@/services/dataSources'
import { fetchDefaultPublicData, formatPublicDataForPrompt } from '@/services/publicData'

const chatStore = useChatStore()
const inputText = ref('')
const messageListRef = ref<HTMLElement>()
const pendingAssistantId = ref('')

const activeContexts = computed(() => buildDefaultDataContext(inputText.value || latestUserText.value))
const activeSourceNames = computed(() => activeContexts.value.map(item => item.source).join('、'))
const latestUserText = computed(() => {
  const messages = currentSession.value?.messages || []
  return [...messages].reverse().find(message => message.role === 'user')?.content || ''
})
const currentSession = computed(() => chatStore.sessions.find(s => s.id === chatStore.currentSessionId))

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || chatStore.isLoading) return

  chatStore.addMessage('user', text)
  inputText.value = ''
  chatStore.setLoading(true)
  scrollToBottom()

  try {
    const dataContext = buildDefaultDataContext(text)
    const assistantMessage = chatStore.addMessage('assistant', '正在查询默认公开数据源...')
    pendingAssistantId.value = assistantMessage.id

    const publicData = await fetchDefaultPublicData(text)
    chatStore.updateMessage(assistantMessage.id, '正在连接模型...')

    const dataContextPrompt = `以下是软件默认启用的数据来源上下文。请把【默认公开数据源实时结果】作为本次回答的可用参考，直接给出判断和建议。不要在回答开头道歉或说“无法提供实时数据”。如果没有平台后台精确销量，只需在答案末尾用一句话说明“以上基于公开趋势线索和内置分析框架，不是平台后台销量榜单”。\n\n【内置数据源上下文】\n${formatDataContext(dataContext)}\n\n【默认公开数据源实时结果】\n${formatPublicDataForPrompt(publicData)}\n\n【当前可用或规划中的数据源】\n${summarizeAvailableDataSources()}`
    const currentMessages = currentSession.value!.messages
      .filter(m => m.content.trim())
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    const messages: ChatMessage[] = [
      { role: 'system', content: LLMService.GENERAL_ASSISTANT_PROMPT },
      { role: 'system', content: dataContextPrompt },
      ...currentMessages
    ]

    let fullContent = ''
    const response = await llmService.chat(messages, (chunk) => {
      fullContent += chunk
      chatStore.updateMessage(assistantMessage.id, stripReasoningText(fullContent) || '正在整理回复...')
      scrollToBottom()
    })

    const displayContent = stripReasoningText(fullContent || response)
    if (displayContent.trim()) {
      chatStore.updateMessage(assistantMessage.id, displayContent)
    } else {
      chatStore.updateMessage(assistantMessage.id, '错误：模型没有返回内容，请检查 API Key、模型或 Endpoint 设置。')
    }
  } catch (error: unknown) {
    const errorText = `错误：${formatLlmError(error)}`
    if (pendingAssistantId.value) {
      chatStore.updateMessage(pendingAssistantId.value, errorText)
    } else {
      chatStore.addMessage('assistant', errorText)
    }
  } finally {
    pendingAssistantId.value = ''
    chatStore.setLoading(false)
    scrollToBottom()
  }
}

const applyTemplate = (type: 'product' | 'hotwords' | 'data') => {
  const templates = {
    product: {
      title: '选品分析',
      prompt: `请帮我分析这个商品或品类是否值得做。\n\n商品/品类：\n目标平台：\n目标人群：\n价格带：\n已知数据：\n\n请从市场需求、竞争强度、利润空间、内容潜力、供应链风险和行动建议六个方面分析。`
    },
    hotwords: {
      title: '热词分析',
      prompt: `请帮我分析这批关键词。\n\n平台：\n关键词数据：\n\n请输出热词分类、搜索意图、机会词、标题组合和投放建议。`
    },
    data: {
      title: '带货分析',
      prompt: `请帮我分析这组直播或销售数据。\n\n数据：\n\n请输出整体表现、漏斗问题、高潜商品、投流判断和具体优化动作。`
    }
  }
  const template = templates[type]
  chatStore.createSession(template.title)
  inputText.value = template.prompt
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

const copyMessage = async (content: string) => {
  await navigator.clipboard.writeText(content)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.template-bar {
  padding: 12px 24px;
  background: #fafafa;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 12px;
}

.template-label,
.source-hint {
  font-size: 14px;
  color: #909399;
}

.source-hint {
  margin-left: auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 12px;
}

.empty-state .sub {
  font-size: 13px;
  color: #c0c4cc;
}

.empty-state .hint {
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #f0f9ff;
  color: #1d8aef;
}

.message-content {
  background: #fff;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  line-height: 1.7;
  position: relative;
}

.message.user .message-content {
  background: #409eff;
  color: #fff;
}

.message-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  margin: 0;
  font-size: 14px;
}

.message-actions {
  display: none;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.message:hover .message-actions {
  display: flex;
}

.message.user .message-actions {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.message.user .message-actions .el-button {
  color: rgba(255, 255, 255, 0.8);
}

.message.user .message-actions .el-button:hover {
  color: #fff;
}

.loading-text {
  color: #909399;
  font-style: italic;
}

.input-area {
  padding: 12px 24px 16px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.data-source-preview {
  min-height: 24px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-wrapper .el-textarea {
  flex: 1;
}

.input-wrapper .el-button {
  height: 74px;
  width: 100px;
}
</style>
