import { Color, Graphics, Node, Vec2 } from 'cc';
import { Img } from '../core/Assets';
import { block, Col, DH, layer, ui } from '../core/UITheme';

export type SceneKind = 'pink' | 'living-day' | 'living-night' | 'bedroom-day' | 'bedroom-night' | 'bedroom-setup';

/** 场景取景：在「按设计高度铺满」的基础上再做缩放与偏移，裁掉房间外墙和上下留白 */
export interface SceneFrame {
    zoom: number;
    x: number;
    y: number;
}

const FRAME_PINK: SceneFrame = { zoom: 1, x: 0, y: 0 };
/** 客厅屋顶在 11.9%、木地板前沿在 85% 左右，放大后上下留白和粉色外墙底座都出画 */
const FRAME_LIVING: SceneFrame = { zoom: 1.38, x: 18, y: -36 };
/** 从全屋进入主卧后的白天取景，与睡眠区小游戏使用同一张干净底图。 */
const FRAME_BEDROOM_DAY: SceneFrame = { zoom: 1.18, x: 14, y: 56 };
/** 卧室上方留白 8.3%/9.4%、木地板前沿在 79.4%，需比客厅更近才能同时裁掉屋顶和墙脚 */
const FRAME_BEDROOM_NIGHT: SceneFrame = { zoom: 1.44, x: 30, y: -130 };
const FRAME_BEDROOM_SETUP: SceneFrame = { zoom: 1.44, x: 30, y: -130 };
/** 小游戏房间保留底部物品栏遮住地板，只把顶部留白和屋顶裁掉 */
export const FRAME_SLEEP_ROOM: SceneFrame = { zoom: 1.18, x: 14, y: 56 };
export const FRAME_DIAPER_ROOM: SceneFrame = { zoom: 1.2, x: 18, y: 32 };
export const FRAME_BAG_ROOM: SceneFrame = { zoom: 1.22, x: 18, y: 34 };

/** 按取景参数绘制背景：先铺一块兜底色，再放大并偏移房间切图 */
export function sceneBackground(parent: Node, key: string, frame: SceneFrame, fallback: Color): Node {
    block(parent, 4000, 4000, fallback);
    const s = Img.size(key);
    const scale = DH / s.height * frame.zoom;
    return Img.sprite(parent, key, s.width * scale, frame.x, frame.y);
}

/** 把原设计稿坐标换算成取景后的屏幕坐标 */
export function framePoint(frame: SceneFrame, x: number, y: number): Vec2 {
    return new Vec2(frame.x + x * frame.zoom, frame.y + y * frame.zoom);
}

/** 把屏幕坐标反算回原设计稿坐标（用于命中区判断） */
export function unframePoint(frame: SceneFrame, x: number, y: number): Vec2 {
    return new Vec2((x - frame.x) / frame.zoom, (y - frame.y) / frame.zoom);
}

/** 取景后的显示尺寸 */
export function frameLength(frame: SceneFrame, length: number): number {
    return length * frame.zoom;
}

/** 场景背景层：真实切图 + 夜晚压暗 */
export class SceneView {
    root: Node;
    private host: Node;
    private dim: Node | null = null;
    private frame: SceneFrame = FRAME_PINK;

    constructor(parent: Node) {
        this.root = layer(parent, 'scene');
        this.host = new Node('host');
        this.root.addChild(this.host);
        this.set('pink');
    }

    set(kind: SceneKind): void {
        this.host.removeAllChildren();
        this.dim = null;
        if (kind === 'pink') {
            this.frame = FRAME_PINK;
            block(this.host, 4000, 4000, Col.pinkPale);
            const s = Img.size('bg_sparkle');
            const scale = DH / s.height;
            Img.sprite(this.host, 'bg_sparkle', s.width * scale, 0, 0);
            return;
        }
        if (kind === 'bedroom-day') {
            this.frame = FRAME_BEDROOM_DAY;
            sceneBackground(this.host, 'bedroom', this.frame, Col.pinkPale);
            return;
        }
        if (kind === 'bedroom-night') {
            // 卧室夜景（第一章收尾）：床边小夜灯暖光已画进切图，无需再压暗；
            // 两侧兜底用天空色，宽的屏幕上与画面无缝
            this.frame = FRAME_BEDROOM_NIGHT;
            sceneBackground(this.host, 'bedroom_night', this.frame, new Color(50, 56, 91));
            return;
        }
        if (kind === 'bedroom-setup') {
            // 第二章白天卧室（地上有行李箱和纸箱）
            this.frame = FRAME_BEDROOM_SETUP;
            sceneBackground(this.host, 'bedroom_setup', this.frame, new Color(250, 229, 226));
            return;
        }
        // 客厅场景图：放大取景，左右墙与地板延伸到屏幕外
        this.frame = FRAME_LIVING;
        sceneBackground(this.host, 'living_room', this.frame, Col.pinkPale);
        if (kind === 'living-night') {
            this.dim = block(this.host, 4000, 4000, new Color(24, 28, 58, 150));
        }
    }

    /** 夜晚小夜灯暖光：多层椭圆叠加成柔和光晕（单层圆角块会有生硬黄椭圆边） */
    nightGlow(x: number, y: number): void {
        const layers = 12;
        const rx = 380;
        const ry = 300;
        // 光晕跟着背景取景一起换算，保证与切图里的灯光位置对齐
        const p = framePoint(this.frame, x, y);
        for (let i = 0; i < layers; i++) {
            const k = 1 - i / layers;
            const w = rx * 2 * k;
            const h = ry * 2 * k;
            const n = new Node('glow');
            this.host.addChild(n);
            ui(n, w, h, p.x, p.y);
            const g = n.addComponent(Graphics);
            g.fillColor = new Color(255, 226, 168, 7);
            g.ellipse(0, 0, w / 2, h / 2);
            g.fill();
        }
    }
}
