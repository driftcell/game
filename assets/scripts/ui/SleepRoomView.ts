import { Color, Graphics, Node, Tween, tween, UITransform, UIOpacity, Vec2, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';
import { FRAME_SLEEP_ROOM, frameLength, framePoint, sceneBackground } from './SceneView';
import { showSafetyCard } from './SafetyCard';

interface CribItem {
    key: string;
    name: string;
    safe: boolean;
    hint?: string;
    /** 飞入婴儿床的位置（取景前坐标） */
    slot?: Vec2;
}

/**
 * 第一章：布置安全睡眠区。
 * 婴儿床一开始就摆在房间里；点婴儿床 → 打开物品栏 → 点物品放进床里。
 * 放对的东西进床，松软/多余的东西会被小智拦下并解释原因。
 * 床垫和睡袋都放好后，才弹出一次「睡眠空间检查」卡。
 */
const ITEMS: CribItem[] = [
    { key: 'mattress', name: '床垫', safe: true, slot: new Vec2(-236, -50) },
    { key: 'sleep_bag', name: '睡袋', safe: true, slot: new Vec2(-232, -54) },
    { key: 'pillow', name: '枕头', safe: false, hint: '1 岁前不需要枕头，会增加窒息风险' },
    { key: 'quilt', name: '被子', safe: false, hint: '被子容易捂住口鼻，换成睡袋更安全' },
    { key: 'crib_bumper', name: '床围', safe: false, hint: '床围有缠绕和窒息风险，不要围在婴儿床边' },
    { key: 'plush', name: '毛绒玩具', safe: false, hint: '宝宝睡觉时，婴儿床里不放毛绒玩具' },
    { key: 'hat', name: '帽子', safe: false, hint: '睡觉时不给宝宝戴帽子，避免过热' },
    { key: 'mobile', name: '床铃', safe: false, hint: '床铃要挂在宝宝够不到的位置，睡觉前先移开' },
];

const REQUIRED = ['mattress', 'sleep_bag'];
const CARD_W = 150;
const CARD_H = 150;
const CARD_X = [-246, -82, 82, 246];
const CARD_Y = [58, -108];
const PANEL_H = 520;
const PANEL_CY = -DH / 2 + 260;

export class SleepRoomView {
    root: Node;
    private panel: Node;
    private cribLayer: Node;
    private ghostLayer: Node;
    private modalLayer: Node;
    private hintN: Node;
    private hintL: ReturnType<typeof label>;
    private ringN: Node;
    private chipN: Node;
    private targetN: Node;
    private progressL: ReturnType<typeof label>;
    private cards = new Map<string, { def: CribItem; card: Node; check: Node; g: Graphics }>();
    private placed = new Set<string>();
    private busy = false;
    private trayOpen = false;
    private done = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'sleeproom');
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        sceneBackground(this.root, 'bedroom', FRAME_SLEEP_ROOM, Col.pinkPale);

        // 房间里的固定家具：婴儿床 + 收纳筐（不再作为物品栏卡片）
        this.cribLayer = new Node('crib');
        this.root.addChild(this.cribLayer);
        ui(this.cribLayer, DW, DH);
        const cribP = framePoint(FRAME_SLEEP_ROOM, -231, -42);
        Img.sprite(this.cribLayer, 'crib_scene', frameLength(FRAME_SLEEP_ROOM, 196), cribP.x, cribP.y);
        const basketP = framePoint(FRAME_SLEEP_ROOM, 235, -210);
        Img.sprite(this.cribLayer, 'basket', frameLength(FRAME_SLEEP_ROOM, 140), basketP.x, basketP.y);

        // 婴儿床的点击热区 + 呼吸提示
        this.targetN = new Node('crib-target');
        this.root.addChild(this.targetN);
        ui(this.targetN, 300, 280, cribP.x, cribP.y + 10);
        this.targetN.on(Node.EventType.TOUCH_END, () => this.openTray());

        this.ringN = new Node('crib-ring');
        this.root.addChild(this.ringN);
        this.ringN.setSiblingIndex(this.cribLayer.getSiblingIndex());
        ui(this.ringN, 300, 240, cribP.x, cribP.y + 4);
        const rg = this.ringN.addComponent(Graphics);
        rg.fillColor = new Color(238, 96, 148, 26);
        rg.roundRect(-150, -120, 300, 240, 32);
        rg.fill();
        rg.fillColor = new Color(238, 96, 148, 16);
        rg.roundRect(-128, -98, 256, 196, 28);
        rg.fill();
        const rop = this.ringN.addComponent(UIOpacity);
        rop.opacity = 110;
        tween(rop).to(0.8, { opacity: 190 }).to(0.8, { opacity: 95 }).union().repeatForever().start();

        this.chipN = block(this.root, 190, 54, new Color(255, 255, 255, 246), 27, cribP.x + 46, cribP.y + 128, Col.pink);
        label(this.chipN, '＋ 点击布置', { size: 21, bold: true, color: Col.pinkDeep });
        this.chipN.on(Node.EventType.TOUCH_END, () => this.openTray());
        tween(this.chipN).to(0.8, { scale: new Vec3(1.05, 1.05, 1) }).to(0.8, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();

        this.ghostLayer = new Node('ghost');
        this.root.addChild(this.ghostLayer);
        ui(this.ghostLayer, DW, DH);

        this.panel = new Node('panel');
        this.root.addChild(this.panel);
        ui(this.panel, DW, PANEL_H, 0, PANEL_CY - PANEL_H - 40);
        const pg = this.panel.addComponent(Graphics);
        pg.fillColor = new Color(62, 58, 62, 246);
        pg.rect(-DW / 2, -PANEL_H / 2, DW, PANEL_H);
        pg.fill();
        pg.fillColor = new Color(44, 41, 44, 255);
        pg.rect(-DW / 2, PANEL_H / 2 - 54, DW, 54);
        pg.fill();
        label(this.panel, '把东西放进婴儿床', { size: 31, bold: true, color: Col.white }, -60, 220);
        labelInBox(this.panel, '点物品就能放进去。睡觉不需要的东西，小智会拦下。', 620, 40,
            { size: 21, color: new Color(220, 212, 217) }, 0, 176);
        const closeHit = block(this.panel, 150, 100, new Color(255, 255, 255, 1), 0, 303, 220);
        const close = block(closeHit, 110, 54, new Color(255, 255, 255, 36), 24);
        label(close, '收起', { size: 21, color: Col.white });
        closeHit.on(Node.EventType.TOUCH_END, () => this.closeTray(true));

        ITEMS.forEach((def, i) => this.buildCard(def, i));
        this.progressL = label(this.panel, '已放入：0 / 2', { size: 21, color: new Color(220, 212, 217) }, 0, -218);

        this.hintN = block(this.root, 650, 84, new Color(35, 30, 35, 230), 20, 0, 24);
        this.hintL = labelInBox(this.hintN, '', 610, 76, { size: 23, color: Col.white, lineHeight: 32 });
        opacity(this.hintN).opacity = 0;

        this.modalLayer = new Node('modal');
        this.root.addChild(this.modalLayer);
        ui(this.modalLayer, DW, DH);

        this.root.active = false;
    }

    private buildCard(def: CribItem, i: number): void {
        const x = CARD_X[i % 4];
        const y = CARD_Y[Math.floor(i / 4)];
        const card = block(this.panel, CARD_W, CARD_H, new Color(253, 236, 243), 20, x, y);
        const g = card.getComponent(Graphics)!;
        Img.icon(card, def.key, def.name, 76, 0, 18);
        label(card, def.name, { size: 21, color: Col.ink }, 0, -50);
        const check = Img.sprite(card, 'check_green', 30, 54, 54);
        check.active = false;
        card.on(Node.EventType.TOUCH_END, () => this.tryPlace(def.key));
        this.cards.set(def.key, { def, card, check, g });
    }

    play(): Promise<void> {
        this.placed.clear();
        this.busy = false;
        this.trayOpen = false;
        this.done = false;
        this.ghostLayer.removeAllChildren();
        this.modalLayer.removeAllChildren();
        Tween.stopAllByTarget(this.panel);
        this.panel.setPosition(0, PANEL_CY - PANEL_H - 40, 0);
        this.panel.active = false;
        this.targetN.active = true;
        this.ringN.active = true;
        this.chipN.active = true;
        this.refreshCards();
        this.updateProgress();
        opacity(this.hintN).opacity = 0;
        const op = opacity(this.root);
        op.opacity = 0;
        this.root.active = true;
        tween(op).to(0.25, { opacity: 255 }).start();
        return new Promise<void>((r) => { this.resolve = r; });
    }

    private openTray(): void {
        if (this.trayOpen || this.busy || this.done) return;
        this.trayOpen = true;
        this.targetN.active = false;
        this.chipN.active = false;
        this.ringN.active = false;
        this.panel.active = true;
        Tween.stopAllByTarget(this.panel);
        this.panel.setPosition(0, PANEL_CY - PANEL_H - 40, 0);
        tween(this.panel).to(0.28, { position: new Vec3(0, PANEL_CY, 0) }, { easing: 'cubicOut' }).start();
    }

    private closeTray(showTarget: boolean): void {
        if (!this.trayOpen) return;
        this.trayOpen = false;
        Tween.stopAllByTarget(this.panel);
        tween(this.panel).to(0.24, { position: new Vec3(0, PANEL_CY - PANEL_H - 40, 0) }, { easing: 'cubicIn' })
            .call(() => { this.panel.active = false; }).start();
        if (showTarget && !this.done) {
            this.targetN.active = true;
            this.chipN.active = true;
            this.ringN.active = true;
        }
    }

    private tryPlace(key: string): void {
        if (this.busy || this.done) return;
        const entry = this.cards.get(key);
        if (!entry || this.placed.has(key)) return;
        const def = entry.def;
        if (!def.safe) {
            this.toast(def.hint ?? '这个先不放进床里', 2000);
            Tween.stopAllByTarget(entry.card);
            entry.card.setScale(new Vec3(1, 1, 1));
            tween(entry.card).to(0.08, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
            return;
        }
        this.placed.add(key);
        this.paintCard(key, true);
        this.updateProgress();

        const from = new Vec3(this.panel.position.x + entry.card.position.x, this.panel.position.y + entry.card.position.y, 0);
        const slot = this.insideSlot(def);
        const ghost = Img.icon(this.ghostLayer, def.key, def.name, 96, from.x, from.y);
        const ghostOpacity = opacity(ghost);
        ghostOpacity.opacity = 235;
        tween(ghost)
            .to(0.26, { position: new Vec3(slot.x, slot.y, 0) }, { easing: 'cubicOut' })
            .call(() => {
                // 物品已经放进床里，不再把大图叠在床面上。
                tween(ghostOpacity)
                    .to(0.12, { opacity: 0 })
                    .call(() => {
                        ghost.destroy();
                        this.checkDone();
                    })
                    .start();
            })
            .start();
    }

    private insideSlot(def: CribItem): Vec2 {
        const slot = def.slot ?? new Vec2(-236, -52);
        return framePoint(FRAME_SLEEP_ROOM, slot.x, slot.y);
    }

    private paintCard(key: string, placed: boolean): void {
        const entry = this.cards.get(key);
        if (!entry) return;
        paintBlock(entry.g, CARD_W, CARD_H,
            placed ? new Color(235, 247, 238) : new Color(253, 236, 243), 20,
            placed ? new Color(122, 154, 126) : undefined, 3);
        entry.check.active = placed;
    }

    private refreshCards(): void {
        this.cards.forEach((entry, key) => this.paintCard(key, this.placed.has(key)));
    }

    private updateProgress(): void {
        const n = REQUIRED.filter((k) => this.placed.has(k)).length;
        this.progressL.string = n >= REQUIRED.length ? '已放入：床垫、睡袋 · 检查通过' : `已放入：${n} / ${REQUIRED.length}（床垫、睡袋）`;
    }

    private checkDone(): void {
        if (this.done) return;
        if (REQUIRED.some((k) => !this.placed.has(k))) return;
        this.done = true;
        this.busy = true;
        void this.finishCrib();
    }

    private async finishCrib(): Promise<void> {
        this.updateProgress();
        await new Promise<void>((r) => setTimeout(r, 520));
        this.closeTray(false);
        this.targetN.active = false;
        this.chipN.active = false;
        this.ringN.active = false;
        await showSafetyCard(this.modalLayer, {
            title: '♥ 睡眠空间检查 ♥',
            subtitle: '检查通过。宝宝可以安全地睡在这里了。',
            buttonLabel: '布置完成',
            rows: [
                { text: '宝宝有独立的睡眠空间。', done: true },
                { text: '睡眠表面坚实、平坦、非倾斜。', done: true },
                { text: '床内没有枕头、被子、床围、毛绒玩具。', done: true },
                { text: '床就放在大床旁边，同室不同床。', done: true },
            ],
            tip: '小智：睡觉时穿睡袋，不盖被子，也不戴帽子。',
        });
        this.toast('睡眠区布置完成！', 900);
        await new Promise<void>((r) => setTimeout(r, 900));
        this.busy = false;
        const r = this.resolve;
        this.resolve = null;
        if (r) r();
    }

    /** 调试：直接放好床垫（Playwright 验证用） */
    debugPlace(key: string): void {
        const entry = this.cards.get(key);
        if (!entry || !entry.def.safe || this.placed.has(key) || this.done) return;
        this.placed.add(key);
        this.paintCard(key, true);
        this.updateProgress();
        this.checkDone();
    }

    /** 调试：跳过点击婴儿床，直接打开物品栏 */
    debugOpenTray(): void {
        this.openTray();
    }

    close(): Promise<void> {
        return new Promise<void>((resolve) => {
            const op = opacity(this.root);
            tween(op).to(0.3, { opacity: 0 }).call(() => {
                this.root.active = false;
                this.busy = false;
                resolve();
            }).start();
        });
    }

    private toast(msg: string, holdMs = 1600): void {
        this.hintL.string = msg;
        const op = opacity(this.hintN);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        tween(op).delay(holdMs / 1000).to(0.3, { opacity: 0 }).start();
    }
}
