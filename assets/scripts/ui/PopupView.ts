import { Color, EditBox, Graphics, HorizontalTextAlignment, Label, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, DH, label, layer, ui, whiteSF } from '../core/UITheme';

export interface InputCfg { title: string; placeholder: string; altLabel?: string; }
export interface PickCfg { title: string; options: string[]; }
export interface CustomCfg {
    title: string; height: number;
    build: (content: Node) => void;
    buttons: { label: string; value: string; primary?: boolean }[];
}
export interface PopupResult { ok: boolean; value: string; alt: boolean; index: number; }

/** 屏幕中央白色圆角弹窗（宽约占屏 80%，轻微放大弹出） */
export class PopupView {
    root: Node;
    private dim: Node;
    private card: Node;

    constructor(parent: Node) {
        this.root = layer(parent, 'popup');
        this.root.active = false;
        this.dim = block(this.root, 20000, 20000, new Color(30, 20, 30, 130));
        this.dim.on(Node.EventType.TOUCH_END, () => { /* 吞掉点击，必须做出选择 */ });
        this.card = new Node('card');
        this.root.addChild(this.card);
    }

    private open(width: number, height: number): Node {
        this.root.active = true;
        this.card.removeAllChildren();
        ui(this.card, width, height);
        this.card.setPosition(0, 0);
        this.card.setScale(new Vec3(0.85, 0.85, 1));
        const op = this.card.getComponent(UIOpacity) || this.card.addComponent(UIOpacity);
        op.opacity = 255;
        tween(this.card).to(0.18, { scale: new Vec3(1, 1, 1) }).start();
        // 白卡 + 顶部粉色标题栏
        block(this.card, width, height, Col.white, 24);
        const header = block(this.card, width, 92, Col.pink, 24, 0, height / 2 - 46);
        block(header, width, 40, Col.pink, 0, 0, -26); // 补平方标题栏下半
        return header;
    }

    private close(): void {
        this.root.active = false;
    }

    /** 单行输入弹窗（如：大家怎么称呼你？） */
    input(cfg: InputCfg): Promise<PopupResult> {
        const W = 600;
        const alt = !!cfg.altLabel;
        const H = alt ? 520 : 430;
        const header = this.open(W, H);
        label(header, cfg.title, { size: 34, bold: true, color: Col.white });

        const boxN = new Node('inputBox');
        this.card.addChild(boxN);
        ui(boxN, 500, 88, 0, alt ? 70 : 50);
        const sp = boxN.addComponent(Sprite);
        sp.spriteFrame = whiteSF();
        sp.color = new Color(247, 247, 247);
        const eb = boxN.addComponent(EditBox);
        eb.backgroundImage = whiteSF();
        eb.placeholder = cfg.placeholder;
        eb.inputMode = EditBox.InputMode.SINGLE_LINE;
        eb.returnType = EditBox.KeyboardReturnType.DONE;
        const tl = label(boxN, '', { size: 30, color: Col.ink });
        const pl = label(boxN, cfg.placeholder, { size: 30, color: Col.gray });
        eb.textLabel = tl;
        eb.placeholderLabel = pl;

        return new Promise<PopupResult>((resolve) => {
            const done = (altPicked: boolean) => {
                this.close();
                resolve({ ok: true, value: eb.string.trim(), alt: altPicked, index: -1 });
            };
            button(this.card, '确 定', () => done(false), { w: 500, h: 92, y: alt ? -70 : -H / 2 + 118 });
            if (alt) {
                button(this.card, cfg.altLabel!, () => done(true), {
                    w: 500, h: 80, y: -H / 2 + 88,
                    color: Col.white, textColor: Col.pinkDeep, stroke: Col.pink, size: 30,
                });
            }
            eb.node.on(EditBox.EventType.EDITING_RETURN, () => done(false));
        });
    }

    /** 单选列表弹窗（如：谁会主要陪你一起经历这段旅程？） */
    pick(cfg: PickCfg): Promise<PopupResult> {
        const W = 600;
        const rowH = 92;
        const H = 92 + cfg.options.length * (rowH + 14) + 130;
        const header = this.open(W, H);
        label(header, cfg.title, { size: 32, bold: true, color: Col.white, wrap: 520, lineHeight: 40 }, 0, 24);

        let selected = 0;
        const rows: { row: Node; textL: Label; radio: Sprite }[] = [];
        let y = H / 2 - 92 - rowH / 2 - 16;
        cfg.options.forEach((text, i) => {
            const row = block(this.card, 520, rowH, i === 0 ? Col.pinkSoft : Col.white, 14, 0, y, i === 0 ? Col.pink : Col.line);
            const textL = label(row, text, { size: 30, color: i === 0 ? Col.pinkDeep : Col.ink, hAlign: HorizontalTextAlignment.LEFT, wrap: 380 }, -40, 22);
            const radioN = new Node('radio');
            row.addChild(radioN);
            ui(radioN, 36, 36, 200, 0);
            const radio = radioN.addComponent(Sprite);
            this.setRadio(radio, i === 0);
            row.on(Node.EventType.TOUCH_END, () => {
                selected = i;
                rows.forEach((it, j) => {
                    const g = it.row.getComponent(Graphics);
                    if (g) {
                        g.clear();
                        g.fillColor = j === i ? Col.pinkSoft : Col.white;
                        g.strokeColor = j === i ? Col.pink : Col.line;
                        g.lineWidth = j === i ? 3 : 2;
                        g.roundRect(-260, -rowH / 2, 520, rowH, 14);
                        g.fill();
                        g.stroke();
                    }
                    it.textL.color = j === i ? Col.pinkDeep : Col.ink;
                    this.setRadio(it.radio, j === i);
                });
            });
            rows.push({ row, textL, radio });
            y -= rowH + 14;
        });

        return new Promise<PopupResult>((resolve) => {
            button(this.card, '确 定', () => {
                this.close();
                resolve({ ok: true, value: cfg.options[selected], alt: false, index: selected });
            }, { w: 500, h: 92, y: -H / 2 + 82 });
        });
    }

    private setRadio(sp: Sprite, on: boolean): void {
        const sf = Img.get(on ? 'radio_on' : 'radio_off');
        sp.spriteFrame = sf;
        sp.color = on ? Col.white : Col.pink;
    }

    /** 自定义内容弹窗（如：购物清单） */
    custom(cfg: CustomCfg): Promise<PopupResult> {
        const W = 620;
        const header = this.open(W, cfg.height);
        label(header, cfg.title, { size: 32, bold: true, color: Col.white });
        const content = new Node('content');
        this.card.addChild(content);
        ui(content, W - 60, cfg.height - 220, 0, 40);
        cfg.build(content);
        return new Promise<PopupResult>((resolve) => {
            const n = cfg.buttons.length;
            cfg.buttons.forEach((b, i) => {
                button(this.card, b.label, () => {
                    this.close();
                    resolve({ ok: true, value: b.value, alt: false, index: i });
                }, {
                    w: n > 1 ? 260 : 500, h: 88,
                    y: -cfg.height / 2 + 78,
                    x: n > 1 ? (i === 0 ? -140 : 140) : 0,
                    color: b.primary ? Col.pink : Col.white,
                    textColor: b.primary ? Col.white : Col.pinkDeep,
                    stroke: b.primary ? undefined : Col.pink,
                    size: 30,
                });
            });
        });
    }
}
