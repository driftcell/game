import { Label, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, label, layer, ui } from '../core/UITheme';

export interface TaskItem { id: string; icon: string; label: string; }

/**
 * 三张任务卡（布置睡眠区 / 布置尿布台 / 查看购物清单）。
 * 白底圆角卡片 + 线性图标 + 右上角完成勾选，下方一行「今天完成：N 件」。
 */
export class TaskBar {
    root: Node;
    onTask: (id: string) => void = () => {};
    private items = new Map<string, { card: Node; radioN: Node; done: boolean }>();
    private counterL: Label | null = null;
    private order: string[] = [];
    private waiter: (() => void) | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'taskbar');
        this.root.active = false;
    }

    show(tasks: TaskItem[]): void {
        this.root.active = true;
        this.root.removeAllChildren();
        this.items.clear();
        this.order = tasks.map((t) => t.id);
        const H = DH;
        const cw = 210, ch = 250, gap = 24;
        const totalW = tasks.length * cw + (tasks.length - 1) * gap;
        let x = -totalW / 2 + cw / 2;
        const y = -H / 2 + 460;
        for (const t of tasks) {
            const card = block(this.root, cw, ch, Col.white, 20, x, y, Col.line);
            Img.sprite(card, t.icon, 120, 0, 34);
            label(card, t.label, { size: 26, color: Col.ink }, 0, -88);
            const radioN = new Node('radio');
            card.addChild(radioN);
            ui(radioN, 40, 40, cw / 2 - 30, ch / 2 - 30);
            const sp = radioN.addComponent(Sprite);
            const sf = Img.get('radio_off');
            if (sf) sp.spriteFrame = sf;
            sp.color = Col.pink;
            this.items.set(t.id, { card, radioN, done: false });
            card.on(Node.EventType.TOUCH_END, () => {
                const it = this.items.get(t.id);
                if (!it || it.done) return;
                this.onTask(t.id);
            });
            x += cw + gap;
        }
        this.counterL = label(this.root, '今天完成：0 件', { size: 26, color: Col.gray }, 0, y - ch / 2 - 46);
    }

    markDone(id: string): void {
        const it = this.items.get(id);
        if (!it || it.done) return;
        it.done = true;
        const sp = it.radioN.getComponent(Sprite);
        const sf = Img.get('radio_on');
        if (sp && sf) sp.spriteFrame = sf;
        tween(it.radioN).to(0.15, { scale: new Vec3(1.4, 1.4, 1) }).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
        const op = it.card.getComponent(UIOpacity) || it.card.addComponent(UIOpacity);
        tween(op).to(0.2, { opacity: 220 }).start();
        const doneN = this.order.filter((k) => this.items.get(k)?.done).length;
        if (this.counterL) this.counterL.string = `今天完成：${doneN} 件`;
        if (doneN >= this.order.length) {
            const w = this.waiter;
            this.waiter = null;
            setTimeout(() => { if (w) w(); }, 600);
        }
    }

    waitAllDone(): Promise<void> {
        if (this.order.length > 0 && this.order.every((k) => this.items.get(k)?.done)) {
            return new Promise((r) => setTimeout(r, 600));
        }
        return new Promise<void>((r) => { this.waiter = r; });
    }

    hide(): void {
        this.root.active = false;
    }
}
