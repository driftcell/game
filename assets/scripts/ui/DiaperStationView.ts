import { Color, EventTouch, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';
import { FRAME_DIAPER_ROOM, frameLength, framePoint, sceneBackground, unframePoint } from './SceneView';

interface DiaperItem {
    key: string;       // 唯一 id
    img?: string;      // 资源 key，默认同 key
    name: string;
    zone: number;      // 0 台面 / 1 抽屉 / 2 收纳筐
    size: number;      // 放进房间时的显示宽度（按真实物品相对大小设置）
    hint: string;      // 放错区时的温柔科普
}

/** 顺序按设计稿物品栏分页（5/5，两页）：第一页与设计稿一致（纸尿裤/湿巾/润肤乳/隔尿垫/干净衣物） */
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
/** 放置位（取景前坐标，按设计稿房间切图定位，使用时按 FRAME_DIAPER_ROOM 换算）：
 *  台面 = 尿布台台面 2x2；抽屉 = 台下两层搁板；收纳筐 = 台前地板上的筐 */
const SLOTS: [number, number][][] = [
    [[24, 244], [64, 242], [12, 280], [52, 278]],
    [[38, 183], [44, 146], [82, 148]],
    [[158, -58], [212, -58], [158, -110], [212, -110]],
];
/** 高亮框（根坐标） */
const FRAMES = [
    { x: 40, y: 262, w: 200, h: 140 },
    { x: 58, y: 165, w: 160, h: 110 },
    { x: 185, y: -84, w: 190, h: 180 },
];

const PAGE_SIZE = 5;
const CARD_W = 126;
/** 物品图标统一留出内边距，避免高/宽尺寸不同的切图顶到卡片边缘 */
const ICON_W = 84;
const CARD_GAP = 16;
const CARD_Y = 55;           // 面板局部坐标
const LABEL_Y = -60;
const DOTS_Y = -112;
const ARROW_Y = -158;
const HEADER_Y = 182;
const PANEL_TOP = -400;      // 根坐标：面板上边缘
const PANEL_H = 420;
const PANEL_CY = PANEL_TOP - PANEL_H / 2;

/**
 * 第一章小游戏：布置尿布台。
 * 换尿布时大人一只手不离宝宝，所以台面只放伸手即取的必需品；
 * 备货收进抽屉，危险/分心物品收进筐。放错弹回并给出温柔科普。
 */
export class DiaperStationView {
    root: Node;
    private panel: Node;
    private cardLayer: Node;
    private placedLayer: Node;
    private dragLayer: Node;
    private hintN: Node;
    private hintL: Label;
    private frames: Graphics[] = [];
    private dots: Node[] = [];
    private arrows: { x: number; dir: number }[] = [];
    private cards: { def: DiaperItem; x: number; node: Node }[] = [];
    private placed = new Set<string>();
    private zoneCounts = [0, 0, 0];
    private page = 0;
    private hoverZone = -1;
    private ghost: Node | null = null;
    private dragDef: DiaperItem | null = null;
    private start = new Vec3();
    private axis: 'none' | 'drag' | 'swipe' = 'none';
    private busy = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'diaperstation');
        // 全屏吞掉下层点击（任务卡、对白等）
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        sceneBackground(this.root, 'bedroom_diaper', FRAME_DIAPER_ROOM, Col.pinkPale);
        // 收纳筐放在尿布台前的地板上（设计稿房间无筐，游戏按玩法补一只）
        const basket = framePoint(FRAME_DIAPER_ROOM, 185, -70);
        Img.sprite(this.root, 'basket', frameLength(FRAME_DIAPER_ROOM, 140), basket.x, basket.y);

        // 三处高亮框（拖拽悬停时描边）
        FRAMES.forEach(() => {
            const n = new Node('frame');
            this.root.addChild(n);
            ui(n, DW, DH);
            this.frames.push(n.addComponent(Graphics));
        });

        this.placedLayer = new Node('placed');
        this.root.addChild(this.placedLayer);
        ui(this.placedLayer, DW, DH);

        // 提示浮在列底与物品栏之间，避免遮挡标题和放置区
        this.hintN = block(this.root, 640, 88, new Color(35, 30, 35, 228), 20, 0, -340);
        this.hintL = labelInBox(this.hintN, '', 600, 80, { size: 26, color: Col.white });
        opacity(this.hintN).opacity = 0;

        this.panel = new Node('panel');
        this.root.addChild(this.panel);
        ui(this.panel, DW, PANEL_H, 0, PANEL_CY);
        const pg = this.panel.addComponent(Graphics);
        pg.fillColor = new Color(62, 58, 62, 242);
        pg.rect(-DW / 2, -PANEL_H / 2, DW, PANEL_H);
        pg.fill();
        // 顶部横条 + 中央向下展开的梯形
        pg.fillColor = new Color(44, 41, 44, 255);
        pg.rect(-DW / 2, PANEL_H / 2 - 56, DW, 56);
        pg.fill();
        pg.moveTo(-150, PANEL_H / 2 - 56);
        pg.lineTo(150, PANEL_H / 2 - 56);
        pg.lineTo(260, PANEL_H / 2 - 112);
        pg.lineTo(-260, PANEL_H / 2 - 112);
        pg.close();
        pg.fill();
        label(this.panel, '物品栏', { size: 34, bold: true, color: Col.white }, 0, HEADER_Y);

        this.cardLayer = new Node('cards');
        this.panel.addChild(this.cardLayer);
        ui(this.cardLayer, DW, PANEL_H);
        this.renderPage();

        const pageCount = Math.ceil(ITEMS.length / PAGE_SIZE);
        for (let i = 0; i < pageCount; i++) {
            this.dots.push(block(this.panel, 18, 18, new Color(120, 112, 118), 9, (i - (pageCount - 1) / 2) * 34, DOTS_Y));
        }
        this.refreshDots();
        this.chevron(-315, -1);
        this.chevron(315, 1);
        label(this.panel, '左右滑动', { size: 20, color: new Color(150, 143, 148) }, 0, ARROW_Y - 24);

        this.dragLayer = new Node('drag');
        this.root.addChild(this.dragLayer);
        ui(this.dragLayer, DW, DH);

        this.panel.on(Node.EventType.TOUCH_START, this.onDown, this);
        this.panel.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.panel.on(Node.EventType.TOUCH_END, this.onUp, this);
        this.panel.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this);

        this.root.active = false;
    }

    /** 进入小游戏：重置并淡入，返回的 Promise 在布置完成后 resolve */
    play(): Promise<void> {
        this.page = 0;
        this.placed.clear();
        this.zoneCounts = [0, 0, 0];
        this.hoverZone = -1;
        this.paintFrames();
        this.placedLayer.removeAllChildren();
        this.dragLayer.removeAllChildren();
        this.ghost = null;
        this.dragDef = null;
        this.axis = 'none';
        this.busy = false;
        this.renderPage();
        this.refreshDots();
        opacity(this.hintN).opacity = 0;
        const op = opacity(this.root);
        op.opacity = 0;
        this.root.active = true;
        tween(op).to(0.25, { opacity: 255 }).start();
        return new Promise<void>((r) => { this.resolve = r; });
    }

    private renderPage(): void {
        this.cardLayer.removeAllChildren();
        this.cards = [];
        const items = ITEMS.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);
        const totalW = items.length * CARD_W + (items.length - 1) * CARD_GAP;
        let x = -totalW / 2 + CARD_W / 2;
        for (const def of items) {
            const card = block(this.cardLayer, CARD_W, CARD_W, Col.pinkSoft, 18, x, CARD_Y);
            Img.icon(card, def.img ?? def.key, def.name, ICON_W, 0, 6);
            label(this.cardLayer, def.name, { size: 22, color: new Color(242, 234, 238) }, x, LABEL_Y);
            if (this.placed.has(def.key)) opacity(card).opacity = 100;
            this.cards.push({ def, x, node: card });
            x += CARD_W + CARD_GAP;
        }
    }

    private refreshDots(): void {
        this.dots.forEach((d, i) => {
            const g = d.getComponent(Graphics);
            if (g) paintBlock(g, 18, 18, i === this.page ? Col.pink : new Color(120, 112, 118), 9);
        });
    }

    private chevron(x: number, dir: number): void {
        const n = new Node('arrow');
        this.panel.addChild(n);
        ui(n, 80, 80, x, ARROW_Y);
        const g = n.addComponent(Graphics);
        g.lineWidth = 8;
        g.strokeColor = new Color(202, 192, 198);
        g.moveTo(12 * dir, 20);
        g.lineTo(-12 * dir, 0);
        g.lineTo(12 * dir, -20);
        g.stroke();
        this.arrows.push({ x, dir });
    }

    private turn(dir: number): void {
        const max = Math.ceil(ITEMS.length / PAGE_SIZE) - 1;
        const next = Math.min(Math.max(this.page + dir, 0), max);
        if (next === this.page) return;
        this.page = next;
        this.renderPage();
        this.refreshDots();
    }

    private paintFrames(): void {
        this.frames.forEach((g, i) => {
            g.clear();
            if (i === this.hoverZone) {
                const f = FRAMES[i];
                const c = framePoint(FRAME_DIAPER_ROOM, f.x, f.y);
                const w = frameLength(FRAME_DIAPER_ROOM, f.w);
                const h = frameLength(FRAME_DIAPER_ROOM, f.h);
                g.strokeColor = ZONE_COLORS[i];
                g.lineWidth = 6;
                g.roundRect(c.x - w / 2, c.y - h / 2, w, h, frameLength(FRAME_DIAPER_ROOM, 16));
                g.stroke();
            }
        });
    }

    private setHover(zone: number): void {
        if (zone === this.hoverZone) return;
        this.hoverZone = zone;
        this.paintFrames();
    }

    private hitZone(p: Vec3): number {
        // 先反算回设计稿坐标，命中区仍按原房间切图坐标判断
        const q = unframePoint(FRAME_DIAPER_ROOM, p.x, p.y);
        if (Math.abs(q.x - 40) <= 115 && q.y >= 195 && q.y <= 345) return 0;
        if (Math.abs(q.x - 58) <= 95 && q.y >= 105 && q.y <= 195) return 1;
        if (Math.abs(q.x - 185) <= 110 && q.y >= -180 && q.y <= 10) return 2;
        return -1;
    }

    private onDown(e: EventTouch): void {
        if (this.busy) return;
        const p = this.toLocal(e);
        this.start.set(p.x, p.y, 0);
        this.axis = 'none';
        this.dragDef = null;
        const lx = p.x - this.panel.position.x;
        const ly = p.y - this.panel.position.y;
        for (const c of this.cards) {
            if (this.placed.has(c.def.key)) continue;
            if (Math.abs(lx - c.x) <= CARD_W / 2 + 6 && Math.abs(ly - CARD_Y) <= CARD_W / 2 + 6) {
                this.dragDef = c.def;
                break;
            }
        }
    }

    private onMove(e: EventTouch): void {
        if (this.busy) return;
        const p = this.toLocal(e);
        const dx = p.x - this.start.x;
        const dy = p.y - this.start.y;
        if (this.axis === 'none') {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
            this.axis = this.dragDef && Math.abs(dy) >= Math.abs(dx) ? 'drag' : 'swipe';
            if (this.axis === 'drag' && this.dragDef) {
                const size = frameLength(FRAME_DIAPER_ROOM, this.dragDef.size * 2);
                this.ghost = Img.icon(this.dragLayer, this.dragDef.img ?? this.dragDef.key, this.dragDef.name, size, p.x, p.y + 60);
                opacity(this.ghost).opacity = 235;
            }
        }
        if (this.axis === 'drag' && this.ghost) {
            this.ghost.setPosition(p.x, p.y + 60, 0);
            this.setHover(this.hitZone(this.ghost.position));
        }
    }

    private onUp(e: EventTouch): void {
        if (this.busy) return;
        const p = this.toLocal(e);
        if (this.axis === 'drag' && this.ghost && this.dragDef) {
            this.drop(new Vec3(this.ghost.position.x, this.ghost.position.y, 0));
        } else if (this.axis === 'swipe') {
            const dx = p.x - this.start.x;
            if (Math.abs(dx) > 60) this.turn(dx < 0 ? 1 : -1);
        } else {
            const lx = p.x - this.panel.position.x;
            const ly = p.y - this.panel.position.y;
            for (const a of this.arrows) {
                if (Math.abs(lx - a.x) <= 44 && Math.abs(ly - ARROW_Y) <= 44) { this.turn(a.dir); break; }
            }
        }
        this.axis = 'none';
        this.dragDef = null;
        this.setHover(-1);
    }

    private onCancel(e: EventTouch): void {
        // 拖到面板外松手时 Cocos 触发 CANCEL 而非 END，仍需处理放置
        if (this.axis === 'drag' && this.ghost && this.dragDef) {
            this.drop(new Vec3(this.ghost.position.x, this.ghost.position.y, 0));
        } else if (this.ghost) {
            this.ghost.destroy();
            this.ghost = null;
        }
        this.axis = 'none';
        this.dragDef = null;
        this.setHover(-1);
    }

    private drop(p: Vec3): void {
        const def = this.dragDef!;
        const ghost = this.ghost!;
        this.ghost = null;
        const zone = this.hitZone(p);
        if (zone === def.zone) {
            this.placed.add(def.key);
            const idx = this.zoneCounts[def.zone]++;
            const [tx, ty] = this.sceneSlot(def.zone, idx);
            tween(ghost)
                .to(0.18, { position: new Vec3(tx, ty, 0) })
                .call(() => {
                    ghost.destroy();
                    this.spawnPlaced(def, tx, ty);
                })
                .start();
            this.renderPage();
            if (this.placed.size >= ITEMS.length) this.finish();
        } else {
            tween(ghost).to(0.2, { position: this.cardHome(def) }).call(() => ghost.destroy()).start();
            if (zone >= 0) this.toast(def.hint);
        }
    }

    /** 放置位按背景取景换算，保持道具与台面/抽屉/收纳筐对齐 */
    private sceneSlot(zone: number, idx: number): [number, number] {
        const [x, y] = SLOTS[zone][idx];
        const p = framePoint(FRAME_DIAPER_ROOM, x, y);
        return [p.x, p.y];
    }

    private spawnPlaced(def: DiaperItem, x: number, y: number): void {
        const size = frameLength(FRAME_DIAPER_ROOM, def.size);
        const n = Img.icon(this.placedLayer, def.img ?? def.key, def.name, size, x, y);
        n.setScale(0.7, 0.7, 1);
        tween(n).to(0.12, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
    }

    /** 调试：直接放置一个物品（跳过拖拽动画） */
    debugPlace(key: string): void {
        const def = ITEMS.find((d) => d.key === key);
        if (!def || this.placed.has(key)) return;
        this.placed.add(key);
        const idx = this.zoneCounts[def.zone]++;
        const [tx, ty] = this.sceneSlot(def.zone, idx);
        this.spawnPlaced(def, tx, ty);
        this.renderPage();
        if (this.placed.size >= ITEMS.length) this.finish();
    }

    private cardHome(def: DiaperItem): Vec3 {
        const c = this.cards.find((it) => it.def.key === def.key);
        const x = c ? c.x : 0;
        return new Vec3(this.panel.position.x + x, this.panel.position.y + CARD_Y, 0);
    }

    private toast(msg: string, holdMs = 1600): void {
        this.hintL.string = msg;
        const op = opacity(this.hintN);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        tween(op).delay(holdMs / 1000).to(0.3, { opacity: 0 }).start();
    }

    private finish(): void {
        this.busy = true;
        this.toast('尿布台布置好了！', 900);
        setTimeout(() => {
            const op = opacity(this.root);
            tween(op).to(0.3, { opacity: 0 }).call(() => {
                this.root.active = false;
                this.busy = false;
                const r = this.resolve;
                this.resolve = null;
                if (r) r();
            }).start();
        }, 1000);
    }

    private toLocal(e: EventTouch): Vec3 {
        const p = e.getUILocation();
        return this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    }
}
