<template>
  <AuthShell title="欢迎回来" subtitle="登录后即可上传与管理你的图片">
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-form-item label="账号" name="userAccount">
        <a-input
          v-model:value="formState.userAccount"
          size="large"
          placeholder="请输入账号"
          allow-clear
        >
          <template #prefix><UserOutlined /></template>
        </a-input>
      </a-form-item>

      <a-form-item label="密码" name="userPassword">
        <a-input-password
          v-model:value="formState.userPassword"
          size="large"
          placeholder="请输入密码"
        >
          <template #prefix><LockOutlined /></template>
        </a-input-password>
      </a-form-item>

      <a-button
        type="primary"
        size="large"
        block
        html-type="submit"
        :loading="submitting"
        class="submit-btn"
      >
        登录
      </a-button>
    </a-form>

    <div class="auth-extra">
      <a-button type="link" size="small" :disabled="submitting" @click="fillDemo">
        填入示例账号
      </a-button>
      <span class="auth-switch">
        还没有账号？<router-link to="/user/register">立即注册</router-link>
      </span>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'

import AuthShell from '@/components/AuthShell.vue'
import type { LoginParams } from '@/api/user'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive<LoginParams>({
  userAccount: '',
  userPassword: '',
})

// 前端校验只挡「明显不合法」，真正的账号密码校验永远在后端
const rules: Record<string, Rule[]> = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, message: '账号长度不少于 4 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不少于 8 位', trigger: 'blur' },
  ],
}

function fillDemo() {
  formState.userAccount = 'huangjun'
  formState.userPassword = '12345678'
}

async function handleSubmit() {
  submitting.value = true
  try {
    const vo = await userStore.login(formState)
    message.success(`登录成功：${vo.userName ?? vo.userAccount}`)
    await router.push('/')
  } catch {
    // 错误提示由 axios 拦截器统一弹出，这里不用重复提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.submit-btn {
  margin-top: 4px;
}
</style>
