---
name: game-art
description: 生图/替换游戏缺失或占位的美术资源（道具图标、场景图）。当 Assets.ts 里有清单 key 没有图片文件、或游戏里出现文字占位图标时使用。用 qwen-image API 按项目风格生成，抠底归一化后接入项目。
---

# Game Art Generation（qwen-image API）

## 何时用

- `assets/scripts/core/Assets.ts` 的 MANIFEST 里有 key 但没有对应 png（游戏里显示「首字占位」方块图标）。
- 需要新道具/新图标，但设计稿里没有。

## 资源约定

| 类型 | 目录 | 规格 |
|---|---|---|
| 道具图标 | `assets/resources/img/prop/` | 100×100 透明 PNG，内容最大边 ≈88px（四周留白） |
| 场景图 | `assets/resources/img/scene/` | 750×1624 全屏图（= 设计稿房间切片 4x → 缩放一半） |
| 清单 | `assets/scripts/core/Assets.ts` | `MANIFEST: key -> 'img/prop/name'`，缺失的 key 自动走 `Img.icon` 首字占位，不会崩 |

## 1. 先查缺了哪些

```bash
python3 - <<'EOF'
import re, os
src = open('assets/scripts/core/Assets.ts').read()
body = re.search(r'const MANIFEST: Record<string, string> = \{(.*?)\n\};', src, re.S).group(1)
for key, path in re.findall(r"(\w+):\s*'([^']+)'", body):
    if not any(os.path.exists(f'assets/resources/{path}{ext}') for ext in ('.png', '.jpg')):
        print('MISSING:', key, '->', path)
EOF
```

## 2. 调 API 生图

- 端点：`POST https://maas.qianwenaiapi.com/api/v1/services/aigc/multimodal-generation/generation`
- 模型：`qwen-image-3.0`，`size: "1024*1024"`
- Key：`temp/art-gen/key.txt`（gitignored，用户提供；不存在时问用户要）
- 响应里 `output.choices[0].message.content[0].image` 是图片 URL（**会过期，立即下载**）

```bash
export DASHSCOPE_API_KEY=$(cat temp/art-gen/key.txt)
curl -s --max-time 180 --location 'https://maas.qianwenaiapi.com/api/v1/services/aigc/multimodal-generation/generation' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $DASHSCOPE_API_KEY" \
  --data '{
    "model": "qwen-image-3.0",
    "input": {"messages": [{"role": "user", "content": [{"text": "<提示词>"}]}]},
    "parameters": {"prompt_extend": false, "watermark": false, "size": "1024*1024"}
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['output']['choices'][0]['message']['content'][0]['image'])"
```

## 3. 提示词风格模板（重要）

本项目风格：**粉白奶油色系、软萌插画、心形装饰、圆润造型、清晰描边、正视图**。

模板（把 `<物品描述>` 替换掉）：

```text
一个可爱的婴儿<物品描述>图标，粉白配色，物品上有一个粉色小爱心图案，正视图，
柔和的软萌插画风格，清晰的轮廓线，圆角造型，粉色白色奶油色配色，
物品完整居中，四周留白，纯白色背景，物品悬浮不接触地面，没有任何阴影和投影，
适合手机游戏道具图标，正方形构图
```

已验证的实例（第一章尿布台补充的三件）：

- 爽身粉：`一个可爱的婴儿爽身粉罐图标，圆润的矮圆柱形罐身，粉白柔和配色，罐盖为浅粉色，盖顶印有一个粉色小爱心图案，罐身中间有浅粉色装饰带…`
- 热水杯：`一个可爱的保温杯图标，圆润的杯身，粉白配色，杯身印有一个粉色小爱心图案，杯口上方有两缕柔和的白色热气，杯把朝右…`
- 护臀膏：`一支可爱的婴儿护臀膏软管图标，圆润的软管包装，粉白配色，浅粉色翻盖瓶盖，管身正面印有一个粉色小爱心图案，竖直摆放…`

**陷阱**：不要用粉色背景（`淡粉色背景`）生图——物品的浅色高光与粉色背景接近，抠图会从抗锯齿边缘漏进去，出现半透明破洞。**白底 + 清晰描边**最稳。

## 4. 抠底 + 归一化

用本 skill 自带脚本（先下载生图到临时目录）：

```bash
curl -s -o /tmp/gen.png "<图片URL>"
python3 .agents/skills/game-art/scripts/key_and_pack.py /tmp/gen.png assets/resources/img/prop/<name>.png
```

脚本逻辑：边缘泛洪去白底 → 用高置信区域 bbox 清掉框外低对比残影（阴影）→ 内容缩放至最大边 88px → 居中放入 100×100 透明画布。

**必须放大 3 倍目检**：白底图里奶油色物体与白底接近，泛洪容差过大或过小都会出问题（破洞 / 残留边）。有破洞就调小 `--tol`，边脏就调大。

## 5. 接入 + 验证

1. `Assets.ts` MANIFEST 里加 key（若还没加）。
2. `./scripts/build-web.sh`（构建会把新图导入并把 dist 打进去，dist 要提交）。
3. 预览验证：`cd dist && python3 -m http.server 8931` → playwright 打开，用调试入口直接看：
   - 尿布台：`window.__diaperStation.play()`，翻到对应页截图；
   - 购物清单：`window.__shoppingList.play()`；
   - 睡眠区：`window.__sleepRoom.play()` + `debugPlace('<key>')`。
4. 控制台应无 `[assets] 缺失素材:` 警告。

## 提交

与项目其余改动一致：`jj describe -m "..."` → `jj bookmark set main -r @` → `jj git push`（先删掉测试截图；dist 一并提交）。

Key 只放 `temp/art-gen/key.txt`，**永远不要提交到 git**。
