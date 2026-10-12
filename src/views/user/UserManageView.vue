<template>
  <a-card title="用户管理">
    <template #extra>
      <a-button type="primary" @click="openAdd">
        <UserAddOutlined />
        新增用户
      </a-button>
    </template>

    <!-- 搜索：账号 / 昵称模糊，角色精确（"adm" 不该查到 "admin"） -->
    <a-form layout="inline" :model="query">
      <a-form-item label="账号">
        <a-input
          v-model:value="query.userAccount"
          placeholder="输入账号搜索"
          allow-clear
          style="width: 180px"
          @press-enter="handleSearch"
        />
      </a-form-item>
      <a-form-item label="昵称">
        <a-input
          v-model:value="query.userName"
          placeholder="输入昵称搜索"
          allow-clear
          style="width: 180px"
          @press-enter="handleSearch"
        />
      </a-form-item>
      <a-form-item label="角色">
        <a-select
          v-model:value="roleFilter"
          style="width: 120px"
          :options="roleFilterOptions"
        />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table
      row-key="id"
      table-layout="fixed"
      :columns="columns"
      :data-source="records"
      :loading="loading"
      :pagination="pagination"
      style="margin-top: 16px"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'userName'">
          <div class="user-cell">
            <a-avatar :src="record.userAvatar ?? undefined" :style="{ backgroundColor: avatarColor(record) }">
              {{ avatarText(record) }}
            </a-avatar>
            <div class="user-cell-text">
              <div class="user-cell-name">{{ record.userName || '-' }}</div>
              <div class="user-cell-id">id {{ shortId(record.id) }}</div>
            </div>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'userRole'">
          <a-tag :color="record.userRole === 'admin' ? 'gold' : 'blue'">
            {{ record.userRole === 'admin' ? '管理员' : '普通用户' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'userProfile'">
          <span class="ellipsis" :title="record.userProfile ?? ''">{{ record.userProfile || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ formatDateTime(record.createTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <!--
              删自己不显示删除按钮：后端有护栏（管理员不能删自己），
              但把按钮摆在那里让人点了才被拒，是很差的交互
            -->
            <a-tooltip :title="isSelf(record) ? '不能删除自己' : ''">
              <a-popconfirm
                title="确定删除这个用户？"
                ok-text="删除"
                cancel-text="取消"
                :disabled="isSelf(record)"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger :disabled="isSelf(record)">删除</a-button>
              </a-popconfirm>
            </a-tooltip>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增 / 编辑共用一个弹窗：字段重合度高，两套表单只会慢慢长歪 -->
    <a-modal
      v-model:open="modalOpen"
      :title="isEdit ? '编辑用户' : '新增用户'"
      :confirm-loading="submitting"
      @ok="handleSubmit"
    >
      <a-form layout="vertical" :model="form">
        <a-form-item label="账号" required>
          <!-- 账号是登录凭据：后端 update DTO 刻意不含它，编辑时只读展示 -->
          <a-input
            v-model:value="form.userAccount"
            :disabled="isEdit"
            :maxlength="20"
            placeholder="4-20 位字母 / 数字 / 下划线"
          />
          <div v-if="isEdit" class="form-hint">
            账号是登录凭据，不支持修改（改了本人就登不上了）
          </div>
        </a-form-item>
        <a-form-item v-if="!isEdit" label="密码" required>
          <a-input-password
            v-model:value="form.userPassword"
            :maxlength="32"
            placeholder="明文提交，后端加密后落库"
          />
        </a-form-item>
        <a-form-item label="昵称">
          <a-input v-model:value="form.userName" :maxlength="20" placeholder="不填默认取账号" />
        </a-form-item>
        <a-form-item label="角色">
          <a-radio-group v-model:value="form.userRole">
            <a-radio value="user">普通用户</a-radio>
            <a-radio value="admin">管理员</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="头像 URL">
          <a-input v-model:value="form.userAvatar" :maxlength="512" placeholder="可空" />
        </a-form-item>
        <a-form-item label="简介">
          <a-textarea
            v-model:value="form.userProfile"
            :rows="3"
            :maxlength="200"
            show-count
            placeholder="可空"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, type TableProps } from 'ant-design-vue'
import { UserAddOutlined } from '@ant-design/icons-vue'

import { useUserStore } from '@/stores/user'
import { formatDateTime } from '@/utils/datetime'
import {
  listUserByPage,
  userAdd,
  userDelete,
  userUpdate,
  type UserVO,
} from '@/api/user'

/**
 * 用户管理（管理员专属，后端每个接口都先 checkAdminUser）。
 *
 * <p>设计上刻意与「图片管理」保持同一套骨架：卡片 + inline 搜索表单 + fixed 布局表格 +
 * 分页 + 新增/编辑共用弹窗。同一项目里两种风格的列表页，是纯粹的认知负担。
 */
const userStore = useUserStore()

const loading = ref(false)
const records = ref<UserVO[]>([])
const total = ref(0)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  userAccount: '',
  userName: '',
})

/**
 * 角色筛选：空串 = 全部。
 * 后端按 eq 精确匹配，所以「全部」不能传空串（会被拼成 user_role = ''）—— 要翻译成 undefined。
 */
const roleFilter = ref<string>('')
const roleFilterOptions = [
  { label: '全部', value: '' },
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
]

/** 列宽一律显式 + table-layout="fixed"：理由同图片管理（否则表底永远挂横向滚动条） */
const columns: TableProps['columns'] = [
  { title: '用户', dataIndex: 'userName', width: 220 },
  { title: '账号', dataIndex: 'userAccount', ellipsis: true, width: 160 },
  { title: '角色', dataIndex: 'userRole', width: 110 },
  { title: '简介', dataIndex: 'userProfile', ellipsis: true, width: 220 },
  { title: '注册时间', dataIndex: 'createTime', width: 170 },
  { title: '操作', dataIndex: 'action', width: 130 },
]

const pagination = computed(() => ({
  current: query.pageNum,
  pageSize: query.pageSize,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['5', '10', '20'],
  showTotal: (t: number) => `共 ${t} 条`,
}))

async function load() {
  loading.value = true
  try {
    const page = await listUserByPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userAccount: query.userAccount.trim() || undefined,
      userName: query.userName.trim() || undefined,
      // 「全部」不能传空串：后端 eq 匹配会拼出 user_role = ''，什么都查不到
      userRole: roleFilter.value || undefined,
    })
    records.value = page.records ?? []
    total.value = Number(page.total ?? 0)
  } catch {
    records.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.pageNum = 1
  load()
}

function handleReset() {
  query.userAccount = ''
  query.userName = ''
  roleFilter.value = ''
  query.pageNum = 1
  load()
}

const handleTableChange: TableProps['onChange'] = (pag) => {
  query.pageNum = pag.current ?? 1
  query.pageSize = pag.pageSize ?? 10
  load()
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const isEdit = ref(false)
const submitting = ref(false)

/** 表单字段是「新增 + 编辑」的并集；编辑提交时不带账号和密码（后端也不收） */
const form = reactive({
  id: '',
  userAccount: '',
  userPassword: '',
  userName: '',
  userRole: 'user' as string,
  userAvatar: '',
  userProfile: '',
})

function resetForm() {
  form.id = ''
  form.userAccount = ''
  form.userPassword = ''
  form.userName = ''
  form.userRole = 'user'
  form.userAvatar = ''
  form.userProfile = ''
}

function openAdd() {
  resetForm()
  isEdit.value = false
  modalOpen.value = true
}

function openEdit(record: UserVO) {
  resetForm()
  isEdit.value = true
  form.id = record.id ?? ''
  form.userAccount = record.userAccount ?? ''
  form.userName = record.userName ?? ''
  form.userRole = record.userRole ?? 'user'
  form.userAvatar = record.userAvatar ?? ''
  form.userProfile = record.userProfile ?? ''
  modalOpen.value = true
}

async function handleSubmit() {
  const account = form.userAccount.trim()
  if (!isEdit.value) {
    // 前置校验只为少一次往返；权威校验在后端（手写校验是项目约定）
    if (!account || !form.userPassword.trim()) {
      message.warning('新增用户必须填账号和密码')
      return
    }
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await userUpdate({
        id: form.id,
        // 空字符串会被当成「改成一个空昵称」，所以清空一律传 undefined（= 不改这个字段）
        userName: form.userName.trim() || undefined,
        userRole: form.userRole,
        userAvatar: form.userAvatar.trim() || undefined,
        userProfile: form.userProfile.trim() || undefined,
      })
      message.success('修改成功')
      // 改的是自己 → 角色/昵称可能变了，刷新登录态，免得顶栏还显示旧身份
      if (isSelf({ id: form.id } as UserVO)) {
        await userStore.fetchLoginUser()
      }
    } else {
      await userAdd({
        userAccount: account,
        userPassword: form.userPassword,
        userName: form.userName.trim() || undefined,
        userRole: form.userRole,
        userAvatar: form.userAvatar.trim() || undefined,
        userProfile: form.userProfile.trim() || undefined,
      })
      message.success('新增成功')
    }
    modalOpen.value = false
    await load()
  } catch {
    // 拦截器已提示（账号重复 / 账号格式 / 无权限等）
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
async function handleDelete(record: UserVO) {
  if (!record.id) return
  try {
    await userDelete(record.id)
    message.success('删除成功')
    // 删掉的是当前页最后一条时回退一页，否则会停在空页上
    if (records.value.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1
    }
    await load()
  } catch {
    // 拦截器已提示
  }
}

// ---- 显示小工具 ----
const isSelf = (record: UserVO) => !!record.id && record.id === userStore.loginUser?.id

/** 雪花 id 太长，列表里截尾展示（定位够用，完整值在详情/接口里） */
function shortId(id?: string) {
  return id ? `…${id.slice(-6)}` : '-'
}

function avatarText(record: UserVO) {
  const name = (record.userName || record.userAccount || '?').trim()
  const first = name.charAt(0)
  return /^[a-z]$/.test(first) ? first.toUpperCase() : first
}

const avatarColor = (record: UserVO) => (record.userRole === 'admin' ? '#fa8c16' : '#1677ff')

onMounted(load)
</script>

<style scoped>
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-cell-text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.user-cell-name {
  font-size: 14px;
  color: rgb(0 0 0 / 88%);
}

.user-cell-id {
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}

.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgb(0 0 0 / 45%);
}
</style>
