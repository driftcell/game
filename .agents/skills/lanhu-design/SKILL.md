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

- Left sidebar tree lists groups: `开局-妈妈的名字` (7 screens), `第一章-宝宝的小窝` (15 screens).
- Click a group row (find the ref with `playwright-cli find "第一章"`) to filter the canvas to that group.
- Zoom control bottom-right: click `-`/`+`, or use keyboard. 33–48% is good for overview; the board does not scroll vertically with mousewheel — pan by dragging empty canvas space.
- Right-click zoom menu offers 放大/缩小/全览; press `Escape` to dismiss.
- Snapshot refs on this page are mostly generic divs; rely on screenshots (`playwright-cli screenshot --filename=x.png`) and `find` for text.

## Local copies

Downloaded design assets are already in the repo:

- `lanhu/screens/*.png` — full-size screen captures (22 screens, 750×1702 @2x)
- `lanhu/json/*.json` — lanhu metadata per screen (latest versions)
- `lanhu/screens.json`, `lanhu/json-urls.json` — indexes

Marked slices (切图) and embedded bitmaps are exported separately to `~/Downloads/lanhu-export-<date>/`:
`设计稿/` (screens), `切图/标记切图/<screen>/` (@4x PNG + SVG), `切图/内嵌图片/<screen>/` (@1x), `json/`, `manifest.json`.
Re-export script: `temp/lanhu-export/download.py` (metadata via the in-page API `/api/project/images` and `/api/project/image?image_id=...`).

Prefer reading these local files over scraping the site again.

## Screen inventory

开局 (7): 01 pink heart splash → 02 title 和你一起长大30天 → 03 name input → 04 supporter picker (6 options) → 05 supporter name → 06 baby name (with 暂时叫宝宝 alt) → 07 achievement 我们的故事开始了.

第一章 (15): 封1 crib line-art → 封2 crib colored → 还没准备好的家1–4 (living-room dialogs, mom/dad bubbles, task bar 布置睡眠区/布置尿布台/查看购物清单) → 布置安全睡眠区1–6 (drag minigame 物品栏 5/5/2 + night scenes) → 布置安尿布台 → 章节衔接 · 章节衔接2 (night room + 爸爸 dialog → completion card 今天完成3件 + 小智 tip).
