import { Button, Color, Graphics, HorizontalTextAlignment, Node, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { GameState } from '../core/GameState';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, ui } from '../core/UITheme';

export interface CardRow { icon: string; text: string; }

const CARD_W = 700;
const ROW_H = 108;
const HEADER_H = 96;
const FOOT_H = 150;

/**
 * 知识卡：底部滑出的科普清单卡（如「安全睡眠五句话」）。
 * 点「收进手机」：卡片缩小飞入手机图标，成长记录 +1，返回 Promise resolve。
 * 层级在小游戏之上、HUD/手机之下，飞入终点正好是手机图标。
 */
export class KnowledgeCardView {
    root: Node;
    /** 手机图标位置，由 GameApp 注入 */
    phonePos = new Vec3(DW / 2 - 44, DH / 2 - 400, 0);
    /** 收进手机后的弹跳反馈，由 GameApp 注入 */
    onCollected: () => void = () => {};
    private busy = false;

    constructor(parent: Node) {
        this.root = layer(parent, 'knowledgecard');
        this.root.active = false;
    }

    /** 滑出知识卡，等待「收进手机」后 resolve */
    play(title: string, rows: CardRow[]): Promise<void> {
        this.root.removeAllChildren();
        this.busy = false;
        const dim = block(this.root, 20000, 20000, new Color(30, 20, 30, 110));
        dim.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        const H = HEADER_H + rows.length * ROW_H + FOOT_H;
        const cardY = -DH / 2 + H / 2;
        const card = new Node('card');
        this.root.addChild(card);
        ui(card, CARD_W, H, 0, cardY - DH); // 初始在屏外
        block(card, CARD_W, H, Col.white, 32);
        // 粉色标题栏（补平方下半）
        const header = block(card, CARD_W, HEADER_H, Col.pink, 32, 0, H / 2 - HEADER_H / 2);
        block(header, CARD_W, 40, Col.pink, 0, 0, -28);
        label(header, title, { size: 34, bold: true, color: Col.white });

        // 行：左图标 + 左对齐文字，行间细分隔线
        let y = H / 2 - HEADER_H - ROW_H / 2;
        rows.forEach((r, i) => {
            Img.icon(card, r.icon, r.text, 66, -CARD_W / 2 + 76, y);
            labelInBox(card, r.text, 500, ROW_H - 20, { size: 28, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT, lineHeight: 38 }, -CARD_W / 2 + 380, y);
            if (i < rows.length - 1) {
                const div = new Node('div');
                card.addChild(div);
                ui(div, CARD_W - 120, 2, 0, y - ROW_H / 2);
                const g = div.addComponent(Graphics);
                g.fillColor = Col.line;
                g.rect(-(CARD_W - 120) / 2, -1, CARD_W - 120, 2);
                g.fill();
            }
            y -= ROW_H;
        });

        // 收进手机按钮（切图按钮 + Button 缩放反馈）
        const btn = Img.sprite(card, 'btn_collect', 244, CARD_W / 2 - 170, -H / 2 + FOOT_H / 2);
        const bb = btn.addComponent(Button);
        bb.transition = Button.Transition.SCALE;
        bb.zoomScale = 0.94;
        bb.target = btn;

        const op = opacity(card);
        this.root.active = true;
        return new Promise<void>((resolve) => {
            btn.once(Button.EventType.CLICK, () => {
                if (this.busy) return;
                this.busy = true;
                this.collect(card, op, resolve);
            });
            tween(card).to(0.35, { position: new Vec3(0, cardY, 0) }, { easing: 'cubicOut' }).start();
        });
    }

    /** 卡片缩小飞向手机图标，成长记录 +1 */
    private collect(card: Node, op: UIOpacity, resolve: () => void): void {
        GameState.badge++;
        GameState.save();
        const target = this.phonePos.clone();
        tween(card)
            .to(0.4, { position: target, scale: new Vec3(0.12, 0.12, 1) }, { easing: 'cubicIn' })
            .call(() => {
                this.root.active = false;
                this.busy = false;
                this.onCollected();
                resolve();
            })
            .start();
        tween(op).delay(0.15).to(0.25, { opacity: 0 }).start();
    }
}
