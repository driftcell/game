import { Node, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { Col, DW, label, layer } from '../core/UITheme';

/** 云朵想法气泡：浮在妈妈头顶，斜体文字，自动停留后淡出 */
export class ThoughtView {
    root: Node;
    private textL: ReturnType<typeof label>;

    constructor(parent: Node) {
        this.root = layer(parent, 'thought');
        Img.sprite(this.root, 'thought', 360, 0, 0);
        this.textL = label(this.root, '', { size: 24, color: Col.ink, italic: true, wrap: 230, lineHeight: 32 }, 12, 18);
        this.root.active = false;
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
