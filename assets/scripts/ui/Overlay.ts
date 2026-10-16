import { Color, Graphics, Node, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, sizeOf, ui, whiteSF, sleep } from '../core/UITheme';

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
        sp.sizeMode = Sprite.SizeMode.CUSTOM; // 防 TRIMMED 把 20000x20000 改成贴图原始 1x1
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

    /** 章节收尾（设计稿 章节衔接2）：底部完成卡（三列任务图标+打勾）+ 小智探头台词气泡 */
    async doneSheet(
        rows: { icon: string; label: string }[],
        xiaozhiText: string,
        holdMs = 2600,
    ): Promise<void> {
        this.stage.active = true;
        this.stage.removeAllChildren();
        const op = this.stage.getComponent(UIOpacity) || this.stage.addComponent(UIOpacity);
        op.opacity = 255;

        // 底部卡片：从屏幕下方滑入
        const sheetH = 320;
        const sheetCY = -258;
        const sheet = block(this.stage, DW, sheetH, Col.pinkSoft, 34, 0, sheetCY - sheetH - 120);
        tween(sheet).to(0.4, { position: new Vec3(0, sheetCY, 0) }, { easing: 'cubicOut' }).start();

        label(sheet, '「今天完成：3 件」', { size: 34, bold: true, color: Col.pink }, 0, 102);
        const cols = [-230, 0, 230];
        rows.forEach((r, i) => {
            const x = cols[i];
            // 打勾圆：粉底白勾
            const ck = new Node('ck');
            sheet.addChild(ck);
            ui(ck, 40, 40, x, 24);
            const g = ck.addComponent(Graphics);
            g.fillColor = Col.pink;
            g.circle(0, 0, 18);
            g.fill();
            g.lineWidth = 4;
            g.strokeColor = Col.white;
            g.moveTo(-8, 1);
            g.lineTo(-2, -7);
            g.lineTo(9, 7);
            g.stroke();
            Img.sprite(sheet, r.icon, 100, x, -38);
            label(sheet, r.label, { size: 24, color: Col.ink }, x, -122);
        });

        // 小智左下探头 + 台词气泡（滑入后淡入）
        await sleep(420);
        const xz = Img.sprite(this.stage, 'xiaozhi', 400, -195, -640);
        const bub = block(this.stage, 330, 190, Col.white, 26, 195, -520, Col.line);
        labelInBox(bub, xiaozhiText, 292, 158, { size: 25, color: Col.pinkDeep, lineHeight: 35 });
        for (const n of [xz, bub]) {
            const nop = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
            nop.opacity = 0;
            tween(nop).to(0.35, { opacity: 255 }).start();
        }

        await sleep(holdMs);
        await new Promise<void>((r) => tween(op).to(0.4, { opacity: 0 }).call(() => r()).start());
        this.stage.active = false;
        op.opacity = 255;
    }

    /** 结尾黑场文字 */
    async showEnd(title: string, subtitle: string, footer = ''): Promise<void> {
        await this.fadeIn(new Color(20, 18, 24), 0.8);
        this.stage.active = true;
        this.stage.removeAllChildren();
        label(this.stage, title, { size: 46, bold: true, color: Col.white }, 0, 90);
        label(this.stage, subtitle, { size: 28, color: new Color(200, 190, 198) }, 0, 20);
        if (footer) label(this.stage, footer, { size: 24, color: new Color(150, 140, 148) }, 0, -60);
    }
}
