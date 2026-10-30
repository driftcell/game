import { Color, Graphics, Label, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, label, layer, paintBlock, ui } from '../core/UITheme';

export interface TaskItem { id: string; icon: string; label: string; }

interface TaskNode {
    card: Node;
    g: Graphics;
    radioN: Node;
    statusL: Label;
    lockN: Node;
    done: boolean;
}

/**
 * 三张任务卡（查看购物清单 / 布置睡眠区 / 布置尿布台）。
 * 第一章按顺序解锁：只有当前这张能点，完成上一件后下一件才亮起。
 */
export class TaskBar {
    root: Node;
    onTask: (id: string) => void | Promise<void> = () => {};
    private items = new Map<string, TaskNode>();
    private counterL: Label | null = null;
    private order: string[] = [];
    private waiter: (() => void) | null = null;
    private sequential = true;
    private unlockIndex = 0;
    private busy = false;

    constructor(parent: Node) {
        this.root = layer(parent, 'taskbar');
        this.root.active = false;
    }

    show(tasks: TaskItem[], opts: { sequential?: boolean } = {}): void {
        this.root.active = true;
        this.root.removeAllChildren();
        this.items.clear();
        this.busy = false;
        this.sequential = opts.sequential ?? true;
        this.unlockIndex = 0;
        this.order = tasks.map((t) => t.id);
        const cw = 210, ch = 250, gap = 24;
        const totalW = tasks.length * cw + (tasks.length - 1) * gap;
        let x = -totalW / 2 + cw / 2;
        const y = -DH / 2 + 500;
        tasks.forEach((t, i) => {
            const card = block(this.root, cw, ch, Col.white, 20, x, y, Col.line);
            const g = card.getComponent(Graphics)!;
            Img.sprite(card, t.icon, 120, 0, 42);
            label(card, t.label, { size: 25, color: Col.ink }, 0, -70);
            const statusL = label(card, '', { size: 18, color: Col.gray }, 0, -108);
            const radioN = new Node('radio');
            card.addChild(radioN);
            ui(radioN, 40, 40, cw / 2 - 30, ch / 2 - 30);
            const sp = radioN.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM; // 保住 ui() 设定的 40x40
            const sf = Img.get('radio_off');
            if (sf) sp.spriteFrame = sf;
            sp.color = Col.pink;
            const lockN = this.buildLock(card, cw / 2 - 30, ch / 2 - 30);
            this.items.set(t.id, { card, g, radioN, statusL, lockN, done: false });
            card.on(Node.EventType.TOUCH_END, () => { void this.activate(t.id, i); });
            x += cw + gap;
        });
        this.refreshStates();
        const counterBg = block(this.root, 320, 44, new Color(255, 255, 255, 180), 22, 0, y - ch / 2 - 40);
        this.counterL = label(counterBg, '今天完成：0 / 3 件', { size: 24, color: Col.gray }, 0, 0);
        if (this.counterL) this.counterL.string = `今天完成：0 / ${this.order.length} 件`;
    }

    private buildLock(parent: Node, x: number, y: number): Node {
        const n = new Node('lock');
        parent.addChild(n);
        ui(n, 40, 40, x, y);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(176, 166, 172);
        g.roundRect(-12, -14, 24, 17, 5);
        g.fill();
        g.lineWidth = 4;
        g.strokeColor = new Color(176, 166, 172);
        g.arc(0, 3, 8, Math.PI, 0, false);
        g.stroke();
        return n;
    }

    private async activate(id: string, index: number): Promise<void> {
        if (this.busy) return;
        const it = this.items.get(id);
        if (!it || it.done) return;
        if (this.sequential && index > this.unlockIndex) return;
        this.busy = true;
        try {
            await this.onTask(id);
        } finally {
            this.busy = false;
        }
    }

    markDone(id: string): void {
        const it = this.items.get(id);
        if (!it || it.done) return;
        it.done = true;
        const idx = this.order.indexOf(id);
        if (this.sequential && idx >= 0 && idx + 1 > this.unlockIndex) this.unlockIndex = idx + 1;
        const sp = it.radioN.getComponent(Sprite);
        const sf = Img.get('radio_on');
        if (sp && sf) sp.spriteFrame = sf;
        tween(it.radioN).to(0.15, { scale: new Vec3(1.4, 1.4, 1) }).to(0.12, { scale: new Vec3(1, 1, 1) }).start();
        this.refreshStates();
        const doneN = this.order.filter((k) => this.items.get(k)?.done).length;
        if (this.counterL) this.counterL.string = `今天完成：${doneN} / ${this.order.length} 件`;
        if (doneN >= this.order.length) {
            const w = this.waiter;
            this.waiter = null;
            setTimeout(() => { if (w) w(); }, 600);
        }
    }

    private refreshStates(): void {
        this.order.forEach((id, i) => {
            const it = this.items.get(id);
            if (!it) return;
            const locked = this.sequential && !it.done && i > this.unlockIndex;
            const active = !it.done && !locked;
            const fill = locked ? new Color(250, 248, 249, 235) : Col.white;
            const stroke = active ? Col.pink : Col.line;
            paintBlock(it.g, 210, 250, fill, 20, stroke, active ? 3 : 2);
            const op = it.card.getComponent(UIOpacity) || it.card.addComponent(UIOpacity);
            op.opacity = locked ? 150 : it.done ? 205 : 255;
            it.lockN.active = locked;
            it.radioN.active = !locked;
            if (it.done) {
                it.statusL.string = '已完成';
                it.statusL.color = Col.gray;
                it.statusL.fontSize = 18;
                it.statusL.isBold = false;
            } else if (locked) {
                it.statusL.string = '完成上一件后解锁';
                it.statusL.color = Col.gray;
                it.statusL.fontSize = 17;
                it.statusL.isBold = false;
            } else {
                it.statusL.string = this.sequential ? '现在做这件' : '点一下开始';
                it.statusL.color = Col.pinkDeep;
                it.statusL.fontSize = 19;
                it.statusL.isBold = true;
            }
        });
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
