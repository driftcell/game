import { Color, EventTouch, Graphics, Label, Node, Tween, tween, UITransform, Vec2, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

interface ItemDef {
    key: string;          // 资源 key
    name: string;         // 卡片文字
    safe: boolean;        // 安全物品：吸附摆放；否则弹回并提示
    hint?: string;        // 不安全物品的说明
    slot?: Vec2;          // 吸附点（根节点坐标，估算值，按预览微调）
    scale?: number;       // 房间内的显示大小
    z?: number;           // 叠放顺序
}

/** 顺序与设计稿物品栏三页一致：5 / 5 / 2 */
const ITEMS: ItemDef[] = [
    { key: 'crib', name: '婴儿床', safe: true, slot: new Vec2(200, -68), scale: 1.75, z: 30 },
    { key: 'mattress', name: '坚实床垫', safe: true, slot: new Vec2(200, -68), scale: 1.5, z: 0 },
    { key: 'pillow', name: '枕头', safe: false, hint: '1 岁前不需要枕头，会增加窒息风险' },
    { key: 'quilt', name: '被子', safe: false, hint: '被子容易捂住口鼻，换成睡袋更安全' },
    { key: 'crib_bumper', name: '床围', safe: false, hint: '床围有缠绕和窒息风险，不要围在婴儿床边' },
    { key: 'plush', name: '毛绒玩具', safe: false, hint: '宝宝睡觉时，婴儿床里不放毛绒玩具' },
    { key: 'sleep_bag', name: '睡袋', safe: true, slot: new Vec2(200, -68), scale: 1.3, z: 10 },
    { key: 'hat', name: '帽子', safe: false, hint: '睡觉时不给宝宝戴帽子' },
    { key: 'socks', name: '智能监控袜', safe: true, slot: new Vec2(200, -68), scale: 1.05, z: 20 },
    { key: 'mobile', name: '床铃', safe: false, hint: '床铃要挂在宝宝够不到的位置，睡觉前先移开' },
    { key: 'basket', name: '收纳筐', safe: true, slot: new Vec2(295, -245), scale: 1.3, z: 40 },
    { key: 'night_light', name: '小夜灯', safe: true, slot: new Vec2(60, -165), scale: 1.0, z: 40 },
];

const SAFE_COUNT = ITEMS.filter((d) => d.safe).length;
const PAGE_SIZE = 5;
const CARD_W = 126;
const CARD_GAP = 16;
const CARD_Y = 74;          // 面板局部坐标
const LABEL_Y = -45;
const DOTS_Y = -98;
const ARROW_Y = -143;
const HEADER_Y = 190;
const PANEL_TOP = -368;     // 根坐标：面板上边缘
const PANEL_H = 444;
const PANEL_CY = PANEL_TOP - PANEL_H / 2;

/**
 * 第一章小游戏：布置安全睡眠区。
 * 从底部物品栏把物品拖进房间：安全物品吸附到预设位置，危险物品弹回并给出安全提示。
 * 物品栏 5/5/2 三页，可左右滑动或点箭头翻页。
 */
export class SleepRoomView {
    root: Node;
    private panel: Node;
    private cardLayer: Node;
    private placedLayer: Node;
    private dragLayer: Node;
    private hintN: Node;
    private hintL: Label;
    private dots: Node[] = [];
    private arrows: { x: number; dir: number }[] = [];
    private cards: { def: ItemDef; x: number; node: Node }[] = [];
    private placedNodes = new Map<string, Node>();
    private placed = new Set<string>();
    private page = 0;
    private ghost: Node | null = null;
    private dragDef: ItemDef | null = null;
    private start = new Vec2();
    private axis: 'none' | 'drag' | 'swipe' = 'none';
    private busy = false;
    private resolve: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'sleeproom');
        // 全屏吞掉下层点击（任务卡、对白等）
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        const ct = catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        catcher.on(Node.EventType.TOUCH_START, () => { /* 吞掉 */ });
        catcher.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        Img.sprite(this.root, 'bedroom', DW, 0, 0);

        this.placedLayer = new Node('placed');
        this.root.addChild(this.placedLayer);
        ui(this.placedLayer, DW, DH);

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

        this.hintN = block(this.root, 600, 88, new Color(35, 30, 35, 228), 20, 0, 20);
        this.hintL = labelInBox(this.hintN, '', 560, 80, { size: 26, color: Col.white });
        opacity(this.hintN).opacity = 0;

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
        this.placedNodes.clear();
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
            Img.sprite(card, def.key, 92, 0, 6);
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

    private onDown(e: EventTouch): void {
        if (this.busy) return;
        const p = this.toLocal(e);
        this.start.set(p.x, p.y);
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
                const s = this.dragDef.scale ?? 1;
                this.ghost = Img.sprite(this.dragLayer, this.dragDef.key, 100 * s, p.x, p.y + 60);
                opacity(this.ghost).opacity = 235;
            }
        }
        if (this.axis === 'drag' && this.ghost) {
            this.ghost.setPosition(p.x, p.y + 60, 0);
        }
    }

    private onUp(e: EventTouch): void {
        if (this.busy) return;
        const p = this.toLocal(e);
        if (this.axis === 'drag' && this.ghost && this.dragDef) {
            this.drop(p);
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
    }

    private onCancel(): void {
        if (this.ghost) { this.ghost.destroy(); this.ghost = null; }
        this.axis = 'none';
        this.dragDef = null;
    }

    private drop(p: Vec3): void {
        const def = this.dragDef!;
        const ghost = this.ghost!;
        this.ghost = null;
        if (def.safe && p.y > PANEL_TOP + 20) {
            const slot = def.slot!;
            this.placed.add(def.key);
            this.placedNodes.set(def.key, ghost);
            tween(ghost)
                .to(0.18, { position: new Vec3(slot.x, slot.y, 0) })
                .call(() => {
                    ghost.setParent(this.placedLayer);
                    ghost.setPosition(slot.x, slot.y, 0);
                    this.restack();
                })
                .start();
            this.renderPage();
            if (this.placed.size >= SAFE_COUNT) this.finish();
        } else {
            tween(ghost).to(0.2, { position: this.cardHome(def) }).call(() => ghost.destroy()).start();
            if (!def.safe && def.hint) this.toast(def.hint);
        }
    }

    private cardHome(def: ItemDef): Vec3 {
        const c = this.cards.find((it) => it.def.key === def.key);
        const x = c ? c.x : 0;
        return new Vec3(this.panel.position.x + x, this.panel.position.y + CARD_Y, 0);
    }

    private restack(): void {
        ITEMS.filter((d) => this.placedNodes.has(d.key))
            .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
            .forEach((d, i) => this.placedNodes.get(d.key)!.setSiblingIndex(i));
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
        this.toast('睡眠区布置完成！', 900);
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
