---
name: cocos-game
description: Build, preview, and debug this Cocos Creator 3.8.8 game project (和你一起长大30天). Use when compiling the game, running the browser preview, verifying UI against designs, or testing drag-and-drop interactions.
allowed-tools: Bash Cocos_*
---

# Cocos Game Development

Project: `/Users/driftcell/Projects/game`, Cocos Creator **3.8.8**, portrait design resolution **750x1624** (`FIXED_HEIGHT`).

## Build (compile game)

Always use the repo script — it builds the **web-mobile** platform directly into `dist/` (full-screen canvas):

```bash
./scripts/build-web.sh
```

Never build `web-desktop` for `dist/`: its template hard-codes a fixed 1280x960 canvas, which shows as a blank pink screen on phones (this exact regression shipped once). Build takes ~3s incremental, ~27s cold. All TypeScript errors from `run_script_diagnostics` pointing to engine `cc.d.ts`/`jsb.d.ts` are pre-existing noise — only care about errors under `assets/scripts/`.

Local verification: `cd dist && python3 -m http.server 8931`, open with `playwright-cli open --mobile http://localhost:8931`.

### Sprite sizing trap (whiteSF)

`addComponent(Sprite)` defaults to `sizeMode = TRIMMED`; assigning `whiteSF()` (1x1) then silently shrinks the node to 1x1. Always set `sp.sizeMode = Sprite.SizeMode.CUSTOM` before assigning a spriteFrame. `Img.sprite()` already does this; raw `addComponent(Sprite)` call sites must do it manually.

### EditBox traps (PopupView.input)

- The engine creates a `<textarea>` (not `<input>`) because `_inputMode` defaults to `ANY` at `addComponent` time; setting `SINGLE_LINE` afterwards does not recreate the DOM. Use `el.style.lineHeight = '88px'` on `.cocosEditBox` to vertically center the edited line.
- EditBox auto-creates its own `TEXT_LABEL`/`PLACEHOLDER_LABEL` nodes; assigning custom `textLabel`/`placeholderLabel` leaves the old nodes active (white text floating in the corner) — destroy them after assigning.
- textLabel/placeholderLabel need anchor `(0,1)`; use `labelInBox` (Overflow.CLAMP), not `label()` (Overflow.NONE ignores vAlign and top-aligns text).

## Preview

- Browser preview URL: `http://localhost:7456/` (started from the Cocos editor play button).
- The preview always starts the story from the beginning; there is no checkpoint system.
- The editor MCP server: `http://127.0.0.1:8765` (see opencode.json), tools prefixed `Cocos_`.
- Useful MCP tools: `Cocos_get_project_info`, `Cocos_open_scene`, `Cocos_execute_javascript` (context `editor` or `scene`), `Cocos_run_script_diagnostics`.
- After editing a script, refresh so the preview picks it up:

```js
// Cocos_execute_javascript context=editor
await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/scripts/ui/SleepRoomView.ts');
```

then `playwright-cli reload` the preview tab.

## Game structure

- Entry: `assets/scripts/GameApp.ts` (component on `Canvas/GameApp` node in `assets/Main.scene`).
- Story DSL: `assets/scripts/story/Script.ts` (steps) + `Runner.ts` (interpreter). Steps: `dialog | choices | scene | badge | achieve | ui`.
- Views in `assets/scripts/ui/`: SceneView, Portraits, DialogView (typewriter), ChoiceView, TaskBar, SleepRoomView (drag minigame), Hud, PhoneView, PopupView, Overlay (fades/covers), ThoughtView.
- **Z-order = construction order in GameApp.onLoad.** ThoughtView must stay before Overlay so fade transitions cover thought bubbles.
- Assets manifest: `assets/scripts/core/Assets.ts` (`Img.sprite(parent, key, width, x, y)`); images under `assets/resources/img/{splash,scene,char,prop,ui,task}/`.
- Save data: `localStorage` key `growup30.profile.v1` (profile only, no mid-chapter checkpoint).

## Testing interactions with playwright-cli

Viewport 480x900 works well: `playwright-cli resize 480 900`.

Canvas coordinate mapping (web-mobile build, viewport 480x900, canvas fills it, scale = 900/1624 ≈ 0.5542, center (240, 450)):

```js
// game (gx, gy, center-origin, y-up) -> client (x, y):
x = 240 + gx * 0.5542
y = 450 - gy * 0.5542
```

State polling beats fixed timing for fast-forwarding (typewriter speed varies). Check `Canvas/GameApp/{dialog,choices,taskbar,sleeproom,popup}` node `.active`, click dialog when active, stop when choices/taskbar appear.

### Drag-and-drop (SleepRoomView)

**Critical:** releasing the mouse *outside* the bottom item panel makes Cocos fire `TOUCH_CANCEL`, not `TOUCH_END`. `SleepRoomView.onCancel` handles the drop for this case — do not regress this.

To drag item card N on page 1 (cards centered ~y=704 in client coords, x ≈ 114, 172, 240, 318, 386...):

```bash
playwright-cli mousemove 114 704 && playwright-cli mousedown
playwright-cli mousemove 114 550   # move up first — vertical motion selects 'drag' mode
playwright-cli mousemove 329 300   # into the room
playwright-cli mouseup
```

Horizontal swipe on the panel switches item pages (12 items, pages of 5/5/2).

Debug shortcut: `window.__sleepRoom.debugPlace('crib'|'mattress'|'sleep_bag'|'socks'|'basket'|'night_light')` places a safe item without dragging (exposed in GameApp.onLoad).

### Fast-forward through the opening

```js
// playwright-cli run-code
async page => {
  const click = async (x, y) => { await page.mouse.click(x, y); await new Promise(r => setTimeout(r, 600)); };
  await new Promise(r => setTimeout(r, 2500)); // title
  await click(240, 500);                       // dialog
  await click(240, 515);                       // name 确定
  await click(240, 500);                       // dialog
  await click(240, 622);                       // supporter pick 确定
  await click(240, 515);                       // supporter name 确定
  await click(240, 500);                       // dialog
  await click(240, 505);                       // baby name 确定
  await click(240, 500);                       // dialog
  await click(240, 500);                       // achievement
  await new Promise(r => setTimeout(r, 2000));
  await click(240, 500);                       // chapter cover
  // ... chapter 1 dialogs, then choices at y≈645/700/755
}
```

## Commit workflow (jj)

```bash
rm -f *.png          # remove test screenshots first
jj describe -m "..." # describe the working-copy change
jj bookmark set main -r @
jj git push          # pushes to origin (github.com:driftcell/game.git)
```
