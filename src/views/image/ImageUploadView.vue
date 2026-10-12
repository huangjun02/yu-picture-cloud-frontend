<template>
  <a-card title="上传图片">
    <!-- 两种传图方式：本地文件 / 远端 URL。单选按钮切换，同一张表单按模式渲染 -->
    <a-radio-group v-model:value="mode" button-style="solid" style="margin-bottom: 24px">
      <a-radio-button value="file">
        <FileImageOutlined />
        本地文件
      </a-radio-button>
      <a-radio-button value="url">
        <LinkOutlined />
        URL 导入
      </a-radio-button>
    </a-radio-group>

    <a-form layout="vertical" :model="formState" style="max-width: 640px">
      <!-- ========== 本地文件 ========== -->
      <template v-if="mode === 'file'">
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
      </template>

      <!-- ========== URL 导入 ========== -->
      <template v-else>
        <a-form-item label="图片地址" required>
          <a-input
            v-model:value="formState.fileUrl"
            placeholder="https://example.com/photo.jpg"
            allow-clear
            @press-enter="handleSubmit"
          >
            <template #prefix><LinkOutlined /></template>
          </a-input>
          <div class="field-hint">
            服务器替你把这个地址的图片拉下来入库。仅支持公网 http / https 地址 ——
            内网、本机地址会被后端拦下（防止拿服务器当跳板去摸内网）。
          </div>
        </a-form-item>

        <!-- 地址填了就顺手预览一下：地址打不开的话，点提交前就该知道 -->
        <a-form-item v-if="formState.fileUrl" label="地址预览">
          <div class="url-preview">
            <img v-if="!previewFailed" :src="formState.fileUrl" @error="previewFailed = true" />
            <div v-else class="url-preview-error">
              <CloseCircleOutlined />
              地址加载不出来（可能不允许外链、或地址已失效）—— 后端拉取时也会失败
            </div>
          </div>
        </a-form-item>
      </template>

      <a-form-item label="图片名称">
        <a-input
          v-model:value="formState.name"
          :placeholder="mode === 'file' ? '不填则默认用原文件名' : '不填则从地址里取文件名'"
          allow-clear
          :maxlength="80"
        />
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ mode === 'file' ? '开始上传' : '开始导入' }}
          </a-button>
          <a-button @click="handleReset">清空</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type UploadFile } from 'ant-design-vue'
import {
  CloseCircleOutlined,
  CloudUploadOutlined,
  FileImageOutlined,
  LinkOutlined,
} from '@ant-design/icons-vue'

import { uploadImage, uploadImageByUrl } from '@/api/image'

const router = useRouter()

const mode = ref<'file' | 'url'>('file')
const fileList = ref<UploadFile[]>([])
const submitting = ref(false)
const formState = reactive<{ name: string; fileUrl: string }>({ name: '', fileUrl: '' })

/** 地址预览失败标记：换地址要重置，否则改好了也一直显示旧错误 */
const previewFailed = ref(false)
watch(
  () => formState.fileUrl,
  () => {
    previewFailed.value = false
  },
)

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
  formState.fileUrl = ''
  previewFailed.value = false
}

async function handleSubmit() {
  if (mode.value === 'file') {
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
    return
  }

  // ---- URL 导入 ----
  const url = formState.fileUrl.trim()
  if (!url) {
    message.warning('请先填写图片地址')
    return
  }
  // 只做「看着像不像地址」的前置提示；能不能拉、是不是内网，都由后端判定
  if (!/^https?:\/\//i.test(url)) {
    message.error('地址必须以 http:// 或 https:// 开头')
    return
  }

  submitting.value = true
  try {
    const vo = await uploadImageByUrl(url, formState.name || undefined)
    message.success(`导入成功：${vo.name ?? ''}`)
    handleReset()
    await router.push('/')
  } catch {
    // 拦截器已提示（内网地址、拉取失败、非图片内容都会在这里报出来）
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
:deep(.ant-upload-drag-icon) {
  margin-bottom: 8px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(0 0 0 / 45%);
}

.url-preview {
  padding: 8px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background: #fafafa;
  text-align: center;
}

.url-preview img {
  max-width: 100%;
  max-height: 240px;
  border-radius: 6px;
}

.url-preview-error {
  padding: 24px 8px;
  font-size: 13px;
  color: rgb(0 0 0 / 45%);
}
</style>
