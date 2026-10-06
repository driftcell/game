import { Color, EventTouch, Graphics, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

interface ShopItem {
    key: string;      // 资源 key
    name: string;     // 卡片文字
    col: number;      // 正确列：0 现在就要 / 1 可以晚一点 / 2 不需要
    hint: string;     // 放错列时的温柔科普
}

/** 顺序按物品栏分页（5/5），两列交错避免连续同列 */
const ITEMS: ShopItem[] = [
    { key: 'diaper', name: '尿布', col: 0, hint: '尿布从出生第一天就要用，是每天必需的消耗品' },
    { key: 'mobile', name: '床铃', col: 1, hint: '宝宝两个月后才会追视床铃，可以晚一点再买' },
    { key: 'powder', name: '爽身粉', col: 2, hint: '粉末容易被宝宝吸入呼吸道，其实不需要买' },
    { key: 'wipes', name: '湿巾', col: 0, hint: '换尿布、擦手都离不开，属于现在就要' },
    { key: 'basket', name: '收纳筐', col: 1, hint: '收纳可以慢慢添置，不急在今天' },
    { key: 'cream', name: '护臀膏', col: 0, hint: '红屁屁很常见，护臀膏从出生就要常备' },
    { key: 'night_light', name: '小夜灯', col: 1, hint: '夜里喂奶用得上，但可以之后再买' },
    { key: 'clothes', name: '宝宝衣物', col: 0, hint: '宝宝长得快，先备 3–5 件就够穿了' },
    { key: 'socks', name: '监控袜', col: 1, hint: '不是必需品，想安心可以以后再考虑' },
    { key: 'mattress', name: '婴儿床垫', col: 0, hint: '宝宝第一晚就要睡，床垫要提前买好散味' },
];

const COLS = [
    { name: '现在就要', color: Col.pink, fill: Col.pinkSoft },
    { name: '可以晚一点', color: new Color(240, 170, 90), fill: new Color(253, 242, 226) },
    { name: '不需要', color: Col.gray, fill: new Color(241, 238, 241) },
];

const PAGE_SIZE = 5;
const CARD_W = 126;
const CARD_GAP = 16;
const CARD_Y = 55;           // 面板局部坐标
const LABEL_Y = -60;
const DOTS_Y = -112;
const ARROW_Y = -158;
const HEADER_Y = 182;
const PANEL_TOP = -400;      // 根坐标：面板上边缘
const PANEL_H = 420;
const PANEL_CY = PANEL_TOP - PANEL_H / 2;

const COL_W = 226;
const COL_GAP = 18;
const COL_X = [-(COL_W + COL_GAP), 0, COL_W + COL_GAP];
const COL_HEADER_Y = 500;
const COL_BODY_TOP = 460;
const COL_BODY_BOT = -384;
const COL_BODY_H = COL_BODY_TOP - COL_BODY_BOT;
const COL_BODY_CY = (COL_BODY_TOP + COL_BODY_BOT) / 2;
const PILL_W = COL_W - 28;
const PILL_H = 60;
const PILL_GAP = 12;

/**
 * 第一章小游戏：整理购物清单。
 * 把物品栏里的东西拖进三列（现在就要 / 可以晚一点 / 不需要）：
 * 放对吸附成清单条目，放错弹回并给出温柔科普，不扣分不失败。
 * 物品栏 5/5 两页，可左右滑动或点箭头翻页。
 */
export class ShoppingListView {
    root: Node;
    private panel: Node;
    private cardLayer: Node;
    private pillLayer: Node;
    private dragLayer: Node;
    private hintN: Node;
    private hintL: Label;
    private colBodies: Graphics[] = [];
    private dots: Node[] = [];
    private arrows: { x: number; dir: number }[] = [];
    private cards: { def: ShopItem; x: number; node: Node }[] = [];
    private placed = new Set<string>();
    private colCounts = [0, 0, 0];
    private page = 0;
    private hoverCol = -1;
    private ghost: Node | null = null;
    private dragDef: ShopItem | null = null;
    private start = new Vec3();
    private axis: 'none' | 'drag' | 'swipe' = 'none';
    private busy = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'shoppinglist');
        // 全屏吞掉下层点击（任务卡、对白等）
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        block(this.root, DW, DH, Col.pinkPale);
        // 标题下移避开右上角孕周徽章
        label(this.root, '整理购物清单', { size: 40, bold: true, color: Col.ink }, 0, 618);
        label(this.root, '把物品拖到合适的清单里', { size: 24, color: Col.gray }, 0, 568);

        // 三列目标区
        COLS.forEach((c, i) => {
            block(this.root, COL_W, 64, c.color, 20, COL_X[i], COL_HEADER_Y);
            label(this.root, c.name, { size: 26, bold: true, color: Col.white }, COL_X[i], COL_HEADER_Y);
            const body = block(this.root, COL_W, COL_BODY_H, c.fill, 20, COL_X[i], COL_BODY_CY, Col.line);
            this.colBodies.push(body.getComponent(Graphics)!);
        });

        this.pillLayer = new Node('pills');
        this.root.addChild(this.pillLayer);
        ui(this.pillLayer, DW, DH);

        // 提示浮在列底与物品栏之间，避免遮挡标题和列头
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

    /** 进入小游戏：重置并淡入，返回的 Promise 在整理完成后 resolve */
    play(): Promise<void> {
        this.page = 0;
        this.placed.clear();
        this.colCounts = [0, 0, 0];
        this.hoverCol = -1;
        this.paintBodies();
        this.pillLayer.removeAllChildren();
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
            Img.icon(card, def.key, def.name, 92, 0, 6);
            label(this.cardLayer, def.name, { size: 24, color: new Color(242, 234, 238) }, x, LABEL_Y);
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

    private paintBodies(): void {
        this.colBodies.forEach((g, i) => {
            const hovered = i === this.hoverCol;
            paintBlock(g, COL_W, COL_BODY_H, COLS[i].fill, 20, hovered ? COLS[i].color : Col.line, hovered ? 6 : 2);
        });
    }

    private setHover(col: number): void {
        if (col === this.hoverCol) return;
        this.hoverCol = col;
        this.paintBodies();
    }

    private pillY(i: number): number {
        return COL_BODY_TOP - 16 - PILL_H / 2 - i * (PILL_H + PILL_GAP);
    }

    private hitCol(p: Vec3): number {
        if (p.y > COL_HEADER_Y + 40 || p.y < COL_BODY_BOT - 12) return -1;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(p.x - COL_X[i]) <= COL_W / 2 + 10) return i;
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
                this.ghost = Img.icon(this.dragLayer, this.dragDef.key, this.dragDef.name, 100, p.x, p.y + 60);
                opacity(this.ghost).opacity = 235;
            }
        }
        if (this.axis === 'drag' && this.ghost) {
            this.ghost.setPosition(p.x, p.y + 60, 0);
            this.setHover(this.hitCol(this.ghost.position));
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
        const col = this.hitCol(p);
        if (col === def.col) {
            this.placed.add(def.key);
            const idx = this.colCounts[def.col]++;
            const tx = COL_X[def.col];
            const ty = this.pillY(idx);
            tween(ghost)
                .to(0.18, { position: new Vec3(tx, ty, 0) })
                .call(() => {
                    ghost.destroy();
                    this.spawnPill(def, tx, ty);
                })
                .start();
            this.renderPage();
            if (this.placed.size >= ITEMS.length) this.finish();
        } else {
            tween(ghost).to(0.2, { position: this.cardHome(def) }).call(() => ghost.destroy()).start();
            if (col >= 0) this.toast(def.hint);
        }
    }

    private spawnPill(def: ShopItem, x: number, y: number): void {
        const pill = block(this.pillLayer, PILL_W, PILL_H, Col.white, 14, x, y, Col.line);
        Img.icon(pill, def.key, def.name, 44, -PILL_W / 2 + 36, 0);
        label(pill, def.name, { size: 24, color: Col.ink }, 14, 0);
        pill.setScale(0.7, 0.7, 1);
        tween(pill).to(0.12, { scale: new Vec3(1.06, 1.06, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
    }

    /** 调试：直接放置一个物品（跳过拖拽动画） */
    debugPlace(key: string): void {
        const def = ITEMS.find((d) => d.key === key);
        if (!def || this.placed.has(key)) return;
        this.placed.add(key);
        const idx = this.colCounts[def.col]++;
        this.spawnPill(def, COL_X[def.col], this.pillY(idx));
        this.renderPage();
        if (this.placed.size >= ITEMS.length) this.finish();
    }

    private cardHome(def: ShopItem): Vec3 {
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
        this.toast('清单整理好了！', 900);
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
