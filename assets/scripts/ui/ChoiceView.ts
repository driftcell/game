import { Color, Graphics, HorizontalTextAlignment, Node } from 'cc';
import { block, Col, DH, label, labelAuto, labelInBox, layer, measure, paintBlock, ui } from '../core/UITheme';

/**
 * 选项面板：屏幕下半部弹出 2-3 个横向长条按钮（白底圆角深灰字）。
 * 内心想法选项上方加一行小字「（妈妈心里想）」。
 * 选中项高亮 0.25s 后收起。
 * 另提供设计稿弹层样式（第二章「妈妈心里想」）：粉色标题条 + A/B/C 卡片。
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
            let y = -H / 2 + 144 + total - barH / 2;
            if (hint) {
                const hintBg = block(this.root, 400, 44, new Color(255, 255, 255, 200), 22, 0, y + barH / 2 + 34);
                label(hintBg, hint, { size: 26, color: Col.gray }, 0, 0);
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

    /** 设计稿弹层样式：粉色标题条 + 带字母序号的选项卡片（第二章 妈妈心里想） */
    chooseSheet(title: string, options: string[]): Promise<number> {
        this.root.active = true;
        this.root.removeAllChildren();
        this.busy = false;
        return new Promise<number>((resolve) => {
            const W = 710;
            const top = -215;                         // 弹层上边缘（根坐标）
            const h = DH / 2 - top;                   // 一直延伸到屏幕底
            const sheet = new Node('sheet');
            this.root.addChild(sheet);
            ui(sheet, W, h, 0, top - h / 2);
            const sg = sheet.addComponent(Graphics);
            sg.fillColor = Col.white;
            sg.roundRect(-W / 2, -h / 2, W, h, 36);
            sg.fill();
            sg.rect(-W / 2, -h / 2, W, 40);           // 抹平下边两角
            sg.fill();

            // 粉色标题条（上圆角）
            const HEADER_H = 100;
            const header = new Node('header');
            sheet.addChild(header);
            ui(header, W, HEADER_H, 0, h / 2 - HEADER_H / 2);
            const hg = header.addComponent(Graphics);
            hg.fillColor = Col.pink;
            hg.roundRect(-W / 2, -HEADER_H / 2, W, HEADER_H, 36);
            hg.fill();
            hg.rect(-W / 2, -HEADER_H / 2, W, 40);
            hg.fill();
            label(header, title, { size: 32, bold: true, color: Col.white });

            // 选项卡片
            const CARD_W = 630;
            let y = h / 2 - HEADER_H - 32;            // 卡顶（sheet 局部）
            options.forEach((text, i) => {
                const content = `${String.fromCharCode(65 + i)}. ${text}`;
                // 先量文字高度，再按最终位置重排
                const probe = labelAuto(sheet, content, CARD_W - 56, {
                    size: 28, color: Col.ink, lineHeight: 40, hAlign: HorizontalTextAlignment.LEFT,
                }, -CARD_W / 2 + 28, y);
                const th = measure(probe);
                const cardH = th + 44;
                const card = block(sheet, CARD_W, cardH, Col.white, 18, 0, y - cardH / 2, Col.line, 3);
                probe.node.setParent(card);
                probe.node.setPosition(-CARD_W / 2 + 28, cardH / 2 - 22);
                card.on(Node.EventType.TOUCH_END, () => {
                    if (this.busy) return;
                    this.busy = true;
                    const g = card.getComponent(Graphics);
                    if (g) paintBlock(g, CARD_W, cardH, Col.white, 18, Col.pink, 3);
                    probe.color = Col.pink;
                    setTimeout(() => {
                        this.root.active = false;
                        this.root.removeAllChildren();
                        resolve(i);
                    }, 260);
                });
                y -= cardH + 24;
            });
        });
    }

    hide(): void {
        this.root.active = false;
        this.root.removeAllChildren();
    }
}
