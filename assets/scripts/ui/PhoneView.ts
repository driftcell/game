import { Color, Node, tween, UIOpacity, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, DH, DW, label, labelInBox, layer, ui } from '../core/UITheme';

/** 右侧边缘手机图标 + 章节任务卡滑出面板 */
export class PhoneView {
    root: Node;
    private iconN: Node;
    private panel: Node | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'phone');
        this.iconN = Img.sprite(this.root, 'phone', 64);
        const W = DW; const H = DH;
        // 右侧中上部空档区：避开对白/选项/任务卡（y<-227）与时间徽章/绶带（y>552）
        this.iconN.setPosition(W / 2 - 44, H / 2 - 400);
        // 呼吸提示
        tween(this.iconN).to(1.2, { scale: new Vec3(1.05, 1.05, 1) }).to(1.2, { scale: new Vec3(1, 1, 1) }).union().repeatForever().start();
    }

    setVisible(v: boolean): void {
        this.iconN.active = v;
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
