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

- Left sidebar tree lists groups: `开局-妈妈的名字` (7 screens), `第一章-宝宝的小窝` (12 screens).
- Click a group row (find the ref with `playwright-cli find "第一章"`) to filter the canvas to that group.
- Zoom control bottom-right: click `-`/`+`, or use keyboard. 33–48% is good for overview; the board does not scroll vertically with mousewheel — pan by dragging empty canvas space.
- Right-click zoom menu offers 放大/缩小/全览; press `Escape` to dismiss.
- Snapshot refs on this page are mostly generic divs; rely on screenshots (`playwright-cli screenshot --filename=x.png`) and `find` for text.

## Local copies

Downloaded design assets are already in the repo:

- `lanhu/screens/*.png` — full-size screen captures (19 screens)
- `lanhu/json/*.json` — lanhu metadata per screen
- `lanhu/screens.json`, `lanhu/json-urls.json` — indexes

Prefer reading these local files over scraping the site again.

## Screen inventory

开局 (7): 01 pink heart splash → 02 title 和你一起长大30天 → 03 name input → 04 supporter picker (6 options) → 05 supporter name → 06 baby name (with 暂时叫宝宝 alt) → 07 achievement 我们的故事开始了.

第一章 (12): 封1 crib line-art → 封2 crib colored → living-room dialogs (mom/dad, choice bubbles) → task bar (布置睡眠区/布置尿布台/查看购物清单) → sleep-room drag minigame (物品栏 5/5/2) → night scene → completion card → phone chapter-unlock card.
