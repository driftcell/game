import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { Img } from './core/Assets';
import { GameState } from './core/GameState';
import { SaveManager } from './core/SaveManager';
import { DH, DW } from './core/UITheme';
import { SEGMENTS, SLEEP_SAFETY_CARD, unlockedAreasThrough } from './story/Script';
import { Ctx, runSteps } from './story/Runner';
import { BagPackView } from './ui/BagPackView';
import { BottomNav } from './ui/BottomNav';
import type { NavTab } from './ui/BottomNav';
import { ChoiceView } from './ui/ChoiceView';
import { DiaperStationView } from './ui/DiaperStationView';
import { DialogView } from './ui/DialogView';
import { HouseView } from './ui/HouseView';
import { Hud } from './ui/Hud';
import { KnowledgeCardView } from './ui/KnowledgeCardView';
import { Overlay } from './ui/Overlay';
import { PhoneView } from './ui/PhoneView';
import { PopupView } from './ui/PopupView';
import { Portraits } from './ui/Portraits';
import { PrefsView } from './ui/PrefsView';
import { ProfileView } from './ui/ProfileView';
import { SaveMenuView } from './ui/SaveMenuView';
import { SceneView } from './ui/SceneView';
import { ShopView } from './ui/ShopView';
import { ShoppingListView } from './ui/ShoppingListView';
import { SleepRoomView } from './ui/SleepRoomView';
import { TaskBar } from './ui/TaskBar';
import { ThoughtView } from './ui/ThoughtView';
import { XiaozhiChatView } from './ui/XiaozhiChatView';

const { ccclass } = _decorator;

/** 游戏入口：构建全部 UI 层，标题屏 -> 存档菜单 -> 从断点运行剧情 */
@ccclass('GameApp')
export class GameApp extends Component {
    private house!: HouseView;
    private shop!: ShopView;
    private profile!: ProfileView;
    private nav!: BottomNav;

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

        // 自下而上：场景 < 立绘 < 对白 < 选项 < 任务卡 < 全屋 < 小游戏 < HUD < 手机 < 存档菜单 < 弹窗 < 气泡 < 过场
        const scene = new SceneView(root);
        const portraits = new Portraits(root);
        const dialog = new DialogView(root, this);
        const choices = new ChoiceView(root);
        const taskbar = new TaskBar(root);
        // 全屋是剧情节点中的导航层：完整显示户型，点当前区域后再进入原有场景/小游戏。
        const house = new HouseView(root);
        // 睡眠区/购物清单/尿布台/待产包小游戏在任务卡之上、HUD 之下（保留孕周徽章）
        const sleepRoom = new SleepRoomView(root);
        const shoppingList = new ShoppingListView(root);
        const diaperStation = new DiaperStationView(root);
        const bagPack = new BagPackView(root);
        // 知识卡压在小游戏之上、手机之下（收进手机时飞向手机图标）
        const knowledgeCard = new KnowledgeCardView(root);
        const hud = new Hud(root);
        // 生产偏好表单为全屏页：压在 HUD 之上（盖住孕周徽章，设计稿如此），在手机之下
        const prefs = new PrefsView(root);
        // 手机图标在商店/我的之下：打开商店时不会浮在商品卡上
        const phone = new PhoneView(root);
        knowledgeCard.phonePos = phone.iconPos();
        knowledgeCard.onCollected = () => {
            phone.bounce();
            phone.setBadge(GameState.badge);
            GameState.stars += 5;
            GameState.save();
        };
        // 底部导航 + 商店 / 我的：压在剧情和小游戏之上，弹窗和过场之下
        const shop = new ShopView(root);
        const profile = new ProfileView(root);
        const nav = new BottomNav(root);
        this.house = house;
        this.shop = shop;
        this.profile = profile;
        this.nav = nav;
        house.onOpen = () => this.refreshNav();
        house.onClose = () => this.refreshNav();
        // 存档菜单在弹窗之下：删除/覆盖确认走 popup
        const saveMenu = new SaveMenuView(root);
        const popup = new PopupView(root);
        saveMenu.popup = popup;
        shop.popup = popup;
        const thought = new ThoughtView(root);
        const overlay = new Overlay(root);
        // 入口在 HUD 层，聊天窗口在最顶层；剧情开始后显示入口
        const chat = new XiaozhiChatView(hud.root, root);
        shop.onPurchase = () => {
            profile.refresh();
            house.refreshOwned();
        };
        shop.onClose = () => this.refreshNav();
        profile.onClose = () => this.refreshNav();
        profile.onGoShop = () => this.openTab('shop');
        nav.onTab = (tab) => this.onNav(tab);

        const ctx: Ctx = { dialog, portraits, choices, thought, popup, scene, house, taskbar, hud, phone, overlay, bagPack, prefs, nav, chat };
        (window as unknown as Record<string, unknown>).__house = house;
        (window as unknown as Record<string, unknown>).__sleepRoom = sleepRoom;
        (window as unknown as Record<string, unknown>).__shoppingList = shoppingList;
        (window as unknown as Record<string, unknown>).__diaperStation = diaperStation;
        (window as unknown as Record<string, unknown>).__bagPack = bagPack;
        (window as unknown as Record<string, unknown>).__prefs = prefs;
        (window as unknown as Record<string, unknown>).__taskbar = taskbar;
        (window as unknown as Record<string, unknown>).__nav = nav;
        (window as unknown as Record<string, unknown>).__shop = shop;
        (window as unknown as Record<string, unknown>).__profile = profile;
        (window as unknown as Record<string, unknown>).__state = GameState;
        (window as unknown as Record<string, unknown>).__save = SaveManager;
        (window as unknown as Record<string, unknown>).__chat = chat;

        // 任务卡点击：第一章按「清单 → 睡眠区 → 尿布台」顺序推进；小游戏期间收起底部导航
        taskbar.onTask = async (id) => {
            this.shop.close();
            this.profile.close();
            this.nav.hide();
            // 小游戏是专注场景：收起 HUD、手机和聊天入口，安全检查卡出现时背景才干净
            phone.setVisible(false);
            chat.setEntryVisible(false);
            hud.time.hide();
            try {
                if (id === 'list') {
                    await shoppingList.play();
                } else if (id === 'sleep') {
                    await sleepRoom.play();
                    await knowledgeCard.play('知识卡｜安全睡眠五句话', SLEEP_SAFETY_CARD);
                    await sleepRoom.close();
                } else {
                    await diaperStation.play();
                }
                GameState.addStars(15);
                taskbar.markDone(id);
            } finally {
                phone.setVisible(true);
                chat.setEntryVisible(true);
                hud.time.show();
                this.nav.show();
                this.nav.flashStars(15);
                this.refreshNav();
            }
        };

        this.runStory(ctx, saveMenu, chat);
    }

    private async runStory(ctx: Ctx, saveMenu: SaveMenuView, chat: XiaozhiChatView): Promise<void> {
        try {
            await ctx.overlay.titleScreen();
            const from = await this.bootMenu(saveMenu);
            chat.setEntryVisible(true);
            this.nav.show();
            this.refreshNav();
            let i = SEGMENTS.findIndex((s) => s.id === from);
            if (i < 0) i = 0;
            for (; i < SEGMENTS.length; i++) {
                const seg = SEGMENTS[i];
                // 区域进度从剧情断点累计推导：旧存档、不同槽位和新游戏都走同一套规则。
                ctx.house.setUnlocked(unlockedAreasThrough(seg.id));
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

    /** 底部导航：家 / 商店 / 我的 */
    private onNav(tab: NavTab): void {
        if (tab === 'home') {
            this.shop.close();
            this.profile.close();
            this.nav.setActive('home');
            if (this.house.isPlaying) return;
            void this.house.play({
                title: '我们的家',
                prompt: '已经点亮的房间都可以点开看看。想添置家具和物品，随时去底部的「商店」慢慢挑。',
                doneLabel: '回到故事',
            }).then(() => this.refreshNav());
            return;
        }
        if (tab === 'shop') {
            this.profile.close();
            this.shop.open();
            this.nav.setActive('shop');
            return;
        }
        this.shop.close();
        this.profile.open();
        this.nav.setActive('me');
    }

    /** 「我的」里的「去商店看看」 */
    private openTab(tab: NavTab): void {
        this.onNav(tab);
    }

    private refreshNav(): void {
        if (this.shop.isOpen) {
            this.nav.setActive('shop');
        } else if (this.profile.isOpen) {
            this.nav.setActive('me');
        } else if (this.house.isPlaying) {
            this.nav.setActive('home');
        } else {
            this.nav.setActive(null);
        }
    }
}
