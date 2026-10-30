import { Color, Graphics, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { GameState } from '../core/GameState';
import { SHOP_CATEGORIES, ShopCategoryId, ShopProduct, productsOf } from '../core/ShopData';
import { block, Col, DH, DW, label, labelInBox, layer, starNode, ui } from '../core/UITheme';
import type { PopupView } from './PopupView';

const GRID_W = 330;
const GRID_H = 300;
const GRID_GAP = 20;

/**
 * 手机里的「慢慢商店」：暖木家居 / 布丁软装 / 小星星童装 / 出门准备。
 * 展示台 + 价签的邻里小店感；没有倒计时、没有折扣，买过的商品会标「已拥有」。
 */
export class ShopView {
    root: Node;
    popup: PopupView | null = null;
    onClose: () => void = () => {};
    onPurchase: () => void = () => {};
    private starL: Label;
    private starPill: Node;
    private tabLayer: Node;
    private gridLayer: Node;
    private toastN: Node;
    private toastL: Label;
    private category: ShopCategoryId = 'wood';

    constructor(parent: Node) {
        this.root = layer(parent, 'shop');
        block(this.root, 4000, 4000, new Color(253, 244, 240));
        // 两团很淡的暖光，让纸面不显得平
        block(this.root, 900, 900, new Color(252, 226, 237, 110), 450, -270, 720);
        block(this.root, 760, 760, new Color(247, 232, 214, 100), 380, 300, -620);

        label(this.root, '慢慢商店', { size: 40, bold: true, color: Col.ink }, -40, 740);
        label(this.root, '把家一点点填满，不着急', { size: 23, color: Col.gray }, -40, 696);

        const backHit = block(this.root, 160, 100, new Color(255, 255, 255, 1), 0, -305, 740);
        const back = block(backHit, 120, 64, Col.white, 30, 0, 0, Col.line);
        label(back, '返回', { size: 23, color: Col.pinkDeep, bold: true });
        backHit.on(Node.EventType.TOUCH_END, () => this.close());

        this.starPill = block(this.root, 190, 56, Col.white, 28, 238, 740, Col.line);
        starNode(this.starPill, 28, Col.gold, -56, 1);
        this.starL = label(this.starPill, '0', { size: 26, bold: true, color: Col.pinkDeep }, 18, 1);

        this.drawAwning();

        this.tabLayer = new Node('tabs');
        this.root.addChild(this.tabLayer);
        ui(this.tabLayer, DW, 72, 0, 550);

        this.gridLayer = new Node('grid');
        this.root.addChild(this.gridLayer);
        ui(this.gridLayer, DW, DH);

        label(this.root, '完成小游戏和成就会获得小星星。这里没有限时折扣。', { size: 20, color: Col.gray }, 0, -520);

        this.toastN = block(this.root, 620, 64, new Color(72, 60, 68, 232), 22, 0, -590);
        this.toastL = label(this.toastN, '', { size: 23, color: Col.white });
        const toastOp = this.toastN.addComponent(UIOpacity);
        toastOp.opacity = 0;

        this.root.active = false;
    }

    get isOpen(): boolean {
        return this.root.active;
    }

    open(): void {
        this.root.active = true;
        const toastOp = this.toastN.getComponent(UIOpacity)!;
        toastOp.opacity = 0;
        this.refreshStars();
        this.buildTabs();
        this.buildGrid();
        const op = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.18, { opacity: 255 }).start();
    }

    close(): void {
        this.root.active = false;
        this.onClose();
    }

    refresh(): void {
        if (!this.root.active) return;
        this.refreshStars();
        this.buildTabs();
        this.buildGrid();
    }

    private drawAwning(): void {
        const n = new Node('awning');
        this.root.addChild(n);
        ui(n, DW, 96, 0, 630);
        const g = n.addComponent(Graphics);
        const stripes = 10;
        const w = DW / stripes;
        for (let i = 0; i < stripes; i++) {
            g.fillColor = i % 2 === 0 ? new Color(244, 198, 209) : new Color(250, 225, 230);
            const x = -DW / 2 + i * w;
            g.rect(x, 0, w, 32);
            g.fill();
            g.circle(x + w / 2, 0, w / 2);
            g.fill();
        }
    }

    private buildTabs(): void {
        this.tabLayer.removeAllChildren();
        SHOP_CATEGORIES.forEach((c, i) => {
            const x = -264 + i * 176;
            const active = c.id === this.category;
            const hit = block(this.tabLayer, 180, 96, new Color(255, 255, 255, 1), 0, x, 0);
            const tab = block(hit, 168, 66, active ? Col.pink : Col.white, 18, 0, 0,
                active ? Col.pink : Col.line, 2);
            label(tab, c.name, { size: 23, bold: active, color: active ? Col.white : Col.ink });
            hit.on(Node.EventType.TOUCH_END, () => {
                if (this.category === c.id) return;
                this.category = c.id;
                this.buildTabs();
                this.buildGrid();
                tween(this.gridLayer).to(0.12, { scale: new Vec3(0.99, 0.99, 1) })
                    .to(0.12, { scale: new Vec3(1, 1, 1) }).start();
            });
        });
    }

    private buildGrid(): void {
        this.gridLayer.removeAllChildren();
        const items = productsOf(this.category);
        const xs = [-175, 175];
        items.forEach((p, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const lastOdd = items.length % 2 === 1 && i === items.length - 1;
            const x = lastOdd ? 0 : xs[col];
            const y = 320 - row * (GRID_H + GRID_GAP);
            this.buildCard(p, x, y);
        });
    }

    private buildCard(p: ShopProduct, x: number, y: number): void {
        const owned = GameState.hasItem(p.id);
        const cat = SHOP_CATEGORIES.find((c) => c.id === p.category)!;
        const tint = new Color(cat.tint[0], cat.tint[1], cat.tint[2]);
        const card = block(this.gridLayer, GRID_W, GRID_H, Col.white, 26, x, y, Col.line);
        block(card, 292, 146, tint, 18, 0, 62);
        block(card, 244, 5, new Color(255, 255, 255, 190), 3, 0, -4);
        block(card, 244, 12, new Color(72, 60, 68, 10), 6, 0, -12);
        Img.icon(card, p.asset, p.name, 108, 0, 68);
        if (owned) {
            const badge = block(card, 92, 34, new Color(122, 154, 126, 235), 17, 92, 122);
            label(badge, '已拥有', { size: 17, bold: true, color: Col.white });
        }
        label(card, p.name, { size: 24, bold: true, color: Col.ink }, 0, -38);
        label(card, p.tag, { size: 21, color: Col.gray }, 0, -74);
        starNode(card, 24, owned ? new Color(200, 192, 198) : Col.gold, -120, -120);
        label(card, String(p.price), { size: 25, bold: true, color: owned ? Col.gray : Col.pinkDeep }, -70, -120);
        const buy = block(card, 118, 46, owned ? Col.pinkSoft : Col.pink, 16, 91, -120);
        label(buy, owned ? '已拥有' : '选购', { size: 20, bold: true, color: owned ? Col.gray : Col.white });
        card.on(Node.EventType.TOUCH_END, () => { void this.openDetail(p); });
    }

    private productArt(parent: Node, p: ShopProduct, size: number, x: number, y: number): void {
        // Img.icon 缺图时会自动退化成首字占位，保证商品卡不漏空
        Img.icon(parent, p.asset, p.name, size, x, y);
    }

    private async openDetail(p: ShopProduct): Promise<void> {
        if (!this.popup) return;
        const owned = GameState.hasItem(p.id);
        const enough = GameState.stars >= p.price;
        const buttons = owned
            ? [{ label: '好的', value: 'close', primary: true }]
            : [
                { label: '再想想', value: 'cancel' },
                {
                    label: enough ? `带回家 · ★${p.price}` : `还差 ${p.price - GameState.stars} 颗星`,
                    value: enough ? 'buy' : 'close',
                    primary: enough,
                },
            ];
        const res = await this.popup.custom({
            title: p.name,
            height: 780,
            build: (content) => this.buildDetail(content, p),
            buttons,
        });
        if (res.value !== 'buy' || owned) return;
        if (GameState.stars < p.price) {
            this.toast('小星星不够，完成小游戏就能攒到');
            return;
        }
        GameState.stars -= p.price;
        GameState.ownItem(p.id);
        GameState.save();
        this.refreshStars();
        this.buildGrid();
        this.toast(`已带回家：${p.name}`);
        this.onPurchase();
    }

    private buildDetail(content: Node, p: ShopProduct): void {
        const cat = SHOP_CATEGORIES.find((c) => c.id === p.category)!;
        const tint = new Color(cat.tint[0], cat.tint[1], cat.tint[2]);
        block(content, 500, 290, tint, 22, 0, 128);
        this.productArt(content, p, 186, 0, 138);
        const tag = block(content, 160, 42, new Color(122, 154, 126, 235), 21, 0, -40);
        label(tag, p.tag, { size: 20, bold: true, color: Col.white });
        labelInBox(content, p.desc, 500, 126, { size: 26, color: Col.ink, lineHeight: 38 }, 0, -120);
        label(content, '买下后可以在「我的」里看到', { size: 20, color: Col.gray }, 0, -210);
    }

    private refreshStars(): void {
        this.starL.string = String(GameState.stars);
        Tween.stopAllByTarget(this.starPill);
        this.starPill.setScale(new Vec3(1, 1, 1));
        tween(this.starPill).to(0.1, { scale: new Vec3(1.06, 1.06, 1) })
            .to(0.12, { scale: new Vec3(1, 1, 1) }).start();
    }

    private toast(msg: string): void {
        this.toastL.string = msg;
        const op = this.toastN.getComponent(UIOpacity)!;
        op.opacity = 255;
        this.toastN.setScale(new Vec3(0.92, 0.92, 1));
        tween(this.toastN).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
        tween(op).delay(1.6).to(0.25, { opacity: 0 }).start();
    }
}
