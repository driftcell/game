import { Button, Color, EventTouch, Graphics, HorizontalTextAlignment, Label, Node, Tween, tween, UITransform, Vec2, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

interface ItemDef {
    key: string;          // 资源 key
    name: string;         // 卡片文字
    safe: boolean;        // 安全物品：吸附摆放；否则弹回并提示
    hint?: string;        // 不安全物品的说明
    slot?: Vec2;          // 吸附点（根节点坐标，估算值，按预览微调）
    scale?: number;       // 房间内的显示大小
    z?: number;           // 叠放顺序
    vanish?: boolean;     // 放到床里：飞入后淡出销毁，不做重叠显示
}

/** 顺序与设计稿物品栏三页一致：5 / 5 / 2 */
const ITEMS: ItemDef[] = [
    { key: 'crib', name: '婴儿床', safe: true, slot: new Vec2(200, -68), scale: 1.75, z: 30 },
    { key: 'mattress', name: '坚实床垫', safe: true, slot: new Vec2(200, -68), scale: 1.5, z: 0, vanish: true },
    { key: 'pillow', name: '枕头', safe: false, hint: '1 岁前不需要枕头，会增加窒息风险' },
    { key: 'quilt', name: '被子', safe: false, hint: '被子容易捂住口鼻，换成睡袋更安全' },
    { key: 'crib_bumper', name: '床围', safe: false, hint: '床围有缠绕和窒息风险，不要围在婴儿床边' },
    { key: 'plush', name: '毛绒玩具', safe: false, hint: '宝宝睡觉时，婴儿床里不放毛绒玩具' },
    // 放到床里的东西（床垫/睡袋/袜子）vanish：飞入床中后隐藏
    { key: 'sleep_bag', name: '睡袋', safe: true, slot: new Vec2(198, -72), scale: 0.75, z: 35, vanish: true },
    { key: 'hat', name: '帽子', safe: false, hint: '睡觉时不给宝宝戴帽子' },
    { key: 'socks', name: '智能监控袜', safe: true, slot: new Vec2(232, -88), scale: 0.45, z: 36, vanish: true },
    { key: 'mobile', name: '床铃', safe: false, hint: '床铃要挂在宝宝够不到的位置，睡觉前先移开' },
    // 收纳筐放在婴儿床前的地毯上；小夜灯放在大床与婴儿床之间的空地
    { key: 'basket', name: '收纳筐', safe: true, slot: new Vec2(215, -205), scale: 1.15, z: 40 },
    { key: 'night_light', name: '小夜灯', safe: true, slot: new Vec2(70, -85), scale: 0.6, z: 40 },
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
 * 床+床垫放好 → 睡眠空间检查卡（进行中）→ 床上出现「!」观察点（我现在看到的）；
 * 全部放好 → 检查卡（全绿）→ 交还后由 GameApp 接知识卡。
 */
export class SleepRoomView {
    root: Node;
    private panel: Node;
    private cardLayer: Node;
    private placedLayer: Node;
    private dragLayer: Node;
    private modalLayer: Node;
    private hintN: Node;
    private hintL: Label;
    private bangN: Node | null = null;
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
    private cardOpen = false;
    private partialShown = false;
    private badgeShown = false;
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

        // 弹卡层（检查卡/观察卡），最顶层
        this.modalLayer = new Node('modal');
        this.root.addChild(this.modalLayer);
        ui(this.modalLayer, DW, DH);

        this.panel.on(Node.EventType.TOUCH_START, this.onDown, this);
        this.panel.on(Node.EventType.TOUCH_MOVE, this.onMove, this);
        this.panel.on(Node.EventType.TOUCH_END, this.onUp, this);
        this.panel.on(Node.EventType.TOUCH_CANCEL, this.onCancel, this);

        this.root.active = false;
    }

    /** 进入小游戏：重置并淡入，返回的 Promise 在布置完成后 resolve（房间保留作知识卡背景） */
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
        this.cardOpen = false;
        this.partialShown = false;
        this.badgeShown = false;
        if (this.bangN) { this.bangN.destroy(); this.bangN = null; }
        this.modalLayer.removeAllChildren();
        opacity(this.panel).opacity = 255;
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

    private onCancel(e: EventTouch): void {
        // 拖到面板外松手时 Cocos 触发 CANCEL 而非 END，仍需处理放置
        if (this.axis === 'drag' && this.ghost && this.dragDef) {
            const p = this.toLocal(e);
            this.drop(p);
        } else if (this.ghost) {
            this.ghost.destroy();
            this.ghost = null;
        }
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
            if (def.vanish) {
                tween(ghost).to(0.18, { position: new Vec3(slot.x, slot.y, 0) }).start();
                tween(opacity(ghost)).delay(0.18).to(0.12, { opacity: 0 }).call(() => ghost.destroy()).start();
            } else {
                this.placedNodes.set(def.key, ghost);
                tween(ghost)
                    .to(0.18, { position: new Vec3(slot.x, slot.y, 0) })
                    .call(() => {
                        ghost.setParent(this.placedLayer);
                        ghost.setPosition(slot.x, slot.y, 0);
                        this.restack();
                    })
                    .start();
            }
            this.renderPage();
            this.maybeCards();
        } else {
            tween(ghost).to(0.2, { position: this.cardHome(def) }).call(() => ghost.destroy()).start();
            if (!def.safe && def.hint) this.toast(def.hint);
        }
    }

    /** 调试：直接放置一个安全物品（跳过拖拽动画） */
    debugPlace(key: string): void {
        const def = ITEMS.find((d) => d.key === key);
        if (!def || !def.safe || this.placed.has(key)) return;
        this.placed.add(key);
        if (!def.vanish) {
            const s = def.scale ?? 1;
            const slot = def.slot!;
            const node = Img.sprite(this.placedLayer, key, 100 * s, slot.x, slot.y);
            this.placedNodes.set(key, node);
            this.restack();
        }
        this.renderPage();
        this.maybeCards();
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

    /* ---------------- 检查卡 / 观察卡 ---------------- */

    /** 每次放置后推进卡片节奏 */
    private maybeCards(): void {
        if (this.cardOpen) return;
        const p = this.placed;
        // 床+床垫放好但还没放睡袋：先弹一次检查卡（进行中状态）
        if (!this.partialShown && p.has('crib') && p.has('mattress') && !p.has('sleep_bag')) {
            this.partialShown = true;
            this.busy = true;
            void this.openCheckCard(false).then(() => {
                this.busy = false;
                this.maybeCards();
            });
            return;
        }
        // 床+床垫就绪后，在床上挂「!」观察点
        if (!this.badgeShown && p.has('crib') && p.has('mattress')) {
            this.badgeShown = true;
            this.showBang();
        }
        // 全部安全物品放完：总结检查卡（全绿）→ 收尾
        if (p.size >= SAFE_COUNT) {
            this.busy = true;
            void this.openCheckCard(true).then(() => this.finish());
        }
    }

    /** 睡眠空间检查卡：小智探头 + 图钉 + 三项清单；全绿用「好极了！」，否则「先这样，等下再说」 */
    private openCheckCard(allDone: boolean): Promise<void> {
        this.cardOpen = true;
        const L = this.modalLayer;
        L.removeAllChildren();
        return new Promise<void>((resolve) => {
            const close = (): void => {
                this.cardOpen = false;
                L.removeAllChildren();
                resolve();
            };
            const dim = block(L, 20000, 20000, new Color(30, 20, 30, 110));
            dim.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

            const W = 580;
            const H = 560;
            const cy = 330;
            const card = block(L, W, H, Col.white, 24, 0, cy, Col.line);
            card.setScale(0.9, 0.9, 1);
            tween(card).to(0.2, { scale: new Vec3(1, 1, 1) }).start();
            // 小智探头（左上外沿）+ 图钉（右上）
            Img.sprite(card, 'xz_peek', 150, -W / 2 + 80, H / 2 + 24);
            Img.sprite(card, 'pin', 44, W / 2 - 26, H / 2 - 6);

            label(card, '♥ 睡眠空间检查 ♥', { size: 34, bold: true, color: Col.pinkDeep }, 0, H / 2 - 86);
            label(card, allDone ? '你已经完成了所有睡眠空间要求！' : '目前的进度：', { size: 24, color: Col.gray }, 0, H / 2 - 136);

            const checks = [
                { key: 'crib', text: '宝宝有独立睡眠空间。' },
                { key: 'mattress', text: '睡眠表面坚实、平坦、非倾斜。' },
                { key: 'sleep_bag', text: '床内没有枕头、被子、床围、毛绒玩具等松软物品。' },
            ];
            let y = H / 2 - 196;
            for (const c of checks) {
                const done = this.placed.has(c.key);
                if (done) {
                    Img.sprite(card, 'check_green', 44, -W / 2 + 56, y);
                } else {
                    block(card, 40, 40, new Color(228, 224, 228), 10, -W / 2 + 56, y);
                }
                labelInBox(card, c.text, 420, 72, { size: 26, color: done ? Col.ink : Col.gray, hAlign: HorizontalTextAlignment.LEFT, lineHeight: 34 }, -W / 2 + 304, y);
                y -= 82;
            }

            if (allDone) {
                const btn = Img.sprite(card, 'btn_great', 300, 0, -H / 2 + 86);
                label(btn, '好极了！', { size: 32, bold: true, color: Col.white });
                const bb = btn.addComponent(Button);
                bb.transition = Button.Transition.SCALE;
                bb.zoomScale = 0.94;
                bb.target = btn;
                btn.once(Button.EventType.CLICK, close);
            } else {
                button(card, '先这样，等下再说', close, { w: 380, h: 84, y: -H / 2 + 78, size: 30 });
                // 小智提示气泡（卡下）
                const tip = block(L, 560, 84, Col.white, 16, 0, cy - H / 2 - 70);
                labelInBox(tip, '小智：要不要从宝宝真正睡觉时的安全角度再检查一次？', 528, 76, { size: 24, color: Col.pinkDeep, lineHeight: 32 });
            }
        });
    }

    /** 婴儿床上的橙色「!」观察点（呼吸脉冲，点开观察卡） */
    private showBang(): void {
        const n = new Node('bang');
        this.root.addChild(n);
        ui(n, 56, 56, 285, 22);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(245, 130, 40);
        g.circle(0, 0, 28);
        g.fill();
        label(n, '!', { size: 38, bold: true, color: Col.white }, 0, 1);
        tween(n).to(0.7, { scale: new Vec3(1.15, 1.15, 1) }).to(0.7, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();
        n.on(Node.EventType.TOUCH_END, () => {
            if (this.cardOpen) return;
            void this.openObsCard();
        });
        this.bangN = n;
    }

    /** 「我现在看到的」观察卡：底部滑出，点击任意处关闭 */
    private openObsCard(): Promise<void> {
        this.cardOpen = true;
        this.busy = true;
        const L = this.modalLayer;
        L.removeAllChildren();
        return new Promise<void>((resolve) => {
            const close = (): void => {
                tween(card).to(0.25, { position: new Vec3(0, cardY - DH, 0) }).call(() => {
                    this.cardOpen = false;
                    this.busy = false;
                    L.removeAllChildren();
                    resolve();
                }).start();
            };
            const dim = block(L, 20000, 20000, new Color(30, 20, 30, 110));
            dim.on(Node.EventType.TOUCH_END, close);

            const W = 700;
            const H = 430;
            const cardY = -DH / 2 + H / 2 + 60;
            const card = block(L, W, H, Col.white, 32, 0, cardY - DH);
            card.name = 'obs';
            const header = block(card, W, 92, Col.pink, 32, 0, H / 2 - 46);
            block(header, W, 40, Col.pink, 0, 0, -26);
            label(header, '我现在看到的', { size: 32, bold: true, color: Col.white });

            const rows = ['床面平坦、坚实；', '床内只有一张贴合的床垫；', '床就放在我们床的旁边。'];
            let y = H / 2 - 140;
            rows.forEach((t, i) => {
                label(card, `①②③`[i], { size: 30, bold: true, color: Col.pink }, -W / 2 + 70, y);
                labelInBox(card, t, 500, 64, { size: 28, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT }, -W / 2 + 330, y);
                y -= 88;
            });
            label(card, '（点击任意处继续）', { size: 22, color: Col.gray }, 0, -H / 2 + 44);
            card.on(Node.EventType.TOUCH_END, close);
            tween(card).to(0.3, { position: new Vec3(0, cardY, 0) }, { easing: 'cubicOut' }).start();
        });
    }

    private finish(): void {
        this.busy = true;
        if (this.bangN) { this.bangN.destroy(); this.bangN = null; }
        this.toast('睡眠区布置完成！', 900);
        setTimeout(() => {
            // 只收起物品栏，保留布置好的房间作为知识卡背景；交还后由 close() 淡出
            tween(opacity(this.panel)).to(0.3, { opacity: 0 }).start();
            const r = this.resolve;
            this.resolve = null;
            if (r) r();
        }, 1000);
    }

    /** 知识卡收进手机后调用：淡出整个房间 */
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

    private toLocal(e: EventTouch): Vec3 {
        const p = e.getUILocation();
        return this.root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    }
}
