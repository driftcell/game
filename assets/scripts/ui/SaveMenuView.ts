import { Color, HorizontalTextAlignment, Node } from 'cc';
import { SaveManager } from '../core/SaveManager';
import { block, button, Col, label, labelInBox, layer, ui } from '../core/UITheme';
import type { PopupView } from './PopupView';

function fmtDate(t: number): string {
    const d = new Date(t);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 存档菜单：主菜单（继续游戏/新的故事）+ 槽位列表（读取/覆盖/删除）。
 * 层级必须低于 PopupView，删除确认弹窗才能浮在上面。
 */
export class SaveMenuView {
    root: Node;
    /** GameApp 构造后注入（popup 在本视图之后创建，保证弹窗在上层） */
    popup: PopupView | null = null;

    constructor(parent: Node) {
        this.root = layer(parent, 'savemenu');
        this.root.active = false;
    }

    /** 主菜单：继续游戏 / 新的故事 */
    mainMenu(): Promise<'continue' | 'new'> {
        this.root.active = true;
        this.root.removeAllChildren();
        block(this.root, 20000, 20000, new Color(30, 20, 30, 130));
        const H = 620;
        const card = block(this.root, 620, H, Col.white, 24);
        const header = block(card, 620, 92, Col.pink, 24, 0, H / 2 - 46);
        block(header, 620, 40, Col.pink, 0, 0, -26); // 补平方标题栏下半
        label(header, '和你一起长大30天', { size: 34, bold: true, color: Col.white });
        label(card, '要回到故事里了吗？', { size: 26, color: Col.gray }, 0, 130);
        return new Promise<'continue' | 'new'>((resolve) => {
            const done = (v: 'continue' | 'new') => {
                this.root.active = false;
                resolve(v);
            };
            button(card, '继续游戏', () => done('continue'), { w: 500, h: 96, y: -10 });
            button(card, '新的故事', () => done('new'), {
                w: 500, h: 88, y: -150,
                color: Col.white, textColor: Col.pinkDeep, stroke: Col.pink, size: 30,
            });
        });
    }

    /**
     * 槽位列表。load：点槽读取；overwrite：点槽覆盖（二次确认）。
     * 删除按钮随时可用（二次确认）。返回槽位号，取消返回 -1。
     */
    pickSlot(mode: 'load' | 'overwrite'): Promise<number> {
        this.root.active = true;
        return new Promise<number>((resolve) => {
            const done = (v: number) => {
                this.root.active = false;
                resolve(v);
            };
            const render = (): void => {
                this.root.removeAllChildren();
                block(this.root, 20000, 20000, new Color(30, 20, 30, 130));
                const saves = SaveManager.list();
                const rowH = 120;
                const gap = 18;
                const H = 92 + 30 + 3 * (rowH + gap) + 30 + 96 + 30;
                const card = block(this.root, 620, H, Col.white, 24);
                const header = block(card, 620, 92, Col.pink, 24, 0, H / 2 - 46);
                block(header, 620, 40, Col.pink, 0, 0, -26);
                label(header, mode === 'load' ? '选择存档' : '选择要覆盖的存档', { size: 32, bold: true, color: Col.white });

                let y = H / 2 - 92 - 30 - rowH / 2;
                saves.forEach((s, i) => {
                    const row = block(card, 540, rowH, s ? Col.white : new Color(247, 245, 247), 14, 0, y, Col.line);
                    if (s) {
                        labelInBox(row, s.label, 320, 48, { size: 28, bold: true, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT }, -75, 24);
                        labelInBox(row, fmtDate(s.savedAt), 320, 36, { size: 22, color: Col.gray, hAlign: HorizontalTextAlignment.LEFT }, -75, -24);
                        const del = button(row, '删 除', async () => {
                            if (!this.popup) return;
                            const c = await this.popup.pick({ title: '删除这个存档？', options: ['取消', '删除'] });
                            if (c.index === 1 && this.root.active) {
                                SaveManager.remove(i);
                                render();
                            }
                        }, { w: 110, h: 64, x: 200, y: 0, color: Col.white, textColor: Col.gray, stroke: Col.line, size: 24 });
                        // 阻止冒泡到行点击
                        del.on(Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; });
                        row.on(Node.EventType.TOUCH_END, () => {
                            if (mode === 'load') {
                                done(i);
                            } else {
                                void (async () => {
                                    if (!this.popup) return;
                                    const c = await this.popup.pick({ title: `覆盖「${s.label}」的存档？`, options: ['取消', '覆盖'] });
                                    if (c.index === 1 && this.root.active) done(i);
                                })();
                            }
                        });
                    } else {
                        label(row, '空存档位', { size: 26, color: Col.gray });
                        if (mode === 'overwrite') row.on(Node.EventType.TOUCH_END, () => done(i));
                    }
                    y -= rowH + gap;
                });

                button(card, '返 回', () => done(-1), {
                    w: 500, h: 88, y: -H / 2 + 78,
                    color: Col.white, textColor: Col.pinkDeep, stroke: Col.pink, size: 30,
                });
            };
            render();
        });
    }
}
