import { Color, Graphics, Label, Node, tween, UIOpacity, Vec3 } from 'cc';
import { block, Col, DH, DW, label, layer, ui } from '../core/UITheme';

export type NavTab = 'home' | 'shop' | 'me';

interface TabNode {
    pill: Node;
    icon: Graphics;
    text: Label;
}

const BAR_H = 120;
const BAR_Y = -DH / 2 + BAR_H / 2;
const TAB_W = 220;
const TAB_H = 104;

/**
 * 底部导航：家｜商店｜我的。
 * 一直贴在屏幕底部，上方内容（对白、选项）为它让出位置；
 * 小游戏、设置表单等专注场景会临时隐藏。
 */
export class BottomNav {
    root: Node;
    onTab: (tab: NavTab) => void = () => {};
    private tabs = new Map<NavTab, TabNode>();
    private active: NavTab | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'bottom-nav');
        // 顶部两层极淡的阴影，让导航栏从内容上浮起来
        block(this.root, DW, 10, new Color(72, 60, 68, 8), 0, 0, -DH / 2 + BAR_H + 10);
        block(this.root, DW, 6, new Color(72, 60, 68, 12), 0, 0, -DH / 2 + BAR_H + 4);
        block(this.root, DW, BAR_H, new Color(255, 255, 255, 250), 0, 0, BAR_Y);
        block(this.root, DW, 2, Col.line, 0, 0, -DH / 2 + BAR_H);

        const defs: { id: NavTab; text: string }[] = [
            { id: 'home', text: '家' },
            { id: 'shop', text: '商店' },
            { id: 'me', text: '我的' },
        ];
        defs.forEach((def, i) => {
            const x = (i - 1) * 230;
            const tab = new Node(`tab_${def.id}`);
            this.root.addChild(tab);
            ui(tab, TAB_W, TAB_H, x, BAR_Y);

            const pill = block(tab, 176, 84, new Color(253, 236, 243, 0), 24);
            const hit = block(tab, TAB_W, TAB_H, new Color(255, 255, 255, 1), 0);
            hit.on(Node.EventType.TOUCH_END, () => this.onTab(def.id));

            const iconN = new Node('icon');
            tab.addChild(iconN);
            ui(iconN, 48, 48, 0, 17);
            const icon = iconN.addComponent(Graphics);

            const text = label(tab, def.text, { size: 20, color: Col.gray }, 0, -33);
            this.tabs.set(def.id, { pill, icon, text });
        });
        this.paint();
        this.root.active = false;
    }

    setActive(tab: NavTab | null): void {
        this.active = tab;
        this.paint();
    }

    show(): void {
        this.root.active = true;
        this.root.setScale(new Vec3(1, 0.92, 1));
        tween(this.root).to(0.18, { scale: new Vec3(1, 1, 1) }).start();
    }

    hide(): void {
        this.root.active = false;
    }

    setVisible(v: boolean): void {
        if (v) this.show(); else this.hide();
    }

    /** 完成任务时在导航栏上方飘一行「小星星 +N」 */
    flashStars(n: number): void {
        if (n <= 0 || !this.root.active) return;
        const node = new Node('star-gain');
        this.root.addChild(node);
        ui(node, 300, 48, 0, -DH / 2 + BAR_H + 54);
        const bg = block(node, 236, 46, new Color(72, 60, 68, 224), 23);
        label(bg, `小星星 +${n}`, { size: 22, bold: true, color: new Color(255, 232, 168) });
        const op = node.addComponent(UIOpacity);
        op.opacity = 0;
        node.setPosition(0, -DH / 2 + BAR_H + 36, 0);
        tween(op).to(0.15, { opacity: 255 }).start();
        tween(node)
            .to(0.9, { position: new Vec3(0, -DH / 2 + BAR_H + 96, 0) }, { easing: 'cubicOut' })
            .start();
        tween(op).delay(0.7).to(0.3, { opacity: 0 }).call(() => node.destroy()).start();
    }

    private paint(): void {
        this.tabs.forEach((t, id) => {
            const on = id === this.active;
            const color = on ? Col.pinkDeep : Col.gray;
            const g = t.pill.getComponent(Graphics);
            if (g) {
                g.clear();
                g.fillColor = on ? Col.pinkSoft : new Color(253, 236, 243, 0);
                g.roundRect(-88, -42, 176, 84, 24);
                g.fill();
            }
            this.drawIcon(t.icon, id, color);
            t.text.color = color;
            t.text.isBold = on;
        });
    }

    private drawIcon(g: Graphics, kind: NavTab, color: Color): void {
        g.clear();
        g.lineWidth = 4;
        g.strokeColor = color;
        if (kind === 'home') {
            g.moveTo(-19, -1);
            g.lineTo(0, 16);
            g.lineTo(19, -1);
            g.stroke();
            g.roundRect(-14, -21, 28, 21, 3);
            g.stroke();
            g.roundRect(-5, -21, 10, 13, 2);
            g.stroke();
            return;
        }
        if (kind === 'shop') {
            g.roundRect(-17, -19, 34, 30, 6);
            g.stroke();
            g.arc(0, 10, 9, Math.PI, 0, false);
            g.stroke();
            g.moveTo(-8, 5);
            g.lineTo(8, 5);
            g.stroke();
            return;
        }
        g.circle(0, 12, 8);
        g.stroke();
        g.roundRect(-16, -21, 32, 17, 8);
        g.stroke();
    }
}
