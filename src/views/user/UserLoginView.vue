<template>
  <div class="login-page">
    <a-card class="login-card" title="云图库 · 用户登录">
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-form-item label="账号" name="userAccount">
          <a-input v-model:value="formState.userAccount" placeholder="请输入账号" allow-clear />
        </a-form-item>

        <a-form-item label="密码" name="userPassword">
          <a-input-password v-model:value="formState.userPassword" placeholder="请输入密码" />
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" html-type="submit" :loading="submitting">登录</a-button>
            <a-button @click="fillDemo">填入示例账号</a-button>
          </a-space>
        </a-form-item>
      </a-form>

      <a-divider style="margin: 8px 0" />
      <a-typography-text type="secondary">
        本地联调账号：<a-typography-text code>huangjun</a-typography-text> /
        <a-typography-text code>12345678</a-typography-text>
      </a-typography-text>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'

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
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f0f2f5;
}

.login-card {
  width: 400px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}
</style>
