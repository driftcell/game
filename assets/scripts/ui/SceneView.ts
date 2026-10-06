import { Color, Graphics, Node } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, layer, ui } from '../core/UITheme';

export type SceneKind = 'pink' | 'living-day' | 'living-night';

/** 场景背景层：真实切图 + 夜晚压暗 */
export class SceneView {
    root: Node;
    private host: Node;
    private dim: Node | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'scene');
        this.host = new Node('host');
        this.root.addChild(this.host);
        this.set('pink');
    }

    set(kind: SceneKind): void {
        this.host.removeAllChildren();
        this.dim = null;
        // 粉色底兜底（图片按高铺满后两侧露边时显示）
        block(this.host, 4000, 4000, Col.pinkPale);
        if (kind === 'pink') {
            const s = Img.size('bg_sparkle');
            const scale = DH / s.height;
            Img.sprite(this.host, 'bg_sparkle', s.width * scale, 0, 0);
            return;
        }
        // 客厅场景图：按高度铺满，水平居中（图片自带粉色边框，与页面底色融合）
        const s = Img.size('living_room');
        const scale = DH / s.height;
        Img.sprite(this.host, 'living_room', s.width * scale, 0, 0);
        if (kind === 'living-night') {
            this.dim = block(this.host, 4000, 4000, new Color(24, 28, 58, 150));
        }
    }

    /** 夜晚小夜灯暖光：多层椭圆叠加成柔和光晕（单层圆角块会有生硬黄椭圆边） */
    nightGlow(x: number, y: number): void {
        if (!this.dim) return;
        const layers = 12;
        const rx = 380;
        const ry = 300;
        for (let i = 0; i < layers; i++) {
            const k = 1 - i / layers;
            const w = rx * 2 * k;
            const h = ry * 2 * k;
            const n = new Node('glow');
            this.host.addChild(n);
            ui(n, w, h, x, y);
            const g = n.addComponent(Graphics);
            g.fillColor = new Color(255, 226, 168, 7);
            g.ellipse(0, 0, w / 2, h / 2);
            g.fill();
        }
    }
}
