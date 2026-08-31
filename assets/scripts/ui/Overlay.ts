import { Color, Node, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, label, layer, sizeOf, ui, whiteSF, sleep } from '../core/UITheme';

/** 最上层过场：黑场淡入淡出 / 开屏标题 / 章节封面 / 中央提示卡 / 结尾 */
export class Overlay {
    root: Node;
    private fadeN: Node;
    private fadeOp: UIOpacity;
    private stage: Node;

    constructor(parent: Node) {
        this.root = layer(parent, 'overlay');
        this.fadeN = new Node('fade');
        this.root.addChild(this.fadeN);
        const ft = this.fadeN.addComponent(UITransform);
        ft.setContentSize(20000, 20000);
        const sp = this.fadeN.addComponent(Sprite);
        sp.spriteFrame = whiteSF();
        sp.color = Color.BLACK;
        this.fadeOp = this.fadeN.addComponent(UIOpacity);
        this.fadeOp.opacity = 0;
        this.stage = new Node('stage');
        this.root.addChild(this.stage);
        this.stage.active = false;
    }

    /** 淡入指定颜色（不透明） */
    fadeIn(color: Color, dur = 0.4): Promise<void> {
        const sp = this.fadeN.getComponent(Sprite)!;
        sp.color = new Color(color.r, color.g, color.b, 255);
        return new Promise<void>((r) => {
            tween(this.fadeOp).to(dur, { opacity: 255 }).call(() => r()).start();
        });
    }

    /** 淡出至透明 */
    fadeOut(dur = 0.4): Promise<void> {
        return new Promise<void>((r) => {
            tween(this.fadeOp).to(dur, { opacity: 0 }).call(() => r()).start();
        });
    }

    get dimmed(): boolean { return this.fadeOp.opacity > 200; }

    /** 开屏：心跳画面 -> 标题画面 */
    async titleScreen(): Promise<void> {
        const H = sizeOf(this.root).height || DH;
        this.stage.active = true;
        this.stage.removeAllChildren();
        Img.sprite(this.stage, 'heart_open', H * (1125 / 2250), 0, 0);
        await sleep(1800);
        this.stage.removeAllChildren();
        Img.sprite(this.stage, 'title', H * (1125 / 2250), 0, 0);
        await sleep(2200);
        const op = this.stage.getComponent(UIOpacity) || this.stage.addComponent(UIOpacity);
        await new Promise<void>((r) => tween(op).to(0.5, { opacity: 0 }).call(() => r()).start());
        this.stage.active = false;
        op.opacity = 255;
    }

    /** 章节封面：婴儿床线稿 -> 暖色填充 -> 淡出 */
    async chapterCover(title: string, subtitle: string): Promise<void> {
        const H = sizeOf(this.root).height || DH;
        this.stage.active = true;
        this.stage.removeAllChildren();
        const op = this.stage.getComponent(UIOpacity) || this.stage.addComponent(UIOpacity);
        op.opacity = 255;
        block(this.stage, 20000, 20000, Col.wall);
        label(this.stage, title, { size: 56, bold: true, color: Col.ink, family: 'Kaiti SC' }, 0, H / 2 - 320);
        Img.sprite(this.stage, 'crib_line', 460, 0, -20);
        label(this.stage, subtitle, { size: 28, color: Col.gray }, 0, -H / 2 + 300);
        await sleep(1300);
        Img.sprite(this.stage, 'crib_fill', 460, 0, -20);
        await sleep(1100);
        await new Promise<void>((r) => tween(op).to(0.6, { opacity: 0 }).call(() => r()).start());
        this.stage.active = false;
        op.opacity = 255;
    }

    /** 屏幕中央提示卡（如：今天完成：3 件） */
    async card(build: (content: Node) => void, holdMs = 2200): Promise<void> {
        this.stage.active = true;
        this.stage.removeAllChildren();
        const op = this.stage.getComponent(UIOpacity) || this.stage.addComponent(UIOpacity);
        op.opacity = 0;
        const cardN = block(this.stage, 520, 400, Col.white, 24, 0, 0, Col.line);
        build(cardN);
        await new Promise<void>((r) => tween(op).to(0.25, { opacity: 255 }).call(() => r()).start());
        await sleep(holdMs);
        await new Promise<void>((r) => tween(op).to(0.4, { opacity: 0 }).call(() => r()).start());
        this.stage.active = false;
        op.opacity = 255;
    }

    /** 结尾黑场文字 */
    async showEnd(title: string, subtitle: string): Promise<void> {
        await this.fadeIn(new Color(20, 18, 24), 0.8);
        this.stage.active = true;
        this.stage.removeAllChildren();
        label(this.stage, title, { size: 46, bold: true, color: Col.white }, 0, 90);
        label(this.stage, subtitle, { size: 28, color: new Color(200, 190, 198) }, 0, 20);
        label(this.stage, '—— 第一章完 ——', { size: 24, color: new Color(150, 140, 148) }, 0, -60);
    }
}
