import { invoke, isTauri } from '@tauri-apps/api/core'

type DataFileName = 'llm_config.json' | 'chat_sessions.json' | 'analysis_results.json' | 'data_source_cache.json' | 'public_data_cache.json'

const localFallbackKeys: Record<DataFileName, string> = {
  'llm_config.json': 'llm_config',
  'chat_sessions.json': 'chat_sessions',
  'analysis_results.json': 'analysis_results',
  'data_source_cache.json': 'data_source_cache',
  'public_data_cache.json': 'public_data_cache'
}

async function tryInvoke<T>(command: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    if (isTauri()) {
      throw error
    }
    return null
  }
}

export async function saveJson<T>(fileName: DataFileName, value: T): Promise<void> {
  const content = JSON.stringify(value)
  const saved = await tryInvoke<void>('save_app_data', { fileName, content })
  if (saved === null) {
    localStorage.setItem(localFallbackKeys[fileName], content)
  }
}

export async function loadJson<T>(fileName: DataFileName): Promise<T | null> {
  const content = await tryInvoke<string | null>('load_app_data', { fileName })
  const raw = content ?? localStorage.getItem(localFallbackKeys[fileName])
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function saveSecret(account: string, value: string): Promise<void> {
  const encoded = btoa(encodeURIComponent(value))
  const saved = await tryInvoke<void>('save_api_key', { account, apiKey: encoded })
  if (saved === null) {
    sessionStorage.setItem(`api_key:${account}`, encoded)
  }
}

export async function loadSecret(account: string): Promise<string> {
  const value = await tryInvoke<string | null>('load_api_key', { account })
  const raw = value ?? sessionStorage.getItem(`api_key:${account}`) ?? ''
  if (!raw) return ''
  try {
    return decodeURIComponent(atob(raw))
  } catch {
    // 兼容旧版明文存储
    return raw
  }
}

export async function deleteSecret(account: string): Promise<void> {
  const deleted = await tryInvoke<void>('delete_api_key', { account })
  if (deleted === null) {
    sessionStorage.removeItem(`api_key:${account}`)
  }
}

export function exportTextFile(fileName: string, content: string, type = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
