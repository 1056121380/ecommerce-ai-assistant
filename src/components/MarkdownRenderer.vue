<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  content: string
}>()

const renderedContent = computed(() => renderMarkdown(props.content))
</script>

<style scoped>
.markdown-content {
  line-height: 1.7;
  color: inherit;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 16px 0 8px;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-content :deep(h1) { font-size: 1.8em; }
.markdown-content :deep(h2) { font-size: 1.5em; }
.markdown-content :deep(h3) { font-size: 1.3em; }
.markdown-content :deep(h4) { font-size: 1.1em; }

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.6;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #dfe2e5;
  padding-left: 16px;
  margin: 12px 0;
  color: #6a737d;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #dfe2e5;
  padding: 8px 12px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

.markdown-content :deep(a) {
  color: #0366d6;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e1e4e8;
  margin: 16px 0;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

/* 代码高亮样式 */
.markdown-content :deep(.hljs) {
  display: block;
  overflow-x: auto;
  padding: 0;
  background: transparent;
}

.markdown-content :deep(.hljs-keyword),
.markdown-content :deep(.hljs-selector-tag),
.markdown-content :deep(.hljs-literal),
.markdown-content :deep(.hljs-section),
.markdown-content :deep(.hljs-link) {
  color: #d73a49;
}

.markdown-content :deep(.hljs-string),
.markdown-content :deep(.hljs-title),
.markdown-content :deep(.hljs-name),
.markdown-content :deep(.hljs-type),
.markdown-content :deep(.hljs-attribute),
.markdown-content :deep(.hljs-symbol),
.markdown-content :deep(.hljs-bullet),
.markdown-content :deep(.hljs-built_in),
.markdown-content :deep(.hljs-addition),
.markdown-content :deep(.hljs-variable),
.markdown-content :deep(.hljs-template-tag),
.markdown-content :deep(.hljs-template-variable) {
  color: #22863a;
}

.markdown-content :deep(.hljs-comment),
.markdown-content :deep(.hljs-quote),
.markdown-content :deep(.hljs-deletion),
.markdown-content :deep(.hljs-meta) {
  color: #6a737d;
}

.markdown-content :deep(.hljs-number),
.markdown-content :deep(.hljs-regexp),
.markdown-content :deep(.hljs-selector-id),
.markdown-content :deep(.hljs-selector-class),
.markdown-content :deep(.hljs-selector-attr),
.markdown-content :deep(.hljs-selector-pseudo) {
  color: #005cc5;
}
</style>
