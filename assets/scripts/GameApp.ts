import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { Img } from './core/Assets';
import { GameState } from './core/GameState';
import { DH, DW, sleep } from './core/UITheme';
import { chapter1Steps, openingSteps } from './story/Script';
import { Ctx, runSteps } from './story/Runner';
import { ChoiceView } from './ui/ChoiceView';
import { DialogView } from './ui/DialogView';
import { Hud } from './ui/Hud';
import { Overlay } from './ui/Overlay';
import { PhoneView } from './ui/PhoneView';
import { PopupView } from './ui/PopupView';
import { Portraits } from './ui/Portraits';
import { SceneView } from './ui/SceneView';
import { ShoppingListView } from './ui/ShoppingListView';
import { SleepRoomView } from './ui/SleepRoomView';
import { TaskBar } from './ui/TaskBar';
import { ThoughtView } from './ui/ThoughtView';

const { ccclass } = _decorator;

/** 游戏入口：构建全部 UI 层并运行剧情 */
@ccclass('GameApp')
export class GameApp extends Component {
    async onLoad(): Promise<void> {
        // 竖屏设计：高度优先，宽屏设备两侧留边
        view.setDesignResolutionSize(DW, DH, ResolutionPolicy.FIXED_HEIGHT);

        GameState.load();
        await Img.loadAll();

        const root = this.node;
        const rt = root.getComponent(UITransform) || root.addComponent(UITransform);
        rt.setContentSize(DW, DH);
        root.setPosition(0, 0);

        // 自下而上：场景 < 立绘 < 对白 < 选项 < 任务卡 < HUD < 手机 < 弹窗 < 气泡 < 过场
        const scene = new SceneView(root);
        const portraits = new Portraits(root);
        const dialog = new DialogView(root, this);
        const choices = new ChoiceView(root);
        const taskbar = new TaskBar(root);
        // 睡眠区/购物清单小游戏在任务卡之上、HUD 之下（保留孕周徽章）
        const sleepRoom = new SleepRoomView(root);
        const shoppingList = new ShoppingListView(root);
        const hud = new Hud(root);
        const phone = new PhoneView(root);
        const popup = new PopupView(root);
        const thought = new ThoughtView(root);
        const overlay = new Overlay(root);

        const ctx: Ctx = { dialog, portraits, choices, thought, popup, scene, taskbar, hud, phone, overlay };
        (window as unknown as Record<string, unknown>).__sleepRoom = sleepRoom;
        (window as unknown as Record<string, unknown>).__shoppingList = shoppingList;

        // 任务卡点击：购物清单为分类拖拽小游戏；布置安全睡眠区进入拖拽小游戏；尿布台本期跳过，直接完成
        taskbar.onTask = async (id) => {
            if (id === 'list') {
                await shoppingList.play();
            } else if (id === 'sleep') {
                await sleepRoom.play();
            } else {
                await sleep(300);
            }
            taskbar.markDone(id);
        };

        this.runStory(ctx);
    }

    private async runStory(ctx: Ctx): Promise<void> {
        try {
            await runSteps(ctx, openingSteps());
            await runSteps(ctx, chapter1Steps());
        } catch (e) {
            console.error('[story] 剧情执行出错:', e);
        }
    }
}
