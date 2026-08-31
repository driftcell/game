import { Node, tween, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { DW, layer, sizeOf } from '../core/UITheme';

export type PKind = 'mom' | 'supporter' | 'xiaozhi';

/**
 * 左下角说话角色立绘（露上半身）。
 * 设计图约定：说话角色出现在屏幕左下角，气泡尖角指向该角色。
 */
export class Portraits {
    root: Node;
    private current: PKind | null = null;
    private nodes = new Map<PKind, Node>();

    constructor(parent: Node) {
        this.root = layer(parent, 'portraits');
    }

    private build(kind: PKind): Node {
        const key = kind === 'mom' ? 'mom' : kind === 'supporter' ? 'dad' : 'xiaozhi';
        const w = kind === 'xiaozhi' ? 300 : 330;
        const n = Img.sprite(this.root, key, w);
        return n;
    }

    show(kind: PKind): void {
        if (this.current === kind) return;
        this.hide();
        this.current = kind;
        let n = this.nodes.get(kind);
        if (!n) { n = this.build(kind); this.nodes.set(kind, n); }
        n.active = true;
        const H = sizeOf(this.root).height;
        n.setPosition(-sizeOf(this.root).width / 2 + 185, -H / 2 + 130);
        n.setScale(new Vec3(0.9, 0.9, 1));
        tween(n).to(0.18, { scale: new Vec3(1, 1, 1) }).start();
    }

    hide(): void {
        if (this.current) {
            const n = this.nodes.get(this.current);
            if (n) n.active = false;
            this.current = null;
        }
    }
}
