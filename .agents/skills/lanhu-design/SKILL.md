---
name: lanhu-design
description: Open and inspect the 蓝湖 (lanhuapp) design boards for this game. Use when comparing game screens against design specs or extracting design assets.
allowed-tools: Bash(playwright-cli:*)
---

# Lanhu Design Board

## Open

The project design lives at lanhuapp (login state persists in the default playwright-cli browser profile):

```bash
playwright-cli tab-list   # design board is usually already open
# otherwise:
playwright-cli tab-new "https://lanhuapp.com/web/#/item/project/stage?pid=bf499b6d-66c6-4995-b3a2-4bc367c48557&image_id=cc69a82d-2886-438a-a77d-b77f28926eca&tid=b1f24129-b2f4-4579-9b62-03ba60d3592a"
```

## Navigate the board

- Left sidebar tree lists groups: `开局-妈妈的名字` (7 screens), `第一章-宝宝的小窝` (15 screens), `第二章-准备待产` (6 screens).
- Click a group row (find the ref with `playwright-cli find "第一章"`) to filter the canvas to that group.
- Zoom control bottom-right: click `-`/`+`, or use keyboard. 33–48% is good for overview; the board does not scroll vertically with mousewheel — pan by dragging empty canvas space.
- Right-click zoom menu offers 放大/缩小/全览; press `Escape` to dismiss.
- Snapshot refs on this page are mostly generic divs; rely on screenshots (`playwright-cli screenshot --filename=x.png`) and `find` for text.

## Local copies

Downloaded design assets are already in the repo:

- `lanhu/screens/*.png` — full-size screen captures (28 screens, 750×1702 @2x)
- `lanhu/json/*.json` — lanhu metadata per screen (latest versions)
- `lanhu/screens.json`, `lanhu/json-urls.json` — indexes

Marked slices (切图) and embedded bitmaps are exported separately to `~/Downloads/lanhu-export-<date>/`:
`设计稿/` (screens), `切图/标记切图/<screen>/` (@4x PNG + SVG), `切图/内嵌图片/<screen>/` (@1x), `json/`, `manifest.json`.
Re-export script: `temp/lanhu-export/download.py`. Refresh flow when the board updates:

1. `playwright-cli state-save temp/lanhu-export/state.json` (cookies for curl/fetch).
2. Fetch `/api/project/images?project_id=bf499b6d-...&team_id=b1f24129-...` → screen list.
3. Per screen: `/api/project/image?dds_status=1&image_id=<id>&team_id=...&project_id=...` → `result.versions[0]` has `url` (SketchCover, the screen PNG) and `json_url` (SketchJSONURL, the layer JSON).
4. Write `temp/lanhu-export/meta.json` (id, name, x, y, w, h, url, json_url, version, update_time), then `python3 temp/lanhu-export/download.py`.

Note: slice layer names are sometimes stale (components copied across screens — e.g. ch2 item icons are named 婴儿床/床垫/枕头/被子/床围 but actually contain 证件/文档/衣物/洗漱/充电器 icons). Always view the files before wiring them in.

Prefer reading these local files over scraping the site again.

## Screen inventory

开局 (7): 01 pink heart splash → 02 title 和你一起长大30天 → 03 name input → 04 supporter picker (6 options) → 05 supporter name → 06 baby name (with 暂时叫宝宝 alt) → 07 achievement 我们的故事开始了.

第一章 (15): 封1 crib line-art → 封2 crib colored → 还没准备好的家1–4 (living-room dialogs, mom/dad bubbles, task bar 布置睡眠区/布置尿布台/查看购物清单) → 布置安全睡眠区1–6 (drag minigame 物品栏 5/5/2 + night scenes) → 布置安尿布台 → 章节衔接 · 章节衔接2 (night room + 爸爸 dialog → completion card 今天完成3件 + 小智 tip).

第二章 (6, 2026-10-16 新增): 为生产做准备 · 为生产做准备2 (chapter covers 线稿→上色, 行李箱+宝宝鞋, 孕39周+1天) → 准备待产包-1 (bedroom day scene + suitcases + boxes, mom dialog 这几天可能随时会发动了，我们来收拾待产包吧) → 准备待产包-2 (包裹装箱 minigame: popup 待产包 拖动物品装箱, open suitcase 必要/可选 compartments, 确认 button, 物品栏 page 1 = 证件和保险信息/生产偏好文档/妈妈出院衣物/洗漱用品/充电器, arrows + 2 dots) → 准备待产包-3 (bedroom + bottom sheet 妈妈心里想 A/B/C inner-thought choices) → 准备待产包-4 (我的生产偏好 form: 环境偏好/支持人员/活动与体位/疼痛管理/医疗沟通/出生后/若需剖宫产 accordions + 保存到待产包 button).
