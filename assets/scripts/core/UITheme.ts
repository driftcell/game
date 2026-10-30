import { Button, Color, Graphics, HorizontalTextAlignment, Label, Node, Size, Sprite, SpriteFrame, Texture2D, UITransform, UIOpacity, VerticalTextAlignment, Widget } from 'cc';

/** 设计分辨率（竖屏，全面屏手机比例，与切图一致） */
export const DW = 750;
export const DH = 1624;

/** 全局配色 */
export const Col = {
    pink: new Color(238, 96, 148),      // 主按钮粉
    pinkDeep: new Color(214, 64, 118),  // 强调粉（名字等）
    pinkSoft: new Color(253, 236, 243), // 浅粉底
    pinkPale: new Color(252, 226, 237), // 更浅粉底（背景）
    ink: new Color(72, 60, 68),         // 正文深灰
    gray: new Color(118, 106, 114),      // 次要文字（对比度更稳）
    line: new Color(232, 214, 224),     // 描边线
    white: new Color(255, 255, 255),
    gold: new Color(246, 183, 60),      // 成就奖章
    wall: new Color(250, 240, 234),     // 客厅墙
    floor: new Color(233, 203, 173),    // 客厅地板
    night: new Color(43, 47, 82),       // 夜晚
    nightFloor: new Color(34, 37, 66),
    skin: new Color(255, 233, 218),     // 皮肤色
    hair: new Color(90, 74, 72),        // 头发
    momSkin: new Color(248, 224, 232),
    dadSkin: new Color(224, 234, 244),
    xzSkin: new Color(214, 193, 162),   // 小智（小树桩）
    sofa: new Color(216, 199, 188),
    box: new Color(200, 155, 109),
    wood: new Color(228, 196, 158),
};

let _whiteSF: SpriteFrame | null = null;
/** 1x1 白色贴图（用于 Sprite 着色） */
export function whiteSF(): SpriteFrame {
    if (!_whiteSF) {
        let tex: Texture2D | null = null;
        try {
            tex = new Texture2D();
            tex.reset({ width: 1, height: 1, format: Texture2D.PixelFormat.RGBA8888 });
            tex.uploadData(new Uint8Array([255, 255, 255, 255]));
        } catch (e) {
            // 兜底：canvas 路径（web 预览）
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 2;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 2, 2);
            tex = new Texture2D();
            (tex as any).image = canvas;
        }
        _whiteSF = new SpriteFrame();
        _whiteSF.texture = tex;
    }
    return _whiteSF;
}

export function ui(node: Node, w = 100, h = 100, x = 0, y = 0): UITransform {
    const t = node.addComponent(UITransform);
    t.setContentSize(w, h);
    node.setPosition(x, y);
    return t;
}

export function sizeOf(node: Node): Size {
    const t = node.getComponent(UITransform);
    return t ? t.contentSize : new Size(DW, DH);
}

export function opacity(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
}

/** 全屏 UI 层：固定设计尺寸，居中于父节点 */
export function layer(parent: Node, name: string): Node {
    const n = new Node(name);
    parent.addChild(n);
    ui(n, DW, DH);
    return n;
}

/** 四边拉伸铺满父节点的层 */
export function stretch(parent: Node, name: string): Node {
    const n = new Node(name);
    parent.addChild(n);
    const w = n.addComponent(Widget);
    w.isAlignTop = true; w.isAlignBottom = true; w.isAlignLeft = true; w.isAlignRight = true;
    w.top = 0; w.bottom = 0; w.left = 0; w.right = 0;
    w.alignMode = Widget.AlignMode.ALWAYS;
    return n;
}

/** 重绘纯色块（可圆角、可描边）。颜色可带透明度 */
export function paintBlock(g: Graphics, w: number, h: number, color: Color, radius = 0, stroke?: Color, lineWidth = 2): void {
    g.clear();
    g.fillColor = color;
    if (stroke) { g.strokeColor = stroke; g.lineWidth = lineWidth; }
    if (radius > 0) g.roundRect(-w / 2, -h / 2, w, h, radius);
    else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    if (stroke) g.stroke();
}

/** 纯色块（可圆角、可描边）。颜色可带透明度 */
export function block(parent: Node, w: number, h: number, color: Color, radius = 0, x = 0, y = 0, stroke?: Color, lineWidth = 2): Node {
    const n = new Node('block');
    parent.addChild(n);
    ui(n, w, h, x, y);
    paintBlock(n.addComponent(Graphics), w, h, color, radius, stroke, lineWidth);
    return n;
}

/** 五角星图标（小星星货币、商品价签共用） */
export function starNode(parent: Node, size: number, color: Color, x = 0, y = 0): Node {
    const n = new Node('star');
    parent.addChild(n);
    ui(n, size, size, x, y);
    const g = n.addComponent(Graphics);
    const r = size / 2;
    const inner = r * 0.45;
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = Math.cos(a) * radius;
        const py = Math.sin(a) * radius;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.close();
    g.fillColor = color;
    g.fill();
    return n;
}

export interface LabelOpt {
    size?: number; color?: Color; bold?: boolean; italic?: boolean;
    family?: string; lineHeight?: number;
    hAlign?: HorizontalTextAlignment; vAlign?: VerticalTextAlignment;
}

export interface BoxLabelOpt extends LabelOpt {
    /** 文本超框时自动缩小字号（有额外 CPU 开销，打字机效果勿用） */
    shrink?: boolean;
}

function applyFont(l: Label, o: LabelOpt): void {
    l.useSystemFont = true;
    l.fontFamily = o.family ?? 'PingFang SC';
    l.fontSize = o.size ?? 28;
    l.color = o.color ?? Col.ink;
    l.isBold = o.bold ?? false;
    l.isItalic = o.italic ?? false;
    l.lineHeight = o.lineHeight ?? Math.round((o.size ?? 28) * 1.4);
    l.horizontalAlign = o.hAlign ?? HorizontalTextAlignment.CENTER;
    l.verticalAlign = o.vAlign ?? VerticalTextAlignment.CENTER;
}

/** 自由文本：节点尺寸自适应文字，(x,y) 即文字中心 */
export function label(parent: Node, text: string, o: LabelOpt = {}, x = 0, y = 0): Label {
    const n = new Node('label');
    parent.addChild(n);
    const l = n.addComponent(Label);
    applyFont(l, o);
    l.overflow = Label.Overflow.NONE;
    l.string = text;
    n.setPosition(x, y);
    return l;
}

/**
 * 框内文本：内容尺寸 = 框内安全区，锚点保持默认中心，(x,y) 为框中心。
 * 文字按 hAlign/vAlign 在框内对齐，不修改锚点，多行也不会偏。
 */
export function labelInBox(parent: Node, text: string, w: number, h: number, o: BoxLabelOpt = {}, x = 0, y = 0): Label {
    const n = new Node('label');
    parent.addChild(n);
    ui(n, w, h, x, y);
    const l = n.addComponent(Label);
    applyFont(l, o);
    l.overflow = o.shrink ? Label.Overflow.SHRINK : Label.Overflow.CLAMP;
    l.enableWrapText = true;
    l.string = text;
    return l;
}

/**
 * 自动高度文本：宽度固定，高度随内容向下生长，(x,yTop) 为文字顶边。
 * 高度用 measure() 读取后自行布局容器（如对白卡）。
 */
export function labelAuto(parent: Node, text: string, w: number, o: LabelOpt = {}, x = 0, yTop = 0): Label {
    const n = new Node('label');
    parent.addChild(n);
    const lineH = o.lineHeight ?? Math.round((o.size ?? 28) * 1.4);
    const t = ui(n, w, lineH, x, yTop);
    const l = n.addComponent(Label);
    applyFont(l, o);
    l.overflow = Label.Overflow.RESIZE_HEIGHT;
    l.enableWrapText = true;
    const ax = l.horizontalAlign === HorizontalTextAlignment.LEFT ? 0 : l.horizontalAlign === HorizontalTextAlignment.RIGHT ? 1 : 0.5;
    t.setAnchorPoint(ax, 1);
    l.string = text;
    return l;
}

/** 强制立即排版并返回文字实际高度（配合 labelAuto 使用） */
export function measure(l: Label): number {
    l.updateRenderData(true);
    const t = l.node.getComponent(UITransform);
    return t ? t.height : l.lineHeight;
}

export interface BtnOpt {
    w?: number; h?: number; color?: Color; textColor?: Color;
    size?: number; radius?: number; stroke?: Color; x?: number; y?: number;
}

export function button(parent: Node, text: string, cb: () => void, o: BtnOpt = {}): Node {
    const n = block(parent, o.w ?? 560, o.h ?? 96, o.color ?? Col.pink, o.radius ?? 14, o.x ?? 0, o.y ?? 0, o.stroke);
    const b = n.addComponent(Button);
    b.transition = Button.Transition.SCALE;
    b.zoomScale = 0.96;
    b.target = n;
    label(n, text, { size: o.size ?? 32, color: o.textColor ?? Col.white, bold: true });
    n.on(Button.EventType.CLICK, cb);
    return n;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** 简易婴儿床线稿绘制（封面 / 夜晚场景复用） */
export function drawCrib(parent: Node, w: number, color: Color, x = 0, y = 0): Node {
    const n = new Node('crib');
    parent.addChild(n);
    ui(n, w, w * 0.62, x, y);
    const g = n.addComponent(Graphics);
    const hw = w / 2, hh = w * 0.31;
    const line = (x1: number, y1: number, x2: number, y2: number, lw = 4) => {
        g.moveTo(x1, y1); g.lineTo(x2, y2);
        g.lineWidth = lw; g.strokeColor = color; g.stroke();
    };
    const railN = 8;
    for (let i = 0; i <= railN; i++) {
        const rx = -hw + 26 + (i * (w - 52)) / railN;
        line(rx, -hh * 0.55, rx, hh * 0.55, 3);
    }
    // 两端床头（加高圆弧顶）
    g.strokeColor = color; g.lineWidth = 5;
    g.moveTo(-hw, -hh * 0.7);
    g.lineTo(-hw, hh * 0.35);
    g.arc(-hw + 13, hh * 0.35, 13, Math.PI, 0, true);
    g.lineTo(-hw + 26, -hh * 0.7);
    g.stroke();
    g.moveTo(hw, -hh * 0.7);
    g.lineTo(hw, hh * 0.35);
    g.arc(hw - 13, hh * 0.35, 13, Math.PI, 0, true);
    g.lineTo(hw - 26, -hh * 0.7);
    g.stroke();
    // 床垫
    g.fillColor = new Color(color.r, color.g, color.b, 40);
    g.roundRect(-hw + 26, -hh * 0.28, w - 52, hh * 0.42, 8);
    g.fill();
    // 底梁
    line(-hw + 10, -hh * 0.62, hw - 10, -hh * 0.62, 6);
    // 床腿
    line(-hw + 12, -hh * 0.62, -hw + 12, -hh, 6);
    line(hw - 12, -hh * 0.62, hw - 12, -hh, 6);
    return n;
}
