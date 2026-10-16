import { Node, resources, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { block, Col, label, ui } from './UITheme';

/** 资源清单（key -> resources 路径）。换高清图时直接覆盖同名文件即可 */
const MANIFEST: Record<string, string> = {
    heart_open: 'img/splash/heart_open',
    title: 'img/splash/title',
    bg_sparkle: 'img/scene/bg_sparkle',
    bg_soft: 'img/scene/bg_soft',
    living_room: 'img/scene/living_room',
    mom: 'img/char/mom',
    dad: 'img/char/dad',
    xiaozhi: 'img/char/xiaozhi',
    crib_line: 'img/prop/crib_line',
    crib_fill: 'img/prop/crib_fill',
    calendar: 'img/ui/calendar',
    ribbon: 'img/ui/ribbon',
    phone: 'img/ui/phone',
    task_sleep: 'img/task/task_sleep',
    task_diaper: 'img/task/task_diaper',
    task_list: 'img/task/task_list',
    radio_off: 'img/ui/radio_off',
    radio_on: 'img/ui/radio_on',
    // 知识卡图标 + 收进手机按钮
    kc_separate: 'img/ui/kc_separate',
    kc_back: 'img/ui/kc_back',
    kc_flat: 'img/ui/kc_flat',
    kc_nopillow: 'img/ui/kc_nopillow',
    kc_nohat: 'img/ui/kc_nohat',
    btn_collect: 'img/ui/btn_collect',
    // 睡眠检查卡 + 观察卡 + 无角标手机（动态角标）
    check_green: 'img/ui/check_green',
    pin: 'img/ui/pin',
    xz_peek: 'img/ui/xz_peek',
    btn_great: 'img/ui/btn_great',
    phone_clean: 'img/ui/phone_clean',
    // 布置安全睡眠区
    bedroom: 'img/scene/bedroom',
    bedroom_night: 'img/scene/bedroom_night',
    crib: 'img/prop/crib',
    mattress: 'img/prop/mattress',
    pillow: 'img/prop/pillow',
    quilt: 'img/prop/quilt',
    crib_bumper: 'img/prop/crib_bumper',
    plush: 'img/prop/plush',
    sleep_bag: 'img/prop/sleep_bag',
    hat: 'img/prop/hat',
    socks: 'img/prop/socks',
    mobile: 'img/prop/mobile',
    basket: 'img/prop/basket',
    night_light: 'img/prop/night_light',
    // 布置尿布台（房间视图；纸尿裤/湿巾/润肤乳/隔尿垫/干净衣物为设计稿正式切图）
    bedroom_diaper: 'img/scene/bedroom_diaper',
    diaper: 'img/prop/diaper',
    wipes: 'img/prop/wipes',
    lotion: 'img/prop/lotion',
    pad: 'img/prop/pad',
    clothes: 'img/prop/clothes',
    // 设计稿未覆盖的道具（爽身粉/热水杯/护臀膏）：AI 生图（白底）+ 抠图归一化，见 skill art-gen
    powder: 'img/prop/powder',
    cup: 'img/prop/cup',
    cream: 'img/prop/cream',
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
        // 默认 TRIMMED 会在赋值 spriteFrame 时把尺寸改成原图像素，这里必须用 CUSTOM 保住传入的宽高
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sf) sp.spriteFrame = sf;
        return n;
    }

    /** 有图用图，无图用白底圆角块 + 首字占位（美术后补同名 png 即自动替换） */
    icon(parent: Node, key: string, name: string, size: number, x = 0, y = 0): Node {
        if (this.get(key)) return this.sprite(parent, key, size, x, y);
        const n = block(parent, size, size, Col.white, size * 0.22, x, y, Col.line);
        label(n, name.slice(0, 1), { size: Math.round(size * 0.42), bold: true, color: Col.pinkDeep });
        return n;
    }
}

export const Img = new ImgRegistry();
