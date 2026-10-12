/**
 * 调色板的读取工具。库里存的是 **JSON 数组字符串**，形如：
 * `[{"color":"#FDF9FB","ratio":76,"family":"white"},{"color":"#338CFD","ratio":24,"family":"blue"}]`
 *
 * <p>后端契约：筛选条件是「调色板里任意一条主色落在该色系」
 * （SQL 侧 `JSON_CONTAINS(picPalette, '"blue"', '$[*].family')`），
 * 所以这个 JSON 是**筛选的依据**、不只是展示字段。
 *
 * <p>为什么收敛到一个函数：详情页、后续的卡片悬浮色条等多处都要读它；
 * 抄几份的结果是「某处没做容错，遇到脏数据整页崩」。容错是必需的 ——
 * 老图（本功能上线前上传的）这一列是 null，长度上限也意味着理论上可能被截断。
 *
 * <p>解析原则：**解析不了就当没有**（返回空数组），绝不抛异常。
 */

export interface PaletteColor {
  /** #RRGGBB 大写 */
  color: string
  /** 占采样像素的百分比（0~100，求和不一定等于 100，低于门槛的已被后端丢掉） */
  ratio: number
  /** 色系（white/black/red/orange/yellow/green/cyan/blue/purple/brown） */
  family: string
}

export function parsePalette(raw?: string | null): PaletteColor[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.color === 'string')
      .map((item) => ({
        color: String(item.color),
        // ratio 缺失/非数字时给 0：展示成「-」比展示成 NaN 好
        ratio: Number.isFinite(Number(item.ratio)) ? Number(item.ratio) : 0,
        family: typeof item.family === 'string' ? item.family : '',
      }))
  } catch {
    return []
  }
}

/** 色系的中文名（详情页色条下的小字 / 悬浮提示用，与主页色板文案保持一致） */
export const COLOR_FAMILY_NAMES: Record<string, string> = {
  black: '黑色',
  white: '白色',
  red: '红色',
  orange: '橙色',
  yellow: '黄色',
  green: '绿色',
  cyan: '青色',
  blue: '蓝色',
  purple: '紫色',
  brown: '棕色',
}
