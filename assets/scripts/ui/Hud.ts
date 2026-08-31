import { Node, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, layer } from '../core/UITheme';

/** 屏幕右上角常驻日历时间角标（孕周 / 宝宝出生第N天） */
export class TimeBadge {
    root: Node;
    private textL: ReturnType<typeof label>;

    constructor(parent: Node) {
        this.root = layer(parent, 'timebadge');
        Img.sprite(this.root, 'calendar', 240, 0, 0);
        this.textL = label(this.root, '', { size: 26, bold: true, color: Col.pinkDeep }, 0, 2);
        this.root.active = false;
    }

    async appear(text: string): Promise<void> {
        this.textL.string = text;
        this.root.active = true;
        const W = DW; const H = DH;
        this.root.setPosition(W / 2 - 150, H / 2 - 100);
        // 翻页动效：放大到 1.2 停留后缩回
        this.root.setScale(new Vec3(0.6, 0.6, 1));
        await new Promise<void>((r) => {
            tween(this.root)
                .to(0.25, { scale: new Vec3(1.2, 1.2, 1) })
                .delay(0.5)
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .call(() => r())
                .start();
        });
    }

    hide(): void { this.root.active = false; }
}

/** 屏幕顶部成就绶带：滑入 -> 停留 2s -> 滑出（绶带图已含文字） */
export class Banner {
    root: Node;
    private queue: Promise<void> = Promise.resolve();

    constructor(parent: Node) {
        this.root = layer(parent, 'banner');
        this.root.active = false;
    }

    show(name: string): Promise<void> {
        // 串行播放，避免重叠
        this.queue = this.queue.then(() => this.play(name));
        return this.queue;
    }

    private async play(name: string): Promise<void> {
        this.root.removeAllChildren();
        this.root.active = true;
        // 绶带切图自带「我们的故事开始了」；其他成就用文字兜底
        const known = name === '我们的故事开始了';
        Img.sprite(this.root, 'ribbon', 480, 0, 0);
        if (!known) {
            this.root.removeAllChildren();
            block(this.root, 480, 120, Col.pink, 20);
            label(this.root, `成就解锁｜${name}`, { size: 30, bold: true, color: Col.white }, 0, 0);
        }
        const H = DH;
        const targetY = H / 2 - 200;
        const op = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity);
        op.opacity = 255;
        this.root.setPosition(0, H / 2 + 200);
        await new Promise<void>((r) => {
            tween(this.root).to(0.4, { position: new Vec3(0, targetY, 0) }).call(() => r()).start();
        });
        await new Promise<void>((r) => { tween(this.root).delay(2).call(() => r()).start(); });
        await new Promise<void>((r) => {
            tween(this.root).to(0.4, { position: new Vec3(0, H / 2 + 200, 0) }).call(() => r()).start();
        });
        this.root.active = false;
    }
}

/** HUD：时间角标 + 成就绶带 */
export class Hud {
    root: Node;
    time: TimeBadge;
    banner: Banner;

    constructor(parent: Node) {
        this.root = layer(parent, 'hud');
        this.time = new TimeBadge(this.root);
        this.banner = new Banner(this.root);
    }
}
