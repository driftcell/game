import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { Img } from './core/Assets';
import { GameState } from './core/GameState';
import { SaveManager } from './core/SaveManager';
import { DH, DW } from './core/UITheme';
import { SEGMENTS } from './story/Script';
import { Ctx, runSteps } from './story/Runner';
import { ChoiceView } from './ui/ChoiceView';
import { DiaperStationView } from './ui/DiaperStationView';
import { DialogView } from './ui/DialogView';
import { Hud } from './ui/Hud';
import { Overlay } from './ui/Overlay';
import { PhoneView } from './ui/PhoneView';
import { PopupView } from './ui/PopupView';
import { Portraits } from './ui/Portraits';
import { SaveMenuView } from './ui/SaveMenuView';
import { SceneView } from './ui/SceneView';
import { ShoppingListView } from './ui/ShoppingListView';
import { SleepRoomView } from './ui/SleepRoomView';
import { TaskBar } from './ui/TaskBar';
import { ThoughtView } from './ui/ThoughtView';

const { ccclass } = _decorator;

/** 游戏入口：构建全部 UI 层，标题屏 -> 存档菜单 -> 从断点运行剧情 */
@ccclass('GameApp')
export class GameApp extends Component {
    async onLoad(): Promise<void> {
        // 竖屏设计：高度优先，宽屏设备两侧留边
        view.setDesignResolutionSize(DW, DH, ResolutionPolicy.FIXED_HEIGHT);

        SaveManager.migrate();
        const g = SaveManager.global();
        GameState.achievements = g.achievements;
        GameState.badge = g.badge;
        GameState.persist = () => SaveManager.writeCurrent();
        await Img.loadAll();

        const root = this.node;
        const rt = root.getComponent(UITransform) || root.addComponent(UITransform);
        rt.setContentSize(DW, DH);
        root.setPosition(0, 0);

        // 自下而上：场景 < 立绘 < 对白 < 选项 < 任务卡 < 小游戏 < HUD < 手机 < 存档菜单 < 弹窗 < 气泡 < 过场
        const scene = new SceneView(root);
        const portraits = new Portraits(root);
        const dialog = new DialogView(root, this);
        const choices = new ChoiceView(root);
        const taskbar = new TaskBar(root);
        // 睡眠区/购物清单/尿布台小游戏在任务卡之上、HUD 之下（保留孕周徽章）
        const sleepRoom = new SleepRoomView(root);
        const shoppingList = new ShoppingListView(root);
        const diaperStation = new DiaperStationView(root);
        const hud = new Hud(root);
        const phone = new PhoneView(root);
        // 存档菜单在弹窗之下：删除/覆盖确认走 popup
        const saveMenu = new SaveMenuView(root);
        const popup = new PopupView(root);
        saveMenu.popup = popup;
        const thought = new ThoughtView(root);
        const overlay = new Overlay(root);

        const ctx: Ctx = { dialog, portraits, choices, thought, popup, scene, taskbar, hud, phone, overlay };
        (window as unknown as Record<string, unknown>).__sleepRoom = sleepRoom;
        (window as unknown as Record<string, unknown>).__shoppingList = shoppingList;
        (window as unknown as Record<string, unknown>).__diaperStation = diaperStation;
        (window as unknown as Record<string, unknown>).__save = SaveManager;

        // 任务卡点击：三个任务均为拖拽小游戏
        taskbar.onTask = async (id) => {
            if (id === 'list') {
                await shoppingList.play();
            } else if (id === 'sleep') {
                await sleepRoom.play();
            } else {
                await diaperStation.play();
            }
            taskbar.markDone(id);
        };

        this.runStory(ctx, saveMenu);
    }

    private async runStory(ctx: Ctx, saveMenu: SaveMenuView): Promise<void> {
        try {
            await ctx.overlay.titleScreen();
            const from = await this.bootMenu(saveMenu);
            let i = SEGMENTS.findIndex((s) => s.id === from);
            if (i < 0) i = 0;
            for (; i < SEGMENTS.length; i++) {
                const seg = SEGMENTS[i];
                // 进入段落即存档：中途退出从段落开头重跑
                SaveManager.currentCheckpoint = seg.id;
                SaveManager.currentLabel = seg.label;
                SaveManager.writeCurrent();
                await runSteps(ctx, seg.steps());
            }
        } catch (e) {
            console.error('[story] 剧情执行出错:', e);
        }
    }

    /** 标题后的存档流程，返回起始段落 id */
    private async bootMenu(saveMenu: SaveMenuView): Promise<string> {
        const saves = SaveManager.list();
        const has = saves.some(Boolean);
        if (!has) {
            // 首次游玩：直接新游戏进序幕
            SaveManager.slot = 0;
            GameState.reset();
            return 'opening';
        }
        const act = await saveMenu.mainMenu();
        if (act === 'continue') {
            const slot = await saveMenu.pickSlot('load');
            if (slot >= 0 && SaveManager.apply(slot)) {
                return SaveManager.currentCheckpoint;
            }
            return this.bootMenu(saveMenu);
        }
        // 新的故事：优先空槽，满了让玩家选槽覆盖
        const empty = saves.findIndex((s) => !s);
        if (empty >= 0) {
            SaveManager.slot = empty;
            GameState.reset();
            return 'opening';
        }
        const slot = await saveMenu.pickSlot('overwrite');
        if (slot >= 0) {
            SaveManager.remove(slot);
            SaveManager.slot = slot;
            GameState.reset();
            return 'opening';
        }
        return this.bootMenu(saveMenu);
    }
}
