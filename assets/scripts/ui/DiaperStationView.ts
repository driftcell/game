import { Color, EventTouch, Graphics, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';
import { FRAME_DIAPER_ROOM, frameLength, framePoint, sceneBackground, unframePoint } from './SceneView';
import { showSafetyCard } from './SafetyCard';

interface DiaperItem {
    key: string;
    img?: string;
    name: string;
    zone: number;      // 0 台面 / 1 抽屉 / 2 收纳筐
    size: number;      // 放进房间时的显示宽度（按真实物品相对大小设置）
    hint: string;      // 放错区时的温柔科普
}

const ITEMS: DiaperItem[] = [
    { key: 'diaper', name: '纸尿裤', zone: 0, size: 34, hint: '纸尿裤每次都要用，放在伸手即取的台面上' },
    { key: 'wipes', name: '湿巾', zone: 0, size: 40, hint: '湿巾每次换尿布都要用，放在台面上' },
    { key: 'lotion', name: '润肤乳', zone: 0, size: 32, hint: '润肤乳每次都可能用，放台面伸手即取' },
    { key: 'pad', name: '隔尿垫', zone: 0, size: 54, hint: '隔尿垫垫在宝宝身下，放台面随手拿' },
    { key: 'clothes', name: '干净衣物', zone: 1, size: 36, hint: '备用的干净衣物收进抽屉，用的时候再拿' },
    { key: 'diaper2', img: 'diaper', name: '备用纸尿裤', zone: 1, size: 30, hint: '囤货的纸尿裤收进抽屉，台面上只留几片' },
    { key: 'powder', name: '爽身粉', zone: 2, size: 28, hint: '粉末容易被宝宝吸入，收起来不要用' },
    { key: 'cup', name: '热水杯', zone: 2, size: 30, hint: '热水杯放在尿布台边有烫伤风险，拿远一点' },
    { key: 'plush', name: '毛绒玩具', zone: 2, size: 38, hint: '毛绒玩具先收起来，换尿布时容易掉下来' },
    { key: 'phone', name: '手机', zone: 2, size: 26, hint: '换尿布时不看手机，宝宝一秒都不能离开视线' },
];

const ZONE_COLORS = [Col.pink, new Color(240, 170, 90), Col.gray];
const ZONE_NAMES = ['台面', '抽屉', '收纳筐'];
const SLOTS: [number, number][][] = [
    [[24, 244], [64, 242], [12, 280], [52, 278]],
    [[38, 183], [44, 146], [82, 148]],
    [[158, -58], [212, -58], [158, -110], [212, -110]],
];
const FRAMES = [
    { x: 40, y: 262, w: 200, h: 140 },
    { x: 58, y: 165, w: 160, h: 110 },
    { x: 185, y: -84, w: 190, h: 180 },
];

const CARD_W = 130;
const CARD_H = 150;
const CARD_X = [-276, -138, 0, 138, 276];
const CARD_Y = [58, -108];
const PANEL_H = 520;
const PANEL_CY = -DH / 2 + 260;

/**
 * 第一章：布置尿布台。
 * 点尿布台 → 打开物品栏 → 点物品，再点「台面 / 抽屉 / 收纳筐」。
 * 放对会归位，放错会弹回并解释原因；全部归位后才弹出一次安全检查卡。
 */
export class DiaperStationView {
    root: Node;
    private panel: Node;
    private placedLayer: Node;
    private ghostLayer: Node;
    private zoneLayer: Node;
    private zoneCatcher: Node;
    private modalLayer: Node;
    private hintN: Node;
    private hintL: ReturnType<typeof label>;
    private targetN: Node;
    private chipN: Node;
    private frames: Graphics[] = [];
    private zoneTags: Node[] = [];
    private progressL: ReturnType<typeof label>;
    private cards = new Map<string, { def: DiaperItem; card: Node; check: Node; g: Graphics }>();
    private placed = new Set<string>();
    private zoneCounts = [0, 0, 0];
    private selected: string | null = null;
    private busy = false;
    private trayOpen = false;
    private done = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'diaperstation');
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        sceneBackground(this.root, 'bedroom_diaper', FRAME_DIAPER_ROOM, Col.pinkPale);
        const basket = framePoint(FRAME_DIAPER_ROOM, 185, -70);
        Img.sprite(this.root, 'basket', frameLength(FRAME_DIAPER_ROOM, 140), basket.x, basket.y);

        // 三处放置区的描边（选中物品后显示）
        FRAMES.forEach(() => {
            const n = new Node('frame');
            this.root.addChild(n);
            ui(n, DW, DH);
            this.frames.push(n.addComponent(Graphics));
        });

        this.placedLayer = new Node('placed');
        this.root.addChild(this.placedLayer);
        ui(this.placedLayer, DW, DH);

        this.ghostLayer = new Node('ghost');
        this.root.addChild(this.ghostLayer);
        ui(this.ghostLayer, DW, DH);

        // 点墙上的尿布台开始布置
        const tableP = framePoint(FRAME_DIAPER_ROOM, 40, 262);
        this.targetN = new Node('table-target');
        this.root.addChild(this.targetN);
        ui(this.targetN, 280, 230, tableP.x, tableP.y);
        this.targetN.on(Node.EventType.TOUCH_END, () => this.openTray());
        this.chipN = block(this.root, 190, 54, new Color(255, 255, 255, 246), 27, tableP.x + 76, tableP.y + 112, Col.pink);
        label(this.chipN, '＋ 点击布置', { size: 21, bold: true, color: Col.pinkDeep });
        this.chipN.on(Node.EventType.TOUCH_END, () => this.openTray());
        tween(this.chipN).to(0.8, { scale: new Vec3(1.05, 1.05, 1) }).to(0.8, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();

        // 选中物品后，房间变成「选位置」状态
        this.zoneCatcher = new Node('zone-catcher');
        this.root.addChild(this.zoneCatcher);
        ui(this.zoneCatcher, 20000, 20000);
        this.zoneCatcher.on(Node.EventType.TOUCH_END, (e) => this.onZoneTap(e));
        this.zoneCatcher.active = false;

        this.zoneLayer = new Node('zone-tags');
        this.root.addChild(this.zoneLayer);
        ui(this.zoneLayer, DW, DH);
        FRAMES.forEach((f, i) => {
            const p = framePoint(FRAME_DIAPER_ROOM, f.x, f.y);
            const tag = block(this.zoneLayer, 120, 44, new Color(255, 255, 255, 244), 22, p.x, p.y, ZONE_COLORS[i], 2);
            label(tag, ZONE_NAMES[i], { size: 21, bold: true, color: ZONE_COLORS[i] });
            tag.active = false;
            this.zoneTags.push(tag);
        });

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
        label(this.panel, '布置尿布台', { size: 31, bold: true, color: Col.white }, -80, 220);
        labelInBox(this.panel, '先点物品，再点位置：台面 / 抽屉 / 收纳筐。', 620, 42,
            { size: 21, color: new Color(220, 212, 217) }, 0, 176);
        const closeHit = block(this.panel, 150, 100, new Color(255, 255, 255, 1), 0, 303, 220);
        const close = block(closeHit, 110, 54, new Color(255, 255, 255, 36), 24);
        label(close, '收起', { size: 21, color: Col.white });
        closeHit.on(Node.EventType.TOUCH_END, () => this.closeTray(true));

        ITEMS.forEach((def, i) => this.buildCard(def, i));
        this.progressL = label(this.panel, '已归位：0 / 10', { size: 21, color: new Color(220, 212, 217) }, 0, -218);

        this.hintN = block(this.root, 680, 84, new Color(35, 30, 35, 232), 20, 0, 24);
        this.hintL = labelInBox(this.hintN, '', 640, 76, { size: 23, color: Col.white, lineHeight: 32 });
        opacity(this.hintN).opacity = 0;

        this.modalLayer = new Node('modal');
        this.root.addChild(this.modalLayer);
        ui(this.modalLayer, DW, DH);

        this.root.active = false;
    }

    private buildCard(def: DiaperItem, i: number): void {
        const x = CARD_X[i % 5];
        const y = CARD_Y[Math.floor(i / 5)];
        const card = block(this.panel, CARD_W, CARD_H, new Color(253, 236, 243), 20, x, y);
        const g = card.getComponent(Graphics)!;
        Img.icon(card, def.img ?? def.key, def.name, 70, 0, 18);
        label(card, def.name, { size: 21, color: Col.ink }, 0, -50);
        const check = Img.sprite(card, 'check_green', 28, 47, 54);
        check.active = false;
        card.on(Node.EventType.TOUCH_END, () => this.select(def.key));
        this.cards.set(def.key, { def, card, check, g });
    }

    play(): Promise<void> {
        this.placed.clear();
        this.zoneCounts = [0, 0, 0];
        this.selected = null;
        this.busy = false;
        this.trayOpen = false;
        this.done = false;
        this.placedLayer.removeAllChildren();
        this.ghostLayer.removeAllChildren();
        this.modalLayer.removeAllChildren();
        Tween.stopAllByTarget(this.panel);
        this.panel.setPosition(0, PANEL_CY - PANEL_H - 40, 0);
        this.panel.active = false;
        this.targetN.active = true;
        this.chipN.active = true;
        this.hideZonePicker();
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
        this.panel.active = true;
        Tween.stopAllByTarget(this.panel);
        this.panel.setPosition(0, PANEL_CY - PANEL_H - 40, 0);
        tween(this.panel).to(0.28, { position: new Vec3(0, PANEL_CY, 0) }, { easing: 'cubicOut' }).start();
        this.toast('先点一件物品，再点它该去的位置', 1700);
    }

    private closeTray(showTarget: boolean): void {
        if (!this.trayOpen) return;
        this.trayOpen = false;
        this.clearSelection();
        Tween.stopAllByTarget(this.panel);
        tween(this.panel).to(0.24, { position: new Vec3(0, PANEL_CY - PANEL_H - 40, 0) }, { easing: 'cubicIn' })
            .call(() => { this.panel.active = false; }).start();
        if (showTarget && !this.done) {
            this.targetN.active = true;
            this.chipN.active = true;
        }
    }

    private select(key: string): void {
        if (this.busy || this.done || this.placed.has(key)) return;
        if (this.selected === key) {
            this.clearSelection();
            return;
        }
        this.clearSelection();
        this.selected = key;
        const entry = this.cards.get(key)!;
        paintBlock(entry.g, CARD_W, CARD_H, new Color(253, 236, 243), 20, Col.pink, 4);
        entry.card.setScale(new Vec3(1.03, 1.03, 1));
        this.zoneCatcher.active = true;
        this.zoneTags.forEach((t) => { t.active = true; });
        this.paintFrames(true);
        this.toast(`${entry.def.name}：点台面、抽屉或收纳筐`, 2200);
    }

    private clearSelection(): void {
        if (this.selected) {
            const entry = this.cards.get(this.selected);
            if (entry) {
                paintBlock(entry.g, CARD_W, CARD_H, new Color(253, 236, 243), 20);
                entry.card.setScale(new Vec3(1, 1, 1));
            }
        }
        this.selected = null;
        this.zoneCatcher.active = false;
        this.zoneTags.forEach((t) => { t.active = false; });
        this.paintFrames(false);
    }

    private hideZonePicker(): void {
        this.zoneCatcher.active = false;
        this.zoneTags.forEach((t) => { t.active = false; });
        this.paintFrames(false);
    }

    private onZoneTap(e: EventTouch): void {
        if (!this.selected || this.busy) return;
        const p = e.getUILocation();
        const local = this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
        const zone = this.hitZone(local);
        if (zone < 0) {
            this.clearSelection();
            return;
        }
        const key = this.selected;
        const entry = this.cards.get(key)!;
        if (zone !== entry.def.zone) {
            this.toast(entry.def.hint, 2200);
            this.clearSelection();
            Tween.stopAllByTarget(entry.card);
            entry.card.setScale(new Vec3(1, 1, 1));
            tween(entry.card).to(0.08, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
            return;
        }
        this.place(key, zone);
    }

    private place(key: string, zone: number): void {
        const entry = this.cards.get(key);
        if (!entry) return;
        this.clearSelection();
        this.placed.add(key);
        const idx = this.zoneCounts[zone]++;
        const [tx, ty] = this.sceneSlot(zone, idx);
        const from = new Vec3(this.panel.position.x + entry.card.position.x, this.panel.position.y + entry.card.position.y, 0);
        const ghost = Img.icon(this.ghostLayer, entry.def.img ?? entry.def.key, entry.def.name,
            frameLength(FRAME_DIAPER_ROOM, entry.def.size * 2), from.x, from.y);
        opacity(ghost).opacity = 235;
        tween(ghost)
            .to(0.24, { position: new Vec3(tx, ty, 0) }, { easing: 'cubicOut' })
            .call(() => {
                ghost.destroy();
                this.spawnPlaced(entry.def, tx, ty);
                this.paintCard(key, true);
                this.updateProgress();
                this.checkDone();
            })
            .start();
    }

    private sceneSlot(zone: number, idx: number): [number, number] {
        const [x, y] = SLOTS[zone][idx];
        const p = framePoint(FRAME_DIAPER_ROOM, x, y);
        return [p.x, p.y];
    }

    private spawnPlaced(def: DiaperItem, x: number, y: number): void {
        const size = frameLength(FRAME_DIAPER_ROOM, def.size);
        const n = Img.icon(this.placedLayer, def.img ?? def.key, def.name, size, x, y);
        n.setScale(new Vec3(0.7, 0.7, 1));
        tween(n).to(0.12, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
    }

    private paintCard(key: string, placed: boolean): void {
        const entry = this.cards.get(key);
        if (!entry) return;
        paintBlock(entry.g, CARD_W, CARD_H,
            placed ? new Color(235, 247, 238) : new Color(253, 236, 243), 20,
            placed ? new Color(122, 154, 126) : undefined, 3);
        entry.card.setScale(new Vec3(1, 1, 1));
        entry.check.active = placed;
    }

    private refreshCards(): void {
        this.cards.forEach((entry, key) => this.paintCard(key, this.placed.has(key)));
    }

    private updateProgress(): void {
        this.progressL.string = this.placed.size >= ITEMS.length
            ? '已归位：10 / 10 · 检查通过'
            : `已归位：${this.placed.size} / ${ITEMS.length}`;
    }

    private paintFrames(show: boolean): void {
        this.frames.forEach((g, i) => {
            g.clear();
            if (!show) return;
            const f = FRAMES[i];
            const c = framePoint(FRAME_DIAPER_ROOM, f.x, f.y);
            const w = frameLength(FRAME_DIAPER_ROOM, f.w);
            const h = frameLength(FRAME_DIAPER_ROOM, f.h);
            g.strokeColor = ZONE_COLORS[i];
            g.lineWidth = 5;
            g.roundRect(c.x - w / 2, c.y - h / 2, w, h, frameLength(FRAME_DIAPER_ROOM, 16));
            g.stroke();
        });
    }

    private hitZone(p: Vec3): number {
        const q = unframePoint(FRAME_DIAPER_ROOM, p.x, p.y);
        if (Math.abs(q.x - 40) <= 115 && q.y >= 195 && q.y <= 345) return 0;
        if (Math.abs(q.x - 58) <= 95 && q.y >= 105 && q.y <= 195) return 1;
        if (Math.abs(q.x - 185) <= 110 && q.y >= -180 && q.y <= 10) return 2;
        return -1;
    }

    private checkDone(): void {
        if (this.done || this.placed.size < ITEMS.length) return;
        this.done = true;
        this.busy = true;
        void this.finishDiaper();
    }

    private async finishDiaper(): Promise<void> {
        await new Promise<void>((r) => setTimeout(r, 520));
        this.closeTray(false);
        this.targetN.active = false;
        this.chipN.active = false;
        await showSafetyCard(this.modalLayer, {
            title: '♥ 尿布台检查 ♥',
            subtitle: '每样东西都在顺手又安全的位置。',
            buttonLabel: '布置完成',
            rows: [
                { text: '台面只放伸手即取的必需品。', done: true },
                { text: '备用物品收进抽屉，台面不堆东西。', done: true },
                { text: '热水杯、粉末等危险物品远离宝宝。', done: true },
                { text: '换尿布时，手始终不离开宝宝。', done: true },
            ],
            tip: '小智：需要转身拿东西时，先把宝宝抱起来或请人帮忙。',
        });
        this.toast('尿布台布置好了！', 900);
        await new Promise<void>((r) => setTimeout(r, 900));
        const op = opacity(this.root);
        tween(op).to(0.3, { opacity: 0 }).call(() => {
            this.root.active = false;
            this.busy = false;
            const r = this.resolve;
            this.resolve = null;
            if (r) r();
        }).start();
    }

    /** 调试：直接归位一件物品（Playwright 验证用） */
    debugPlace(key: string): void {
        const entry = this.cards.get(key);
        if (!entry || this.placed.has(key) || this.done) return;
        this.placed.add(key);
        const idx = this.zoneCounts[entry.def.zone]++;
        const [tx, ty] = this.sceneSlot(entry.def.zone, idx);
        this.spawnPlaced(entry.def, tx, ty);
        this.paintCard(key, true);
        this.updateProgress();
        this.checkDone();
    }

    debugOpenTray(): void {
        this.openTray();
    }

    private toast(msg: string, holdMs = 1600): void {
        this.hintL.string = msg;
        const op = opacity(this.hintN);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        tween(op).delay(holdMs / 1000).to(0.3, { opacity: 0 }).start();
    }
}
