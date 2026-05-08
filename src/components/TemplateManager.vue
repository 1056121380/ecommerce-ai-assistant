<template>
  <div class="template-manager">
    <div class="header">
      <h3>Prompt 模板管理</h3>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="选品分析" name="product">
        <TemplateList :templates="productTemplates" @edit="handleEdit" @delete="handleDelete" @duplicate="handleDuplicate" />
      </el-tab-pane>
      <el-tab-pane label="热词分析" name="hotwords">
        <TemplateList :templates="hotwordsTemplates" @edit="handleEdit" @delete="handleDelete" @duplicate="handleDuplicate" />
      </el-tab-pane>
      <el-tab-pane label="带货分析" name="data">
        <TemplateList :templates="dataTemplates" @edit="handleEdit" @delete="handleDelete" @duplicate="handleDuplicate" />
      </el-tab-pane>
      <el-tab-pane label="自定义" name="custom">
        <TemplateList :templates="customTemplates" @edit="handleEdit" @delete="handleDelete" @duplicate="handleDuplicate" />
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTemplate ? '编辑模板' : '新建模板'"
      width="700px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="模板名称" required>
          <el-input v-model="form.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="模板描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入模板描述" />
        </el-form-item>
        <el-form-item label="模板类型" required>
          <el-select v-model="form.type" placeholder="请选择类型">
            <el-option label="选品分析" value="product" />
            <el-option label="热词分析" value="hotwords" />
            <el-option label="带货分析" value="data" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="Prompt 内容" required>
          <el-input
            v-model="form.prompt"
            type="textarea"
            :rows="12"
            placeholder="请输入 Prompt 内容，使用 {data} 等变量占位符"
          />
          <div class="hint">
            提示：使用 {data} 作为数据占位符，使用 {platform}、{dateRange} 等作为其他变量
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useTemplateStore, type PromptTemplate } from '@/stores/templates'
import TemplateList from './TemplateList.vue'

const templateStore = useTemplateStore()
const activeTab = ref('product')
const showCreateDialog = ref(false)
const editingTemplate = ref<PromptTemplate | null>(null)

const form = ref({
  name: '',
  description: '',
  type: 'product' as PromptTemplate['type'],
  prompt: ''
})

const productTemplates = computed(() => templateStore.getTemplatesByType('product'))
const hotwordsTemplates = computed(() => templateStore.getTemplatesByType('hotwords'))
const dataTemplates = computed(() => templateStore.getTemplatesByType('data'))
const customTemplates = computed(() => templateStore.templates.filter(t => t.type === 'custom'))

onMounted(async () => {
  await templateStore.loadTemplates()
})

const handleEdit = (template: PromptTemplate) => {
  if (template.isBuiltIn) {
    ElMessage.warning('内置模板不可编辑，请复制后修改')
    return
  }

  editingTemplate.value = template
  form.value = {
    name: template.name,
    description: template.description,
    type: template.type,
    prompt: template.prompt
  }
  showCreateDialog.value = true
}

const handleDelete = async (template: PromptTemplate) => {
  if (template.isBuiltIn) {
    ElMessage.warning('内置模板不可删除')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除这个模板吗？', '确认删除', {
      type: 'warning'
    })

    await templateStore.deleteTemplate(template.id)
    ElMessage.success('模板已删除')
  } catch (error) {
    // 用户取消
  }
}

const handleDuplicate = async (template: PromptTemplate) => {
  try {
    await templateStore.duplicateTemplate(template.id)
    ElMessage.success('模板已复制')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const handleSave = async () => {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }

  if (!form.value.prompt.trim()) {
    ElMessage.warning('请输入 Prompt 内容')
    return
  }

  try {
    // 提取变量
    const variables = Array.from(new Set(
      (form.value.prompt.match(/\{(\w+)\}/g) || []).map(v => v.slice(1, -1))
    ))

    if (editingTemplate.value) {
      await templateStore.updateTemplate(editingTemplate.value.id, {
        name: form.value.name,
        description: form.value.description,
        type: form.value.type,
        prompt: form.value.prompt,
        variables
      })
      ElMessage.success('模板已更新')
    } else {
      await templateStore.addTemplate({
        name: form.value.name,
        description: form.value.description,
        type: form.value.type,
        prompt: form.value.prompt,
        variables
      })
      ElMessage.success('模板已创建')
    }

    showCreateDialog.value = false
    resetForm()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const resetForm = () => {
  editingTemplate.value = null
  form.value = {
    name: '',
    description: '',
    type: 'product',
    prompt: ''
  }
}
</script>

<style scoped>
.template-manager {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h3 {
  font-size: 20px;
  margin: 0;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
</style>
