import { Color, Component, Graphics, HorizontalTextAlignment, Label, Node, UITransform } from 'cc';
import { Col, DH, labelAuto, labelInBox, layer, measure, paintBlock } from '../core/UITheme';

const CARD_W = 470;
const CARD_X = 120;
const PAD_X = 30;
const PAD_TOP = 24;
const PAD_BOTTOM = 30;
const NAME_H = 44;

/**
 * 底部对白气泡：白色圆角卡片，说话人名字（粉色）+ 正文。
 * 卡片高度由正文实测高度决定（updateRenderData 后读 UITransform），底边固定向上生长；
 * 名字用框内对齐、正文从顶部向下生长，不再手填坐标。
 * 点击屏幕任意位置：打字中 -> 立即补全；否则 -> 显示下一句。
 */
export class DialogView {
    root: Node;
    private catcher: Node;
    private card: Node;
    private cardG: Graphics;
    private nameL: Label;
    private textL: Label;
    private host: Component;
    private resolve: (() => void) | null = null;
    private typing = false;
    private fullText = '';
    private shown = 0;
    private tickFn: (() => void) | null = null;
    private baseY = -DH / 2 + 132;
    private lastTextH = -1;

    constructor(parent: Node, host: Component) {
        this.host = host;
        this.root = layer(parent, 'dialog');

        // 全屏点击层（位于弹出层之下）
        this.catcher = new Node('catcher');
        this.root.addChild(this.catcher);
        const ct = this.catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        this.catcher.on(Node.EventType.TOUCH_END, this.onTap, this);

        this.card = new Node('card');
        this.root.addChild(this.card);
        this.cardG = this.card.addComponent(Graphics);
        this.nameL = labelInBox(this.card, '', CARD_W - PAD_X * 2, NAME_H, {
            size: 30, bold: true, color: Col.pinkDeep, hAlign: HorizontalTextAlignment.LEFT, lineHeight: 40,
        });
        this.textL = labelAuto(this.card, '', CARD_W - PAD_X * 2, {
            size: 30, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT, lineHeight: 44,
        });
        this.relayout(true);
        this.root.active = false;
    }

    say(name: string, nameColor: Color, text: string): Promise<void> {
        this.root.active = true;
        this.nameL.string = name;
        this.nameL.color = nameColor;
        this.fullText = text;
        this.shown = 0;
        this.typing = true;
        this.textL.string = '';
        this.lastTextH = -1;
        this.relayout(true);
        this.typeStep();
        return new Promise<void>((res) => { this.resolve = res; });
    }

    hide(): void {
        this.stopTick();
        this.root.active = false;
    }

    get isWaiting(): boolean { return this.resolve !== null; }

    /** 按正文实测高度重绘卡片；底边固定在 baseY，向上生长 */
    private relayout(force = false): void {
        const textH = Math.max(measure(this.textL), this.textL.lineHeight);
        if (!force && textH === this.lastTextH) return;
        this.lastTextH = textH;
        const cardH = PAD_TOP + NAME_H + textH + PAD_BOTTOM;
        const t = this.card.getComponent(UITransform)!;
        t.setContentSize(CARD_W, cardH);
        this.card.setPosition(CARD_X, this.baseY + cardH / 2);
        paintBlock(this.cardG, CARD_W, cardH, Col.white, 24, Col.line, 2);
        const top = cardH / 2;
        // nameL 是 labelInBox（锚点中心）：x 给框中心 0，框宽 CARD_W-2*PAD_X 刚好落在安全区内
        this.nameL.node.setPosition(0, top - PAD_TOP - NAME_H / 2);
        // textL 是 labelAuto（锚点 (0,1)）：x 给文字左缘
        this.textL.node.setPosition(-CARD_W / 2 + PAD_X, top - PAD_TOP - NAME_H);
    }

    private typeStep(): void {
        this.stopTick();
        this.tickFn = () => {
            this.shown += 2;
            if (this.shown >= this.fullText.length) {
                this.textL.string = this.fullText;
                this.typing = false;
                this.stopTick();
            } else {
                this.textL.string = this.fullText.slice(0, this.shown);
            }
            this.relayout();
        };
        this.host.schedule(this.tickFn, 0.03);
    }

    private stopTick(): void {
        if (this.tickFn) { this.host.unschedule(this.tickFn); this.tickFn = null; }
    }

    private onTap(): void {
        if (this.root.active === false) return;
        if (this.typing) {
            this.stopTick();
            this.textL.string = this.fullText;
            this.typing = false;
            this.relayout();
            return;
        }
        const r = this.resolve;
        this.resolve = null;
        if (r) r();
    }
}
