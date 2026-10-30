import { Color, Node, UIOpacity, tween } from 'cc';
import { Img } from '../core/Assets';
import { GameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { SHOP_PRODUCTS } from '../core/ShopData';
import { block, button, Col, DH, DW, label, labelInBox, layer, starNode, ui } from '../core/UITheme';

const CARD_W = 660;

/** 「我的」：玩家档案、星星与收藏、成就、存档状态。 */
export class ProfileView {
    root: Node;
    onClose: () => void = () => {};
    onGoShop: () => void = () => {};
    private content: Node;
    private toastN: Node;
    private toastL: ReturnType<typeof label>;

    constructor(parent: Node) {
        this.root = layer(parent, 'profile');
        block(this.root, 4000, 4000, new Color(253, 244, 240));
        block(this.root, 860, 860, new Color(252, 226, 237, 95), 430, -280, 730);
        block(this.root, 720, 720, new Color(247, 232, 214, 90), 360, 310, -660);

        label(this.root, '我的', { size: 40, bold: true, color: Col.ink }, -40, 740);
        label(this.root, '这间小屋，和你的这30天', { size: 22, color: Col.gray }, -40, 696);

        const back = block(this.root, 100, 52, Col.white, 26, -315, 740, Col.line);
        label(back, '返回', { size: 21, color: Col.pinkDeep, bold: true });
        back.on(Node.EventType.TOUCH_END, () => this.close());

        this.content = new Node('content');
        this.root.addChild(this.content);
        ui(this.content, DW, DH);

        this.toastN = block(this.root, 520, 64, new Color(72, 60, 68, 232), 22, 0, -520);
        this.toastL = label(this.toastN, '', { size: 23, color: Col.white });
        const op = this.toastN.addComponent(UIOpacity);
        op.opacity = 0;

        this.root.active = false;
    }

    get isOpen(): boolean {
        return this.root.active;
    }

    open(): void {
        this.root.active = true;
        const toastOp = this.toastN.getComponent(UIOpacity)!;
        toastOp.opacity = 0;
        this.refresh();
        const op = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.18, { opacity: 255 }).start();
    }

    close(): void {
        this.root.active = false;
        this.onClose();
    }

    refresh(): void {
        this.content.removeAllChildren();
        this.buildProfile();
        this.buildStats();
        this.buildCollection();
        this.buildAchievements();
        this.buildSave();
    }

    private buildProfile(): void {
        const card = block(this.content, CARD_W, 250, Col.white, 28, 0, 520, Col.line);
        Img.sprite(card, 'mom', 104, -250, 2);
        label(card, GameState.momName, { size: 32, bold: true, color: Col.ink }, -100, 64);
        label(card, `宝宝：${GameState.babyName}`, { size: 23, color: Col.gray }, -100, 14);
        const sup = GameState.supporterType === '独自一人' ? '这段旅程由你自己决定节奏' : `同行：${GameState.supporterLabel()}`;
        label(card, sup, { size: 21, color: Col.gray }, -100, -38);
        const pill = block(card, 170, 52, Col.pinkSoft, 26, 210, 66);
        starNode(pill, 24, Col.gold, -48, 0);
        label(pill, String(GameState.stars), { size: 24, bold: true, color: Col.pinkDeep }, 18, 0);
        label(card, '小星星', { size: 18, color: Col.gray }, 210, 22);
    }

    private buildStats(): void {
        const stats = [
            { v: String(GameState.owned.length), l: '已添置' },
            { v: String(GameState.achievements.length), l: '成就' },
            { v: String(GameState.badge), l: '成长记录' },
        ];
        stats.forEach((s, i) => {
            const x = (i - 1) * 218;
            const card = block(this.content, 200, 110, new Color(255, 255, 255, 236), 22, x, 320, Col.line);
            label(card, s.v, { size: 36, bold: true, color: Col.pinkDeep }, 0, 12);
            label(card, s.l, { size: 20, color: Col.gray }, 0, -32);
        });
    }

    private buildCollection(): void {
        label(this.content, '我们的收藏', { size: 28, bold: true, color: Col.ink }, -300, 210);
        const owned = SHOP_PRODUCTS.filter((p) => GameState.hasItem(p.id));
        const panel = block(this.content, CARD_W, 300, new Color(255, 255, 255, 242), 28, 0, 40, Col.line);
        if (owned.length === 0) {
            label(panel, '还没有添置物品', { size: 28, bold: true, color: Col.ink }, 0, 60);
            labelInBox(panel, '去商店慢慢挑，买下的东西会收在这里。', 500, 56, { size: 22, color: Col.gray }, 0, 10);
            button(panel, '去商店看看', () => this.onGoShop(), {
                w: 280, h: 68, y: -72, size: 24, radius: 20,
            });
            return;
        }
        const cols = [-220, 0, 220];
        owned.slice(0, 6).forEach((p, i) => {
            const x = cols[i % 3];
            const y = i < 3 ? 70 : -40;
            Img.icon(panel, p.asset, p.name, 64, x, y + 18);
            label(panel, p.name, { size: 20, color: Col.ink }, x, y - 40);
        });
        if (owned.length > 6) {
            label(panel, `还有 ${owned.length - 6} 件`, { size: 18, color: Col.gray }, 0, -120);
        }
    }

    private buildAchievements(): void {
        label(this.content, '成就', { size: 28, bold: true, color: Col.ink }, -300, -190);
        const panel = block(this.content, CARD_W, 280, new Color(255, 255, 255, 242), 28, 0, -360, Col.line);
        if (GameState.achievements.length === 0) {
            label(panel, '还没有解锁成就', { size: 26, bold: true, color: Col.ink }, 0, 30);
            labelInBox(panel, '完成故事和小游戏，会在这里留下痕迹。', 500, 56, { size: 22, color: Col.gray }, 0, -20);
            return;
        }
        const list = GameState.achievements.slice(-4).reverse();
        list.forEach((name, i) => {
            const y = 88 - i * 58;
            Img.sprite(panel, 'check_green', 34, -270, y);
            labelInBox(panel, name, 480, 48, { size: 24, color: Col.ink }, 0, y);
        });
        if (GameState.achievements.length > 4) {
            label(panel, `共 ${GameState.achievements.length} 个成就`, { size: 18, color: Col.gray }, 0, -112);
        }
    }

    private buildSave(): void {
        label(this.content, '进度已自动保存', { size: 21, color: Col.gray }, 0, -548);
        label(this.content, `当前：${SaveManager.currentLabel}`, { size: 20, color: Col.pinkDeep }, 0, -580);
        button(this.content, '立即保存', () => {
            GameState.save();
            this.toast('进度已保存');
        }, {
            w: 240, h: 66, y: -638, size: 24, radius: 20,
            color: Col.white, textColor: Col.pinkDeep, stroke: Col.pink,
        });
    }

    private toast(msg: string): void {
        this.toastL.string = msg;
        const op = this.toastN.getComponent(UIOpacity)!;
        op.opacity = 255;
        tween(op).delay(1.4).to(0.25, { opacity: 0 }).start();
    }
}
