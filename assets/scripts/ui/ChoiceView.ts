import { Graphics, Node } from 'cc';
import { block, Col, DH, label, labelInBox, layer, paintBlock } from '../core/UITheme';

/**
 * 选项面板：屏幕下半部弹出 2-3 个横向长条按钮（白底圆角深灰字）。
 * 内心想法选项上方加一行小字「（妈妈心里想）」。
 * 选中项高亮 0.25s 后收起。
 */
export class ChoiceView {
    root: Node;
    private busy = false;

    constructor(parent: Node) {
        this.root = layer(parent, 'choices');
        this.root.active = false;
    }

    choose(hint: string | null, options: string[]): Promise<number> {
        this.root.active = true;
        this.root.removeAllChildren();
        this.busy = false;
        const H = DH;
        return new Promise<number>((resolve) => {
            const barH = 100, gap = 26, hintH = hint ? 46 : 0;
            const total = options.length * (barH + gap) + hintH;
            let y = -H / 2 + 90 + total - barH / 2;
            if (hint) {
                label(this.root, hint, { size: 26, color: Col.gray }, 0, y + barH / 2 + 34);
                y -= hintH;
            }
            options.forEach((text, i) => {
                const bar = block(this.root, 640, barH, Col.white, 18, 0, y, Col.line);
                labelInBox(bar, text, 540, barH, { size: 28, color: Col.ink, lineHeight: 38 });
                bar.on(Node.EventType.TOUCH_END, () => {
                    if (this.busy) return;
                    this.busy = true;
                    // 高亮选中项：粉底 + 粉框
                    const g = bar.getComponent(Graphics);
                    if (g) paintBlock(g, 640, 100, Col.pinkSoft, 18, Col.pink, 3);
                    setTimeout(() => {
                        this.root.active = false;
                        this.root.removeAllChildren();
                        resolve(i);
                    }, 260);
                });
                y -= barH + gap;
            });
        });
    }

    hide(): void {
        this.root.active = false;
        this.root.removeAllChildren();
    }
}
