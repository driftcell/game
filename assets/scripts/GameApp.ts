import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { Img } from './core/Assets';
import { GameState } from './core/GameState';
import { DH, DW, sleep } from './core/UITheme';
import { chapter1Steps, buildShoppingList, openingSteps } from './story/Script';
import { Ctx, runSteps } from './story/Runner';
import { ChoiceView } from './ui/ChoiceView';
import { DialogView } from './ui/DialogView';
import { Hud } from './ui/Hud';
import { Overlay } from './ui/Overlay';
import { PhoneView } from './ui/PhoneView';
import { PopupView } from './ui/PopupView';
import { Portraits } from './ui/Portraits';
import { SceneView } from './ui/SceneView';
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

        // 自下而上：场景 < 立绘 < 对白 < 选项 < 任务卡 < HUD < 手机 < 弹窗 < 过场
        const scene = new SceneView(root);
        const portraits = new Portraits(root);
        const dialog = new DialogView(root, this);
        const choices = new ChoiceView(root);
        const taskbar = new TaskBar(root);
        const hud = new Hud(root);
        const phone = new PhoneView(root);
        const popup = new PopupView(root);
        const overlay = new Overlay(root);
        const thought = new ThoughtView(root);

        const ctx: Ctx = { dialog, portraits, choices, thought, popup, scene, taskbar, hud, phone, overlay };

        // 任务卡点击：购物清单弹窗；布置类小游戏本期跳过，直接完成
        taskbar.onTask = async (id) => {
            if (id === 'list') {
                await popup.custom({
                    title: '购物清单',
                    height: 780,
                    build: (content) => buildShoppingList(content),
                    buttons: [{ label: '收好了', value: 'ok', primary: true }],
                });
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
