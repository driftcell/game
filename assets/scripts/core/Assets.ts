import { Node, resources, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { ui } from './UITheme';

/** 资源清单（key -> resources 路径）。换高清图时直接覆盖同名文件即可 */
const MANIFEST: Record<string, string> = {
    heart_open: 'img/heart_open',
    title: 'img/title',
    bg_sparkle: 'img/bg_sparkle',
    bg_soft: 'img/bg_soft',
    living_room: 'img/living_room',
    mom: 'img/mom',
    dad: 'img/dad',
    xiaozhi: 'img/xiaozhi',
    crib_line: 'img/crib_line',
    crib_fill: 'img/crib_fill',
    calendar: 'img/calendar',
    ribbon: 'img/ribbon',
    thought: 'img/thought',
    phone: 'img/phone',
    task_sleep: 'img/task_sleep',
    task_diaper: 'img/task_diaper',
    task_list: 'img/task_list',
    radio_off: 'img/radio_off',
    radio_on: 'img/radio_on',
};

class ImgRegistry {
    private map = new Map<string, SpriteFrame>();
    private missing: string[] = [];

    loadAll(): Promise<void> {
        const jobs = Object.keys(MANIFEST).map((key) => new Promise<void>((resolve) => {
            resources.load(`${MANIFEST[key]}/spriteFrame`, SpriteFrame, (err, sf) => {
                if (err || !sf) { this.missing.push(key); console.warn(`[assets] 加载失败: ${key}`, err); }
                else this.map.set(key, sf);
                resolve();
            });
        }));
        return Promise.all(jobs).then(() => {
            if (this.missing.length) console.warn('[assets] 缺失素材:', this.missing.join(', '));
        });
    }

    get(key: string): SpriteFrame | null {
        return this.map.get(key) ?? null;
    }

    /** 素材原始像素尺寸 */
    size(key: string): Size {
        const sf = this.get(key);
        if (!sf) return new Size(100, 100);
        const r = sf.rect;
        return new Size(r.width, r.height);
    }

    /** 按宽度创建图片节点（保持宽高比） */
    sprite(parent: Node, key: string, w: number, x = 0, y = 0): Node {
        const sf = this.get(key);
        const s = this.size(key);
        const h = w * (s.height / s.width);
        const n = new Node(`img_${key}`);
        parent.addChild(n);
        ui(n, w, h, x, y);
        const sp = n.addComponent(Sprite);
        if (sf) sp.spriteFrame = sf;
        return n;
    }
}

export const Img = new ImgRegistry();
