import { Color, HorizontalTextAlignment, Node, tween, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, label, labelInBox, ui } from '../core/UITheme';

export interface SafetyRow {
    text: string;
    done: boolean;
}

export interface SafetyCardCfg {
    title: string;
    subtitle: string;
    rows: SafetyRow[];
    buttonLabel?: string;
    /** 卡片下方的小智提醒 */
    tip?: string;
}

/**
 * 放置类小游戏结束时的「安全检查」卡。
 * 只在玩家把当前家具布置完成后出现一次，不再中途反复弹出。
 */
export function showSafetyCard(parent: Node, cfg: SafetyCardCfg): Promise<void> {
    return new Promise<void>((resolve) => {
        const host = new Node('safety-card');
        parent.addChild(host);
        ui(host, 20000, 20000);

        const dim = block(host, 20000, 20000, new Color(30, 20, 30, 120));
        dim.on(Node.EventType.TOUCH_END, () => { /* 吞掉 */ });

        const W = 600;
        const H = 590;
        const cy = 300;
        const card = block(host, W, H, Col.white, 26, 0, cy, Col.line);
        card.setScale(new Vec3(0.9, 0.9, 1));
        tween(card).to(0.2, { scale: new Vec3(1, 1, 1) }).start();
        Img.sprite(card, 'xz_peek', 150, -W / 2 + 82, H / 2 + 22);
        Img.sprite(card, 'pin', 44, W / 2 - 28, H / 2 - 8);

        label(card, cfg.title, { size: 34, bold: true, color: Col.pinkDeep }, 0, H / 2 - 92);
        labelInBox(card, cfg.subtitle, 500, 54, { size: 24, color: Col.gray, lineHeight: 32 }, 0, H / 2 - 144);

        let y = H / 2 - 208;
        for (const row of cfg.rows) {
            if (row.done) {
                Img.sprite(card, 'check_green', 42, -W / 2 + 58, y);
            } else {
                block(card, 38, 38, new Color(228, 224, 228), 10, -W / 2 + 58, y);
            }
            labelInBox(card, row.text, 430, 68, {
                size: 26, color: row.done ? Col.ink : Col.gray,
                hAlign: HorizontalTextAlignment.LEFT, lineHeight: 34,
            }, -W / 2 + 310, y);
            y -= 76;
        }

        const close = (): void => {
            host.destroy();
            resolve();
        };
        button(card, cfg.buttonLabel ?? '完成检查', close, {
            w: 420, h: 90, y: -H / 2 + 78, size: 31,
        });

        if (cfg.tip) {
            const tip = block(host, 570, 80, Col.white, 18, 0, cy - H / 2 - 66);
            labelInBox(tip, cfg.tip, 534, 70, { size: 23, color: Col.pinkDeep, lineHeight: 30 });
        }
    });
}
