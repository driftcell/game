import { Button, Color, EventTouch, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

interface BagItem {
    key: string;       // 资源 key
    name: string;      // 卡片文字
    req: boolean;      // 必要（证件/妈妈/宝宝用品）；可选（舒适加分项）
}

/** 顺序按原型：前 8 件必要，后 6 件可选；物品栏 5/5/4 三页，第一页与设计稿一致
 *  （证件和保险信息/生产偏好文档/妈妈出院衣物/洗漱用品/充电器） */
const ITEMS: BagItem[] = [
    { key: 'bag_id', name: '证件和保险信息', req: true },
    { key: 'bag_doc', name: '生产偏好文档', req: true },
    { key: 'bag_mom', name: '妈妈出院衣物', req: true },
    { key: 'bag_wash', name: '洗漱用品', req: true },
    { key: 'bag_charger', name: '充电器', req: true },
    { key: 'bag_seat', name: '婴儿座椅', req: true },
    { key: 'bag_baby', name: '宝宝出院服', req: true },
    { key: 'bag_sup', name: '支持者换洗衣物', req: true },
    { key: 'bag_ball', name: '按摩球', req: false },
    { key: 'bag_snack', name: '小零食', req: false },
    { key: 'bag_yoga', name: '瑜伽球', req: false },
    { key: 'bag_aroma', name: '香薰', req: false },
    { key: 'bag_ear', name: '耳机', req: false },
    { key: 'bag_dress', name: '待产衣服', req: false },
];

/** 行李箱左右两半（必要/可选）的判定区（根坐标，按弹窗内行李箱切图定位） */
const ZONES = [
    { x: -104, y: 95, w: 200, h: 300 },
    { x: 104, y: 95, w: 200, h: 300 },
];
/** 每半格内的摆放格：3 列 x 5 行（根坐标绝对值，落在行李箱网格内） */
const COLS = [-64, 0, 64];
const ROWS = [166, 120, 74, 28, -18];
const CHIP = 44;            // 小于行距 46，避免相邻物品压到下一格

const PAGE_SIZE = 5;
const CARD_W = 126;
/** 物品图标统一留出内边距，避免长图标顶到卡片边缘 */
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

/** 弹窗卡片（根坐标，按设计稿 24 测量换算） */
const POPUP = { w: 706, h: 888, cy: 96, r: 42 };

/**
 * 第二章小游戏：收拾待产包。
 * 把物品栏里的物品拖进打开的行李箱：左半「必要」/ 右半「可选」（装错半区不判定）。
 * 点「确认」先检查必要物品是否都装箱：缺 → 小智提示 + 高亮缺失卡片；
 * 再点一次 → 温柔提示可以到住院后再补，随后继续。全部收好 → 完成。
 */
export class BagPackView {
    root: Node;
    private panel: Node;
    private cardLayer: Node;
    private placedLayer: Node;
    private dragLayer: Node;
    private frameG: Graphics;
    private hintN: Node;
    private hintL: Label;
    private bubbleN: Node;
    private bubbleL: Label;
    private dots: Node[] = [];
    private arrows: { x: number; dir: number }[] = [];
    private cards: { def: BagItem; x: number; node: Node }[] = [];
    private packed = new Map<string, number>();     // key -> zone
    private zoneCounts = [0, 0];
    private page = 0;
    private tries = 0;
    private hoverZone = -1;
    private ghost: Node | null = null;
    private dragDef: BagItem | null = null;
    private start = new Vec3();
    private axis: 'none' | 'drag' | 'swipe' = 'none';
    private busy = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'bagpack');
        // 全屏吞掉下层点击（对白等）
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        // 房间背景（弹窗页的设计稿版本：略微提亮的卧室）
        Img.sprite(this.root, 'bedroom_bag', DW, 0, 0);

        // 弹窗卡片
        const pop = block(this.root, POPUP.w, POPUP.h, new Color(255, 243, 238), POPUP.r, 0, POPUP.cy);
        // 顶部标题装饰 + 标题 + 副标题
        Img.sprite(pop, 'bag_title', 354, 0, 442 - POPUP.cy);
        label(pop, '待产包', { size: 54, bold: true, color: Col.pink }, 0, 442 - POPUP.cy);
        label(pop, '拖动物品装箱', { size: 28, color: new Color(120, 106, 100) }, 0, 347 - POPUP.cy);
        // 行李箱 + 确认按钮
        Img.sprite(pop, 'bag_case', 530, 0, 107 - POPUP.cy);
        const btn = Img.sprite(pop, 'bag_btn', 264, 0, -207 - POPUP.cy);
        const bb = btn.addComponent(Button);
        bb.transition = Button.Transition.SCALE;
        bb.zoomScale = 0.94;
        bb.target = btn;
        btn.on(Button.EventType.CLICK, () => this.confirm());
        // 树精灵探头（左上，压在卡片边上）+ 图钉
        Img.sprite(this.root, 'xz_peek_bag', 185, -248, 502);
        Img.sprite(this.root, 'pin', 36, 48, 505);

        // 悬停高亮框
        const frame = new Node('frame');
        this.root.addChild(frame);
        ui(frame, DW, DH);
        this.frameG = frame.addComponent(Graphics);

        this.placedLayer = new Node('placed');
        this.root.addChild(this.placedLayer);
        ui(this.placedLayer, DW, DH);

        // 小智提示气泡（浮在行李箱上方）
        this.bubbleN = block(this.root, 620, 96, Col.white, 22, 0, 250, Col.line);
        this.bubbleL = labelInBox(this.bubbleN, '', 576, 84, { size: 24, color: Col.pinkDeep, lineHeight: 32 });
        this.bubbleN.active = false;

        // 物品栏面板
        this.panel = new Node('panel');
        this.root.addChild(this.panel);
        ui(this.panel, DW, PANEL_H, 0, PANEL_CY);
        const pg = this.panel.addComponent(Graphics);
        pg.fillColor = new Color(62, 58, 62, 242);
        pg.rect(-DW / 2, -PANEL_H / 2, DW, PANEL_H);
        pg.fill();
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

        // 底部提示
        this.hintN = block(this.root, 640, 88, new Color(35, 30, 35, 228), 20, 0, -340);
        this.hintL = labelInBox(this.hintN, '', 600, 80, { size: 26, color: Col.white });
        opacity(this.hintN).opacity = 0;

        this.dragLayer = new Node('drag');
        this.root.addChild(this.dragLayer);
        ui(this.dragLayer, DW, DH);

        this.panel.on(Node.EventType.TOUCH_START, this.onDown, this);
        this.panel.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.panel.on(Node.EventType.TOUCH_END, this.onUp, this);
        this.panel.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this);

        this.root.active = false;
    }

    /** 进入小游戏：重置并淡入，返回的 Promise 在确认完成后 resolve */
    play(): Promise<void> {
        this.page = 0;
        this.packed.clear();
        this.zoneCounts = [0, 0];
        this.tries = 0;
        this.hoverZone = -1;
        this.paintFrame();
        this.placedLayer.removeAllChildren();
        this.dragLayer.removeAllChildren();
        this.ghost = null;
        this.dragDef = null;
        this.axis = 'none';
        this.busy = false;
        this.bubbleN.active = false;
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
            Img.sprite(card, def.key, ICON_W, 0, 6);
            // 最长名称「证件和保险信息」7 字，17 号字才能完整落在 126 宽的卡片内
            label(this.cardLayer, def.name, { size: 17, color: new Color(242, 234, 238) }, x, LABEL_Y);
            if (this.packed.has(def.key)) opacity(card).opacity = 100;
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

    private paintFrame(): void {
        this.frameG.clear();
        if (this.hoverZone >= 0) {
            const z = ZONES[this.hoverZone];
            this.frameG.strokeColor = Col.pink;
            this.frameG.lineWidth = 6;
            this.frameG.roundRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 20);
            this.frameG.stroke();
        }
    }

    private setHover(zone: number): void {
        if (zone === this.hoverZone) return;
        this.hoverZone = zone;
        this.paintFrame();
    }

    private hitZone(p: Vec3): number {
        for (let i = 0; i < ZONES.length; i++) {
            const z = ZONES[i];
            if (Math.abs(p.x - z.x) <= z.w / 2 && Math.abs(p.y - z.y) <= z.h / 2) return i;
        }
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
            if (this.packed.has(c.def.key)) continue;
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
                this.ghost = Img.sprite(this.dragLayer, this.dragDef.key, 100, p.x, p.y + 60);
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

    /** 落下：两半都可以放（装错半区不判定），飞入后叠进半区格子 */
    private drop(p: Vec3): void {
        const def = this.dragDef!;
        const ghost = this.ghost!;
        this.ghost = null;
        const zone = this.hitZone(p);
        if (zone >= 0) {
            this.packed.set(def.key, zone);
            const idx = this.zoneCounts[zone]++;
            const z = ZONES[zone];
            const tx = z.x + COLS[idx % 3];
            const ty = ROWS[Math.floor(idx / 3)];
            tween(ghost)
                .to(0.18, { position: new Vec3(tx, ty, 0) })
                .call(() => {
                    ghost.destroy();
                    this.spawnChip(def, tx, ty);
                })
                .start();
            this.renderPage();
            this.clearMissingHi();
        } else {
            tween(ghost).to(0.2, { position: this.cardHome(def) }).call(() => ghost.destroy()).start();
        }
    }

    private spawnChip(def: BagItem, x: number, y: number): void {
        const n = Img.sprite(this.placedLayer, def.key, CHIP, x, y);
        n.setScale(0.7, 0.7, 1);
        tween(n).to(0.12, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
    }

    private cardHome(def: BagItem): Vec3 {
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

    private bubble(msg: string, holdMs = 4200): void {
        this.bubbleL.string = msg;
        this.bubbleN.active = true;
        const op = opacity(this.bubbleN);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        tween(op).delay(holdMs / 1000).to(0.3, { opacity: 0 }).call(() => { this.bubbleN.active = false; }).start();
    }

    /** 高亮缺失的必要物品卡片：跳到所在页 + 粉色描边脉冲 */
    private highlightMissing(miss: BagItem[]): void {
        const first = ITEMS.findIndex((it) => it.key === miss[0].key);
        const page = Math.floor(first / PAGE_SIZE);
        if (page !== this.page) {
            this.page = page;
            this.renderPage();
            this.refreshDots();
        }
        for (const c of this.cards) {
            if (miss.some((m) => m.key === c.def.key)) {
                const ring = block(this.cardLayer, CARD_W + 14, CARD_W + 14, new Color(0, 0, 0, 0), 22, c.x, CARD_Y, Col.pink, 5);
                ring.name = 'missHi';
                tween(ring).to(0.5, { scale: new Vec3(1.06, 1.06, 1) }).to(0.5, { scale: new Vec3(1, 1, 1) }).union().repeat(3).call(() => ring.destroy()).start();
            }
        }
    }

    private clearMissingHi(): void {
        this.cardLayer.children.slice().forEach((n) => {
            if (n.name === 'missHi') n.destroy();
        });
    }

    /** 确认：缺必要物品时先提示一次、再宽慰一次；两半都能放 */
    private confirm(): void {
        if (this.busy) return;
        const miss = ITEMS.filter((it) => it.req && !this.packed.has(it.key));
        if (miss.length && this.tries === 0) {
            this.tries = 1;
            this.bubble('还有一类重要物品没有准备。你想先检查证件资料、妈妈用品，还是宝宝出院用品？');
            this.highlightMissing(miss);
            return;
        }
        if (miss.length && this.tries === 1) {
            this.tries = 2;
            this.bubble('好，缺的这几样到住院后也可以让家人送来。', 1800);
            this.busy = true;
            setTimeout(() => this.finish('先这样，到了医院也能补齐'), 1900);
            return;
        }
        this.finish('待产包收拾好了！');
    }

    private finish(msg: string): void {
        this.busy = true;
        this.toast(msg, 900);
        setTimeout(() => {
            const op = opacity(this.root);
            tween(op).to(0.3, { opacity: 0 }).call(() => {
                this.root.active = false;
                this.busy = false;
                const r = this.resolve;
                this.resolve = null;
                if (r) r();
            }).start();
        }, 1050);
    }

    /* ---------------- 调试入口 ---------------- */

    /** 直接放一个物品进指定半区（0 必要 / 1 可选） */
    debugPlace(key: string, zone = 0): void {
        const def = ITEMS.find((d) => d.key === key);
        if (!def || this.packed.has(key)) return;
        this.packed.set(key, zone);
        const idx = this.zoneCounts[zone]++;
        const z = ZONES[zone];
        this.spawnChip(def, z.x + COLS[idx % 3], ROWS[Math.floor(idx / 3)]);
        this.renderPage();
    }

    /** 调试：直接按确认 */
    debugConfirm(): void {
        this.confirm();
    }

    /** 调试：查询仍缺的必要物品 */
    missingRequired(): string[] {
        return ITEMS.filter((it) => it.req && !this.packed.has(it.key)).map((it) => it.name);
    }

    private toLocal(e: EventTouch): Vec3 {
        const p = e.getUILocation();
        return this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    }
}
