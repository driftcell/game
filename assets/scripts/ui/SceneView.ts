import { Color, Node } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, layer } from '../core/UITheme';

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

    /** 夜晚小夜灯暖光（画在压暗层之上） */
    nightGlow(x: number, y: number): void {
        if (!this.dim) return;
        block(this.host, 300, 220, new Color(255, 226, 168, 55), 110, x, y);
    }
}
