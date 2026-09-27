<template>
  <a-card title="上传图片">
    <a-form layout="vertical" :model="formState" style="max-width: 640px">
      <a-form-item label="图片文件" required>
        <a-upload-dragger
          v-model:fileList="fileList"
          :max-count="1"
          :before-upload="beforeUpload"
          list-type="picture"
          accept="image/jpeg,image/png,image/webp"
        >
          <p class="ant-upload-drag-icon"><CloudUploadOutlined /></p>
          <p class="ant-upload-text">点击或拖拽图片到此处</p>
          <p class="ant-upload-hint">支持 jpg / png / webp，单个文件不超过 5MB</p>
        </a-upload-dragger>
      </a-form-item>

      <a-form-item label="图片名称">
        <a-input
          v-model:value="formState.name"
          placeholder="不填则默认用原文件名"
          allow-clear
          :maxlength="80"
        />
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">开始上传</a-button>
          <a-button @click="handleReset">清空</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadFile } from 'ant-design-vue'
import { CloudUploadOutlined } from '@ant-design/icons-vue'

import { uploadImage } from '@/api/image'

const router = useRouter()

const fileList = ref<UploadFile[]>([])
const submitting = ref(false)
const formState = reactive<{ name: string }>({ name: '' })

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 返回 false 表示「拦住 a-upload 自己的上传行为」—— 我们要手动调后端接口，
 * 不能让它自己 POST 到一个不存在的地址。
 *
 * 这里的校验只是「提前拦一道，省一次网络往返」，**权威校验永远在后端**：
 * 前端校验能被绕过（改 JS、直接发请求），真正的后缀白名单 + 文件头魔数校验在
 * ImageUtils#checkUploadFile 里。两层都要有，但边界要清楚。
 */
function beforeUpload(file: File) {
  const okType = ALLOWED.includes(file.type)
  if (!okType) {
    message.error('只支持 jpg / png / webp 格式')
    return false
  }
  if (file.size > MAX_SIZE) {
    message.error('文件大小不能超过 5MB')
    return false
  }
  return false
}

function handleReset() {
  fileList.value = []
  formState.name = ''
}

async function handleSubmit() {
  const file = fileList.value[0]?.originFileObj as File | undefined
  if (!file) {
    message.warning('请先选择一张图片')
    return
  }

  submitting.value = true
  try {
    const vo = await uploadImage(file, formState.name || undefined)
    message.success(`上传成功：${vo.name ?? ''}`)
    handleReset()
    await router.push('/')
  } catch {
    // 错误提示由 axios 拦截器统一弹出，这里不重复
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
:deep(.ant-upload-drag-icon) {
  margin-bottom: 8px;
}
</style>
