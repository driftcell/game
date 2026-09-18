import { Graphics, Label, Node, tween, UIOpacity, Vec3 } from 'cc';
import { block, Col, labelInBox, layer, ui } from '../core/UITheme';

/**
 * 云朵想法气泡：浮在妈妈头顶，斜体文字，自动停留后淡出。
 * 气泡用 Graphics 直接绘制（白底圆角矩形 + 粉色描边 + 左下双圆尾巴），
 * 不再依赖 thought.png 切图：文字安全区精确可控，不受切图缩放/字体回退影响。
 */
export class ThoughtView {
    root: Node;
    private textL: Label;

    constructor(parent: Node) {
        this.root = layer(parent, 'thought');
        const W = 360; const H = 240;
        // 主体气泡（文字安全区 = W-80 × H-60，与气泡同中心，框内居中）
        block(this.root, W, H, Col.white, 30, 0, 10, Col.pink, 3);
        // 左下角尾巴（仿原云朵图的两个渐小圆）
        this.tail(14, -W / 2 + 48, -H / 2 - 16);
        this.tail(8, -W / 2 + 22, -H / 2 - 46);
        this.textL = labelInBox(this.root, '', W - 80, H - 60, { size: 24, color: Col.ink, italic: true, lineHeight: 32 }, 0, 10);
        this.root.active = false;
    }

    /** 气泡尾巴：白底粉边小圆 */
    private tail(r: number, x: number, y: number): void {
        const n = new Node('tail');
        this.root.addChild(n);
        ui(n, r * 2, r * 2, x, y);
        const g = n.addComponent(Graphics);
        g.fillColor = Col.white;
        g.strokeColor = Col.pink;
        g.lineWidth = 3;
        g.circle(0, 0, r);
        g.fill();
        g.stroke();
    }

    /** 出现在场景中的指定位置（相对屏幕中心） */
    async show(text: string, x = -10, y = 190, holdMs = 1700): Promise<void> {
        this.textL.string = text;
        this.root.setPosition(x, y);
        this.root.active = true;
        const op = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity);
        op.opacity = 0;
        this.root.setScale(new Vec3(0.8, 0.8, 1));
        tween(this.root).to(0.2, { scale: new Vec3(1, 1, 1) }).start();
        await new Promise<void>((r) => {
            tween(op)
                .to(0.2, { opacity: 255 })
                .delay(holdMs / 1000)
                .to(0.3, { opacity: 0 })
                .call(() => { this.root.active = false; r(); })
                .start();
        });
    }
}
