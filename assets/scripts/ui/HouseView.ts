import { BlockInputEvents, Color, EventTouch, Graphics, Label, Mask, Node, Tween, tween, UITransform, Vec2, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { GameState } from '../core/GameState';
import { block, button, Col, DW, label, labelInBox, layer, opacity, paintBlock, sleep, ui } from '../core/UITheme';

export type HouseAreaId = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'entry' | 'balcony' | 'study';

interface HouseAreaDef {
    id: HouseAreaId;
    name: string;
    unlockedName?: string;
    tag: [number, number];
    hit: [number, number, number, number];
    tagWidth: number;
    unlockText: string;
    lockedHint: string;
    description: string;
    shade?: [number, number][];
}

export interface HousePlayOptions {
    title: string;
    prompt: string;
    /** 指定后，点这个区域会继续当前剧情；其他已开放区域仍可放大查看。 */
    target?: HouseAreaId;
    /** 进入全屋时播放一次由灰到彩的点亮演出。 */
    reveal?: HouseAreaId;
    /** 不指定 target 时为自由回顾模式，底部按钮退出。 */
    doneLabel?: string;
}

interface AreaNode {
    root: Node;
    ring: Node;
    bg: Node;
    text: Label;
    shade: Node | null;
}

const ART_W = 820;
const VIEW_W = 724;
const VIEW_H = 570;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;

/**
 * 坐标均为整张全屋图上的归一化坐标，原点在左上角。
 * 开局五个区域可查看；阳台和书房仍显示在全屋中，但以灰雾和章节条件标示。
 */
const AREAS: HouseAreaDef[] = [
    {
        id: 'living', name: '客厅', tag: [0.265, 0.47], hit: [0.27, 0.47, 0.22, 0.23], tagWidth: 126,
        unlockText: '', lockedHint: '',
        description: '故事从客厅开始。以后这里也会慢慢加入喂奶角和亲子活动空间。',
    },
    {
        id: 'bedroom', name: '主卧 · 婴儿区', tag: [0.47, 0.255], hit: [0.485, 0.275, 0.23, 0.22], tagWidth: 202,
        unlockText: '', lockedHint: '',
        description: '宝宝的安全睡眠区和尿布台都在这里，先完成最需要的准备。',
    },
    {
        id: 'kitchen', name: '开放小厨房', tag: [0.62, 0.52], hit: [0.62, 0.475, 0.16, 0.20], tagWidth: 190,
        unlockText: '', lockedHint: '',
        description: '空间已经开放。奶具清洁、月子餐等内容会随对应故事逐步加入。',
    },
    {
        id: 'bathroom', name: '卫生间', tag: [0.72, 0.365], hit: [0.705, 0.375, 0.09, 0.15], tagWidth: 142,
        unlockText: '', lockedHint: '',
        description: '空间已经开放。产后护理和宝宝擦浴等故事会在这里发生。',
    },
    {
        id: 'entry', name: '玄关', tag: [0.85, 0.49], hit: [0.805, 0.455, 0.10, 0.16], tagWidth: 126,
        unlockText: '', lockedHint: '',
        description: '空间已经开放。待产包和出门清单会在这里留下生活的痕迹。',
    },
    {
        id: 'balcony', name: '阳台小花园', tag: [0.20, 0.64], hit: [0.25, 0.60, 0.23, 0.14], tagWidth: 190,
        unlockText: '第一章结束解锁', lockedHint: '完成第一章后，阳台会点亮，成为可以慢慢布置的小花园。',
        description: '新点亮的空间。种一盆薄荷，给忙碌的生活留一点透气的地方。',
        shade: [[0.142, 0.475], [0.24, 0.43], [0.37, 0.54], [0.365, 0.675], [0.22, 0.635], [0.142, 0.555]],
    },
    {
        id: 'study', name: '书房', unlockedName: '婴儿房 · 白天', tag: [0.48, 0.67], hit: [0.47, 0.59, 0.18, 0.20], tagWidth: 190,
        unlockText: '第四章结束解锁', lockedHint: '书房会在第四章结束后变成婴儿房（白天），现在先看看它在家里的位置。',
        description: '书房已经变成宝宝的白天房间。前六个月夜里仍建议宝宝与父母同室不同床。',
        shade: [[0.374, 0.44], [0.493, 0.37], [0.59, 0.47], [0.59, 0.66], [0.48, 0.73], [0.37, 0.62]],
    },
];

/** 全屋主界面：完整户型、房间热点、章节锁定态，以及放大后的拖动查看。 */
export class HouseView {
    root: Node;
    onOpen: () => void = () => {};
    onClose: () => void = () => {};
    private viewport: Node;
    private artwork: Node;
    private artH: number;
    private areas = new Map<HouseAreaId, AreaNode>();
    private unlocked = new Set<HouseAreaId>();
    private titleL: Label;
    private progressL: Label;
    private houseTypeL: Label;
    private infoTitleL: Label;
    private infoBodyL: Label;
    private actionLayer: Node;
    private toastN: Node;
    private toastL: Label;
    private options: HousePlayOptions = { title: '', prompt: '' };
    private revealPending: HouseAreaId | null = null;
    private resolve: (() => void) | null = null;
    private inputReady = true;
    private zoom = 1;
    private dragging = false;
    private activeTouchId: number | null = null;
    private dragDistance = 0;
    private lastTouch = new Vec2();

    constructor(parent: Node) {
        this.root = layer(parent, 'house-overview');
        const bg = block(this.root, 4000, 4000, new Color(250, 229, 226));
        bg.addComponent(BlockInputEvents);

        this.titleL = labelInBox(this.root, '', 420, 60, { size: 34, bold: true, color: Col.ink, shrink: true }, -135, 710);
        this.progressL = labelInBox(this.root, '', 480, 42, { size: 20, color: Col.gray }, -105, 656);
        this.houseTypeL = label(this.root, '户型① 两室一厅 · 全屋总览', { size: 22, color: Col.pinkDeep, bold: true }, 0, 576);
        label(this.root, '点房间查看 · 放大后可拖动 · 点「全屋」复位', { size: 21, color: Col.gray }, 0, 530);

        this.viewport = new Node('viewport');
        this.root.addChild(this.viewport);
        ui(this.viewport, VIEW_W, VIEW_H, 0, 100);
        // Cocos 3.8 的矩形遮罩会自动按 UITransform 绘制；不要另加空 Graphics。
        const mask = this.viewport.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_RECT;

        this.artwork = new Node('artwork');
        this.viewport.addChild(this.artwork);
        const size = Img.size('house_overview_blank');
        this.artH = ART_W * size.height / size.width;
        ui(this.artwork, ART_W, this.artH);
        Img.sprite(this.artwork, 'house_overview_blank', ART_W);
        this.buildAreas();
        this.bindPan();

        // 缩放控件始终在全屋层内，不依赖双指手感和浏览器滚轮。
        button(this.root, '＋', () => this.changeZoom(0.25), { w: 72, h: 62, size: 34, radius: 18, x: 308, y: -116, color: Col.white, textColor: Col.pinkDeep });
        button(this.root, '－', () => this.changeZoom(-0.25), { w: 72, h: 62, size: 34, radius: 18, x: 308, y: -190, color: Col.white, textColor: Col.pinkDeep });
        button(this.root, '全屋', () => this.resetView(), { w: 104, h: 58, size: 23, radius: 18, x: 292, y: -268, color: Col.white, textColor: Col.pinkDeep });

        const info = block(this.root, 650, 168, new Color(255, 255, 255, 242), 26, 0, -480, Col.line);
        this.infoTitleL = labelInBox(info, '', 584, 46, { size: 28, bold: true, color: Col.pinkDeep, shrink: true }, 0, 43);
        this.infoBodyL = labelInBox(info, '', 580, 78, { size: 22, color: Col.ink, lineHeight: 31 }, 0, -30);

        this.actionLayer = new Node('action');
        this.root.addChild(this.actionLayer);
        ui(this.actionLayer, DW, 130, 0, -630);

        this.toastN = block(this.root, 610, 88, new Color(72, 60, 68, 238), 22, 0, -342);
        this.toastL = labelInBox(this.toastN, '', 566, 72, { size: 22, color: Col.white, lineHeight: 29 });
        opacity(this.toastN).opacity = 0;
        this.root.active = false;
    }

    /** 由剧情断点推导后传入；不在视图内另存一份区域进度。 */
    setUnlocked(ids: readonly HouseAreaId[]): void {
        this.unlocked = new Set(ids);
        this.refreshAreas();
        this.refreshProgress();
    }

    async play(options: HousePlayOptions): Promise<void> {
        this.options = options;
        this.revealPending = options.reveal ?? null;
        this.inputReady = !this.revealPending;
        this.root.active = true;
        opacity(this.root).opacity = 0;
        tween(opacity(this.root)).to(0.22, { opacity: 255 }).start();
        this.titleL.string = options.title;
        this.resetView(false);
        this.dragging = false;
        this.activeTouchId = null;
        this.dragDistance = 0;
        this.refreshAreas();
        this.refreshProgress();
        this.showDefaultInfo();
        this.buildAction();
        const toastOp = opacity(this.toastN);
        Tween.stopAllByTarget(toastOp);
        toastOp.opacity = 0;
        this.onOpen();

        const done = new Promise<void>((r) => { this.resolve = r; });
        if (this.revealPending) {
            const id = this.revealPending;
            await sleep(650);
            this.revealPending = null;
            this.inputReady = true;
            this.refreshAreas();
            this.refreshProgress();
            this.showAreaInfo(id);
            this.toast(`新空间：${this.areaName(id)}已点亮`);
        }
        return done;
    }

    private buildAreas(): void {
        // 灰雾先画，热点其次，房间名牌最后，保证小房间也可靠点中。
        for (const def of AREAS) {
            let shade: Node | null = null;
            if (def.shade) {
                shade = new Node(`shade_${def.id}`);
                this.artwork.addChild(shade);
                ui(shade, ART_W, this.artH);
                const g = shade.addComponent(Graphics);
                g.fillColor = new Color(103, 100, 110, 142);
                g.strokeColor = new Color(255, 255, 255, 105);
                g.lineWidth = 3;
                def.shade.forEach(([x, y], i) => {
                    const px = this.imageX(x), py = this.imageY(y);
                    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
                });
                g.close();
                g.fill();
                g.stroke();
            }
            this.areas.set(def.id, { root: null, ring: null, bg: null, text: null, shade });
        }
        for (const def of AREAS) {
            const [x, y, w, h] = def.hit;
            const hotspot = new Node(`hotspot_${def.id}`);
            this.artwork.addChild(hotspot);
            ui(hotspot, w * ART_W, h * this.artH, this.imageX(x), this.imageY(y));
            hotspot.on(Node.EventType.TOUCH_END, (e: EventTouch) => this.activateArea(def.id, e.getID()));
        }
        for (const def of AREAS) {
            const area = this.areas.get(def.id)!;
            const root = new Node(`tag_${def.id}`);
            this.artwork.addChild(root);
            ui(root, def.tagWidth, 48, this.imageX(def.tag[0]), this.imageY(def.tag[1]));
            const ring = block(root, def.tagWidth + 12, 62, new Color(238, 96, 148, 38), 28);
            const bgN = block(root, def.tagWidth, 48, Col.white, 24, 0, 0, Col.pink, 2);
            // 只在可见卡片上接收点击，文字作为卡片子节点，避免透明 root 抢其他房间的触摸。
            bgN.on(Node.EventType.TOUCH_END, (e: EventTouch) => this.activateArea(def.id, e.getID()));
            const text = labelInBox(bgN, '', def.tagWidth - 14, 66, { size: 20, color: Col.ink, lineHeight: 24, shrink: true });
            area.root = root;
            area.ring = ring;
            area.bg = bgN;
            area.text = text;
        }
    }

    private refreshAreas(): void {
        for (const def of AREAS) {
            const n = this.areas.get(def.id);
            if (!n || !n.root) continue;
            const open = this.isOpen(def.id);
            const targeted = this.options.target === def.id;
            const h = open ? 48 : 66;
            const w = def.tagWidth;
            n.root.getComponent(UITransform)!.setContentSize(w, h);
            n.bg.getComponent(UITransform)!.setContentSize(w, h);
            const fill = !open ? new Color(132, 123, 130, 242)
                : targeted ? Col.pink : new Color(255, 255, 255, 242);
            const stroke = targeted ? Col.white : open ? Col.pink : new Color(235, 228, 232);
            paintBlock(n.bg.getComponent(Graphics)!, w, h, fill, 23, stroke, 2);
            n.text.string = open ? this.areaName(def.id) : `锁定｜${def.name}\n${def.unlockText}`;
            n.text.fontSize = open ? 20 : 17;
            n.text.lineHeight = open ? 25 : 23;
            n.text.color = open && !targeted ? Col.ink : Col.white;
            n.text.node.getComponent(UITransform)!.setContentSize(w - 14, 70);
            if (n.shade) n.shade.active = !open;
            Tween.stopAllByTarget(n.ring);
            n.ring.setScale(new Vec3(1, 1, 1));
            n.ring.active = targeted || this.revealPending === def.id;
            n.ring.getComponent(UITransform)!.setContentSize(w + 12, h + 12);
            paintBlock(n.ring.getComponent(Graphics)!, w + 12, h + 12, new Color(238, 96, 148, 42), 28);
            if (targeted && this.root.active) {
                tween(n.ring).to(0.85, { scale: new Vec3(1.08, 1.08, 1) })
                    .to(0.85, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();
            }
        }
    }

    private refreshProgress(): void {
        const count = AREAS.filter((a) => this.isOpen(a.id)).length;
        this.progressL.string = `${count}/${AREAS.length} 个空间已点亮 · 已添置 ${GameState.owned.length} 件`;
        this.houseTypeL.string = this.isOpen('study') ? '户型③ 三室一厅 · 全屋总览'
            : this.isOpen('balcony') ? '户型② 两室一厅＋阳台 · 全屋总览'
                : '户型① 两室一厅 · 全屋总览';
    }

    private activateArea(id: HouseAreaId, touchId: number): void {
        if (!this.inputReady || this.activeTouchId !== touchId || this.dragDistance > 12) return;
        const def = AREAS.find((a) => a.id === id)!;
        if (!this.isOpen(id)) {
            this.showAreaInfo(id);
            this.toast(def.lockedHint);
            return;
        }
        if (this.options.target === id) {
            this.finish();
            return;
        }
        this.showAreaInfo(id);
        this.focusArea(id);
    }

    private showDefaultInfo(): void {
        this.infoTitleL.string = this.options.reveal ? '家里又多了一个新空间' : '整个家，都在这里';
        this.infoBodyL.string = this.options.prompt;
    }

    private showAreaInfo(id: HouseAreaId): void {
        const def = AREAS.find((a) => a.id === id)!;
        const open = this.isOpen(id);
        this.infoTitleL.string = open ? this.areaName(id) : `${def.name} · 尚未开放`;
        this.infoBodyL.string = open ? def.description : def.lockedHint;
    }

    private buildAction(): void {
        this.actionLayer.removeAllChildren();
        if (this.options.target) {
            const target = AREAS.find((a) => a.id === this.options.target)!;
            labelInBox(this.actionLayer, `点「${this.areaName(target.id)}」继续当前故事`, 650, 72,
                { size: 25, bold: true, color: Col.pinkDeep }, 0, 0);
        } else {
            button(this.actionLayer, this.options.doneLabel ?? '完成回顾', () => this.finish(),
                { w: 430, h: 82, size: 28, radius: 22 });
        }
    }

    private finish(): void {
        if (!this.inputReady || !this.resolve) return;
        const done = this.resolve;
        this.resolve = null;
        this.inputReady = false;
        for (const area of this.areas.values()) Tween.stopAllByTarget(area.ring);
        Tween.stopAllByTarget(this.artwork);
        Tween.stopAllByTarget(opacity(this.toastN));
        const op = opacity(this.root);
        tween(op).to(0.18, { opacity: 0 }).call(() => {
            this.root.active = false;
            op.opacity = 255;
            this.onClose();
            done();
        }).start();
    }

    /** 从底部导航进入时的自由浏览：随时可关闭，不阻塞剧情 */
    get isPlaying(): boolean {
        return this.root.active;
    }

    close(): void {
        if (this.root.active) this.finish();
    }

    /** 商店购买后刷新「已添置 N 件」 */
    refreshOwned(): void {
        this.refreshProgress();
    }

    private isOpen(id: HouseAreaId): boolean {
        return this.unlocked.has(id) && this.revealPending !== id;
    }

    private areaName(id: HouseAreaId): string {
        const def = AREAS.find((a) => a.id === id)!;
        return this.unlocked.has(id) && def.unlockedName ? def.unlockedName : def.name;
    }

    private toast(text: string): void {
        this.toastL.string = text;
        const op = opacity(this.toastN);
        Tween.stopAllByTarget(op);
        tween(op).to(0.18, { opacity: 255 }).delay(2.5).to(0.35, { opacity: 0 }).start();
    }

    private bindPan(): void {
        this.viewport.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            const id = e.getID();
            // 暂不支持双指缩放：额外触点不参与拖动，并把本次手势标记为非点击。
            if (this.activeTouchId !== null) {
                this.dragDistance = Math.max(this.dragDistance, 24);
                return;
            }
            this.activeTouchId = id;
            const p = e.getUILocation();
            this.lastTouch.set(p.x, p.y);
            this.dragging = true;
            this.dragDistance = 0;
            Tween.stopAllByTarget(this.artwork);
            // 缩放回弹/聚焦动画可能只播到一半，后续逻辑必须以真实节点缩放为准。
            this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.artwork.scale.x));
        });
        this.viewport.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this.dragging || this.activeTouchId !== e.getID()) return;
            const p = e.getUILocation();
            const dx = p.x - this.lastTouch.x, dy = p.y - this.lastTouch.y;
            this.lastTouch.set(p.x, p.y);
            this.dragDistance += Math.abs(dx) + Math.abs(dy);
            if (this.zoom <= MIN_ZOOM) return;
            const next = this.clampPan(this.artwork.position.x + dx, this.artwork.position.y + dy);
            this.artwork.setPosition(next.x, next.y);
        });
        const end = (e: EventTouch): void => {
            if (this.activeTouchId !== e.getID()) return;
            this.dragging = false;
            this.activeTouchId = null;
        };
        this.viewport.on(Node.EventType.TOUCH_END, end);
        this.viewport.on(Node.EventType.TOUCH_CANCEL, end);
    }

    private changeZoom(delta: number): void {
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta));
        if (next === MIN_ZOOM) { this.resetView(); return; }
        this.zoom = next;
        const p = this.clampPan(this.artwork.position.x, this.artwork.position.y);
        Tween.stopAllByTarget(this.artwork);
        tween(this.artwork).to(0.18, { scale: new Vec3(next, next, 1), position: new Vec3(p.x, p.y, 0) }).start();
    }

    private focusArea(id: HouseAreaId): void {
        const def = AREAS.find((a) => a.id === id)!;
        this.zoom = 1.55;
        const p = this.clampPan(-this.imageX(def.tag[0]) * this.zoom, -this.imageY(def.tag[1]) * this.zoom);
        Tween.stopAllByTarget(this.artwork);
        tween(this.artwork).to(0.28, { scale: new Vec3(this.zoom, this.zoom, 1), position: new Vec3(p.x, p.y, 0) }).start();
    }

    private resetView(animated = true): void {
        this.zoom = 1;
        Tween.stopAllByTarget(this.artwork);
        if (animated) {
            tween(this.artwork).to(0.22, { scale: new Vec3(1, 1, 1), position: new Vec3(0, 0, 0) }).start();
        } else {
            this.artwork.setScale(new Vec3(1, 1, 1));
            this.artwork.setPosition(0, 0);
        }
    }

    private clampPan(x: number, y: number): Vec2 {
        const maxX = Math.max(0, (ART_W * this.zoom - VIEW_W) / 2 + 30);
        const maxY = Math.max(0, (this.artH * this.zoom - VIEW_H) / 2 + 30);
        return new Vec2(Math.max(-maxX, Math.min(maxX, x)), Math.max(-maxY, Math.min(maxY, y)));
    }

    private imageX(normalized: number): number { return (normalized - 0.5) * ART_W; }
    private imageY(normalized: number): number { return (0.5 - normalized) * this.artH; }
}
