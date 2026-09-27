<template>
  <div class="register-page">
    <a-card class="register-card" title="云图库 · 用户注册">
      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-form-item label="账号" name="userAccount">
          <a-input v-model:value="formState.userAccount" placeholder="4-20 位，不含特殊字符" allow-clear />
        </a-form-item>

        <a-form-item label="密码" name="userPassword">
          <a-input-password v-model:value="formState.userPassword" placeholder="至少 8 位" />
        </a-form-item>

        <a-form-item label="确认密码" name="checkPassword">
          <a-input-password v-model:value="formState.checkPassword" placeholder="再输入一次密码" />
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" html-type="submit" :loading="submitting">注册</a-button>
            <a-button @click="router.push('/user/login')">返回登录</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'

import { register, type RegisterParams } from '@/api/user'

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const formState = reactive<RegisterParams>({
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})

/**
 * 前端只挡「明显不合法」，真正的校验永远在后端（UserServiceImpl#userRegister）。
 * 两边规则保持一致是为了体验（少一次往返），不是为了安全 —— 前端校验可以被绕过。
 */
const rules: Record<string, Rule[]> = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, max: 20, message: '账号长度为 4-20 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不少于 8 位', trigger: 'blur' },
  ],
  checkPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (value && value !== formState.userPassword) {
          return Promise.reject('两次输入的密码不一致')
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

async function handleSubmit() {
  submitting.value = true
  try {
    await register({ ...formState })
    message.success('注册成功，请登录')
    await router.push('/user/login')
  } catch {
    // 错误提示由 axios 拦截器统一弹出，这里不重复
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.register-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f0f2f5;
}

.register-card {
  width: 400px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}
</style>
