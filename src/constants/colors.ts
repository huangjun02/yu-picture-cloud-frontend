/**
 * 颜色筛选的预设色板。
 *
 * <p><b>色板值不是「要精确匹配的色」，而是「要归到哪个色系的入口」</b>：
 * 后端把请求色归类成色系（white/red/blue…），再按色系等值匹配库里的
 * `picColorFamily`。原因：图片主色是连续空间里的具体值（#FDF9FB「近似白」），
 * 色板是离散标准色（#FFFFFF）——直接比色值几乎永远对不上，用户点「白色」
 * 一张都筛不出来；归类成色系后「点白色 = 看所有偏白的图」，符合直觉。
 *
 * <p>⚠️ 因此色板取值本身必须能归回它代表的色系（后端 `everyPaletteColorShouldClassifyBackToItsOwnFamily`
 * 用例钉住了这条不变式）—— 踩过的坑：棕色原来写的 #8B4513 亮度偏高，会被归成橙色，
 * 点「棕色」实际查的是橙色图。改色板值前先跑那个用例。
 *
 * <p>为什么是离散预设而不是自由取色/从数据收候选：色系空间是连续+无穷的，
 * 自由取色等于每次都落在一个没人用过的桶里；从数据收候选则是一长串近乎重复的色块，
 * 没有可点性。预设 10 色与后端 10 个色系一一对应。
 */
export const PRESET_COLORS: { value: string; name: string }[] = [
  { value: '#000000', name: '黑色' },
  { value: '#FFFFFF', name: '白色' },
  { value: '#E74C3C', name: '红色' },
  { value: '#E67E22', name: '橙色' },
  { value: '#F1C40F', name: '黄色' },
  { value: '#2ECC71', name: '绿色' },
  { value: '#1ABC9C', name: '青色' },
  { value: '#1677FF', name: '蓝色' },
  { value: '#9B59B6', name: '紫色' },
  { value: '#5C3317', name: '棕色' },
]
