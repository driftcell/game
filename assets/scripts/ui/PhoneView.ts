import { Color, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, DH, DW, label, labelInBox, layer, ui } from '../core/UITheme';
import { GameState } from '../core/GameState';

/** 右侧边缘手机图标（动态成长记录角标）+ 章节任务卡滑出面板 */
export class PhoneView {
    root: Node;
    private iconN: Node;
    private badgeN: Node;
    private badgeL: ReturnType<typeof label>;
    private panel: Node | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'phone');
        this.iconN = Img.sprite(this.root, 'phone_clean', 64);
        const W = DW; const H = DH;
        // 右侧中上部空档区：避开对白/选项/任务卡（y<-227）与时间徽章/绶带（y>552）
        this.iconN.setPosition(W / 2 - 44, H / 2 - 400);
        // 动态角标（盖住原图擦掉角标的位置）
        this.badgeN = block(this.iconN, 30, 30, new Color(244, 74, 122), 15, 25, 37);
        this.badgeL = label(this.badgeN, '1', { size: 22, bold: true, color: Col.white }, 0, 0);
        this.setBadge(GameState.badge);
        // 呼吸提示
        this.breathe();
    }

    /** 成长记录角标：0 隐藏，>99 显示 99+ */
    setBadge(n: number): void {
        this.badgeN.active = n > 0;
        this.badgeL.string = n > 99 ? '99+' : String(n);
    }

    private breathe(): void {
        tween(this.iconN).to(1.2, { scale: new Vec3(1.05, 1.05, 1) }).to(1.2, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();
    }

    setVisible(v: boolean): void {
        this.iconN.active = v;
    }

    /** 手机图标位置（知识卡「收进手机」的飞入目标） */
    iconPos(): Vec3 {
        return this.iconN.position.clone();
    }

    /** 收进手机时的弹跳反馈（先停呼吸动画，结束后恢复） */
    bounce(): void {
        Tween.stopAllByTarget(this.iconN);
        tween(this.iconN)
            .to(0.15, { scale: new Vec3(1.25, 1.25, 1) })
            .to(0.15, { scale: new Vec3(1, 1, 1) })
            .call(() => this.breathe())
            .start();
    }

    /** 章节任务卡：从右侧滑入（占屏右 2/3） */
    chapterCard(title: string, subtitle: string): Promise<void> {
        const W = DW; const H = DH;
        const panelW = 520;
        const dim = block(this.root, 20000, 20000, new Color(30, 20, 30, 110));
        this.panel = new Node('panel');
        this.root.addChild(this.panel);
        ui(this.panel, panelW, 560, 0, 0);
        this.panel.setPosition(W / 2 + panelW, -H / 2 + 500);
        block(this.panel, panelW, 560, Col.white, 24);
        // 小智头部
        Img.sprite(this.panel, 'xiaozhi', 110, -panelW / 2 + 90, 560 / 2 - 90);
        // 头像右缘 -panelW/2+145，文字整体右移避免压住头像（label 为中心锚点）
        label(this.panel, '小智', { size: 30, bold: true, color: Col.ink }, -panelW / 2 + 250, 560 / 2 - 70);
        label(this.panel, '新的章节已解锁', { size: 22, color: Col.gray }, -panelW / 2 + 250, 560 / 2 - 108);
        // 任务卡
        const card = block(this.panel, panelW - 80, 240, Col.pinkSoft, 20, 0, -10, Col.pink);
        labelInBox(card, title, panelW - 140, 116, { size: 32, bold: true, color: Col.pinkDeep, lineHeight: 42 }, 0, 34);
        labelInBox(card, subtitle, panelW - 140, 40, { size: 26, color: Col.gray }, 0, -52);
        return new Promise<void>((resolve) => {
            button(this.panel, '接 受', () => {
                tween(this.panel!).to(0.3, { position: new Vec3(W / 2 + panelW, -H / 2 + 500, 0) }).call(() => {
                    if (this.panel) { this.panel.destroy(); this.panel = null; }
                    dim.destroy();
                    resolve();
                }).start();
            }, { w: panelW - 160, h: 92, y: -560 / 2 + 90 });
            tween(this.panel).to(0.35, { position: new Vec3(W / 2 - panelW / 2 - 30, -H / 2 + 500, 0) }).start();
        });
    }
}
