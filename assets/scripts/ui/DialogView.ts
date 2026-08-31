import { Color, Component, HorizontalTextAlignment, Label, Node, UITransform } from 'cc';
import { block, Col, DH, label, layer } from '../core/UITheme';

/**
 * 底部对白气泡：白色圆角卡片，说话人名字（粉色）+ 正文。
 * 点击屏幕任意位置：打字中 -> 立即补全；否则 -> 显示下一句。
 */
export class DialogView {
    root: Node;
    private catcher: Node;
    private nameL: Label;
    private textL: Label;
    private host: Component;
    private resolve: (() => void) | null = null;
    private typing = false;
    private fullText = '';
    private shown = 0;
    private tickFn: (() => void) | null = null;

    constructor(parent: Node, host: Component) {
        this.host = host;
        this.root = layer(parent, 'dialog');

        // 全屏点击层（位于弹出层之下）
        this.catcher = new Node('catcher');
        this.root.addChild(this.catcher);
        const ct = this.catcher.addComponent(UITransform);
        ct.setContentSize(20000, 20000);
        this.catcher.on(Node.EventType.TOUCH_END, this.onTap, this);

        const H = DH;
        const cardH = 300;
        const card = block(this.root, 470, cardH, Col.white, 24, 120, -H / 2 + 30 + cardH / 2, Col.line);
        card.name = 'card';
        this.nameL = label(card, '', { size: 30, bold: true, color: Col.pinkDeep, hAlign: HorizontalTextAlignment.LEFT, wrap: 410 }, -207, cardH / 2 - 30);
        this.textL = label(card, '', { size: 30, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT, wrap: 410, lineHeight: 44 }, -207, cardH / 2 - 82);
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
        this.typeStep();
        return new Promise<void>((res) => { this.resolve = res; });
    }

    hide(): void {
        this.stopTick();
        this.root.active = false;
    }

    get isWaiting(): boolean { return this.resolve !== null; }

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
            return;
        }
        const r = this.resolve;
        this.resolve = null;
        if (r) r();
    }
}
