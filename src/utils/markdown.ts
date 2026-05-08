import { marked } from 'marked'
import hljs from 'highlight.js'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// 自定义渲染器以支持代码高亮
const renderer = new marked.Renderer()

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const highlighted = hljs.highlight(text, { language: lang }).value
      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
    } catch {
      // 高亮失败，使用默认渲染
    }
  }
  return `<pre><code>${text}</code></pre>`
}

marked.use({ renderer })

export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string
  } catch (error) {
    console.error('Markdown 渲染失败:', error)
    return content
  }
}

export function stripMarkdown(content: string): string {
  return content
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}
