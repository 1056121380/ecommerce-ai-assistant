import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AnalysisResult } from './analysis'

export interface BatchTask {
  id: string
  fileName: string
  fileSize: number
  fileContent: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: AnalysisResult
  error?: string
  startTime?: number
  endTime?: number
}

export interface BatchJob {
  id: string
  name: string
  type: 'product' | 'hotwords' | 'data'
  tasks: BatchTask[]
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  startedAt?: number
  completedAt?: number
  totalFiles: number
  completedFiles: number
  failedFiles: number
}

export const useBatchStore = defineStore('batch', () => {
  const jobs = ref<BatchJob[]>([])
  const currentJob = ref<BatchJob | null>(null)
  const isProcessing = ref(false)

  // 计算属性
  const activeJobs = computed(() =>
    jobs.value.filter(job => job.status === 'processing')
  )

  const completedJobs = computed(() =>
    jobs.value.filter(job => job.status === 'completed')
  )

  const failedJobs = computed(() =>
    jobs.value.filter(job => job.status === 'failed')
  )

  // 创建批量任务
  function createBatchJob(
    name: string,
    type: 'product' | 'hotwords' | 'data',
    files: File[]
  ): Promise<BatchJob> {
    return new Promise((resolve) => {
      const job: BatchJob = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        type,
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        totalFiles: files.length,
        completedFiles: 0,
        failedFiles: 0
      }

      // 读取文件内容并创建任务
      const filePromises = files.map((file, index) => {
        return new Promise<BatchTask>((resolveTask) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const task: BatchTask = {
              id: `task_${job.id}_${index}`,
              fileName: file.name,
              fileSize: file.size,
              fileContent: e.target?.result as string,
              status: 'pending',
              progress: 0
            }
            resolveTask(task)
          }
          reader.readAsText(file)
        })
      })

      Promise.all(filePromises).then((tasks) => {
        job.tasks = tasks
        jobs.value.unshift(job)
        saveBatchJobs()
        resolve(job)
      })
    })
  }

  // 开始处理批量任务
  async function startBatchJob(
    jobId: string,
    analyzeFunction: (content: string) => Promise<AnalysisResult>
  ) {
    const job = jobs.value.find(j => j.id === jobId)
    if (!job) return

    job.status = 'processing'
    job.startedAt = Date.now()
    currentJob.value = job
    isProcessing.value = true

    let shouldContinue = true

    for (const task of job.tasks) {
      // 检查是否应该继续处理
      if (!shouldContinue) break

      task.status = 'processing'
      task.startTime = Date.now()

      try {
        // 模拟进度更新
        for (let i = 0; i <= 100; i += 20) {
          task.progress = i
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // 执行分析
        const result = await analyzeFunction(task.fileContent)

        task.result = result
        task.status = 'completed'
        task.progress = 100
        task.endTime = Date.now()
        job.completedFiles++
      } catch (error) {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : '分析失败'
        task.endTime = Date.now()
        job.failedFiles++
      }

      // 检查任务是否被取消
      const currentJobState = jobs.value.find(j => j.id === jobId)
      if (currentJobState?.status === 'cancelled') {
        shouldContinue = false
      }

      saveBatchJobs()
    }

    job.status = job.failedFiles === 0 ? 'completed' :
                 job.completedFiles === 0 ? 'failed' : 'completed'
    job.completedAt = Date.now()
    isProcessing.value = false
    currentJob.value = null
    saveBatchJobs()
  }

  // 取消批量任务
  function cancelBatchJob(jobId: string) {
    const job = jobs.value.find(j => j.id === jobId)
    if (job && job.status === 'processing') {
      job.status = 'cancelled'
      job.completedAt = Date.now()
      isProcessing.value = false
      currentJob.value = null
      saveBatchJobs()
    }
  }

  // 删除批量任务
  function deleteBatchJob(jobId: string) {
    const index = jobs.value.findIndex(j => j.id === jobId)
    if (index !== -1) {
      jobs.value.splice(index, 1)
      saveBatchJobs()
    }
  }

  // 获取任务详情
  function getBatchJob(jobId: string): BatchJob | undefined {
    return jobs.value.find(j => j.id === jobId)
  }

  // 导出批量结果
  function exportBatchResults(jobId: string): string {
    const job = jobs.value.find(j => j.id === jobId)
    if (!job) return ''

    const results = job.tasks
      .filter(task => task.status === 'completed' && task.result)
      .map(task => ({
        fileName: task.fileName,
        result: task.result?.content || '',
        duration: task.endTime && task.startTime ?
          ((task.endTime - task.startTime) / 1000).toFixed(2) + 's' : 'N/A'
      }))

    return JSON.stringify({
      jobName: job.name,
      jobType: job.type,
      totalFiles: job.totalFiles,
      completedFiles: job.completedFiles,
      failedFiles: job.failedFiles,
      results
    }, null, 2)
  }

  // 持久化存储
  function saveBatchJobs() {
    try {
      // 只保存最近 20 个任务，避免存储过大
      const jobsToSave = jobs.value.slice(0, 20).map(job => ({
        ...job,
        tasks: job.tasks.map(task => ({
          ...task,
          // 不保存文件内容，节省空间
          fileContent: task.status === 'completed' ? '' : task.fileContent
        }))
      }))
      localStorage.setItem('batch_jobs', JSON.stringify(jobsToSave))
    } catch (error) {
      console.error('Failed to save batch jobs:', error)
    }
  }

  // 加载批量任务
  function loadBatchJobs() {
    try {
      const saved = localStorage.getItem('batch_jobs')
      if (saved) {
        jobs.value = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load batch jobs:', error)
    }
  }

  // 初始化
  loadBatchJobs()

  return {
    jobs,
    currentJob,
    isProcessing,
    activeJobs,
    completedJobs,
    failedJobs,
    createBatchJob,
    startBatchJob,
    cancelBatchJob,
    deleteBatchJob,
    getBatchJob,
    exportBatchResults
  }
})
