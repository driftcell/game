import { Button, Color, EventTouch, Graphics, HorizontalTextAlignment, Mask, Node, tween, UITransform, Vec3 } from 'cc';
import { GameState } from '../core/GameState';
import { Img } from '../core/Assets';
import { block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

interface Section {
    title: string;
    type: 'radio' | 'multi';
    options: string[];
}

interface InfoRow {
    label: string;
    value: string;
}

interface InfoSection {
    title: string;
    rows: InfoRow[];
}

/** 生产偏好分区（中文版分娩计划；支持者称呼走 {supporter} 变量替换）
 *  按分娩计划模板逐条整理，勾选即表示希望写进自己的计划 */
const SECTIONS: Section[] = [
    {
        title: '分娩偏好', type: 'multi', options: [
            '镇痛：硬膜外镇痛',
            '静脉通路：需要时建立，用于镇痛准备',
            '环境：柔和灯光、香薰和音乐',
            '活动：走动、分娩球、自由体位',
            '监测：接受定期检查，了解母婴状况',
            '胎心：优先间歇监测，必要时连续',
            '宫颈检查：尽量减少',
            '催产：非医学需要不催产',
            '饮食：可饮清流质、含冰块',
            '穿着：病号服或自己的衣物',
            '紧急决定：由{supporter}代为决定',
            '拍照：不安排专业摄影，由家人拍照',
        ],
    },
    {
        title: '用力偏好', type: 'multi', options: [
            '沟通：助产士指导，{supporter}在旁提醒',
            '体位：手拉绳索、侧卧或传统仰卧',
            '会阴：接受自然撕裂，不做侧切',
        ],
    },
    {
        title: '出生偏好', type: 'multi', options: [
            '脐带结扎：延迟 2 分钟或至停止搏动',
            '剪脐带：由{supporter}剪',
            '脐带血：不储存',
            '胎盘：等待自然娩出，必要时处理',
        ],
    },
    {
        title: '新生儿程序', type: 'multi', options: [
            '黄金一小时：肌肤接触 1 小时',
            '常规操作：同意维生素 K、眼膏',
            '乙肝疫苗：暂缓接种',
            '洗澡：出生 36–48 小时后再洗',
        ],
    },
    {
        title: '产后偏好', type: 'multi', options: [
            '肌肤接触：出生后立即开始',
            '母乳喂养：奶水来后尽早开始',
            '母婴同室：宝宝 24 小时同室',
            '探视：产后操作完成后再探视',
        ],
    },
];

/** 表单顶部的档案信息（不进勾选存储，按当前存档实时生成） */
function infoSections(): InfoSection[] {
    return [
        {
            title: '基本信息', rows: [
                { label: '姓名', value: GameState.momName },
                { label: '当前孕周', value: '孕39周+1天' },
                { label: '伴侣/支持者', value: GameState.supporterLabel() },
                { label: '宝宝姓名', value: GameState.babyName },
                { label: '产检医生', value: '待补充' },
                { label: '医保/保险', value: '待补充' },
            ],
        },
        {
            title: '健康信息', rows: [
                { label: '孕次', value: '第1胎' },
                { label: '计划分娩方式', value: '顺产（如无医学指征）' },
                { label: '血型', value: '待补充' },
                { label: '过敏史', value: '无已知过敏' },
                { label: '可能影响分娩的情况', value: '无特殊，待医生评估' },
            ],
        },
    ];
}

const CARD_W = 670;
const HEADER_H = 92;
const OPT_H = 74;
const INFO_HEADER_H = 68;
const INFO_ROW_H = 42;
const PAD_TOP = 600;       // 滚动可视区上边界（根坐标）
const PAD_BOTTOM = -580;   // 下边界（保存按钮以上）

/**
 * 第二章：我的生产偏好（中文版分娩计划）。
 * 顶部为基本信息 / 健康信息，下面是可折叠的分娩偏好清单（5 组）；
 * 「保存到待产包」收集勾选，再由「如果只能让他们记住一条…」星标页选出最重要的一条。
 */
export class PrefsView {
    root: Node;
    /** 已选：[分区索引][选项索引] = true */
    private sel: boolean[][] = [];
    private expanded: boolean[] = [];
    private formResolve: (() => void) | null = null;
    private starResolve: (() => void) | null = null;
    private scrollMoved = 0;
    private content: Node | null = null;
    private contentH = 0;
    private viewH = 0;

    constructor(parent: Node) {
        this.root = layer(parent, 'prefs');
        this.root.active = false;
    }

    private reset(): void {
        this.sel = SECTIONS.map((s) => s.options.map(() => false));
        // 读档重跑时恢复之前的选择
        const saved = GameState.prefs;
        if (saved && saved.length === SECTIONS.length) {
            this.sel = SECTIONS.map((s, i) => s.options.map((_, j) => !!(saved[i] && saved[i].indexOf(j) >= 0)));
        }
        this.expanded = SECTIONS.map((_, i) => i < 2);
    }

    private paintBg(): void {
        const bg = new Node('bg');
        this.root.addChild(bg);
        ui(bg, 20000, 20000, 0, 0);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(250, 228, 226);
        g.rect(-10000, -10000, 20000, 20000);
        g.fill();
    }

    private fadeIn(): void {
        this.root.active = true;
        this.root.removeAllChildren();
        const op = opacity(this.root);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).start();
    }

    private fadeOut(): Promise<void> {
        return new Promise<void>((r) => {
            const op = opacity(this.root);
            tween(op).to(0.25, { opacity: 0 }).call(() => {
                this.root.active = false;
                r();
            }).start();
        });
    }

    /** 生产偏好表单页；点「保存到待产包」→ 提示 → 自动收起 */
    playForm(): Promise<void> {
        this.reset();
        this.fadeIn();
        this.paintBg();

        // 标题
        label(this.root, '♥', { size: 40, color: new Color(244, 150, 178) }, -205, 690);
        label(this.root, '我的生产偏好', { size: 40, bold: true, color: Col.pink }, 0, 688);
        label(this.root, '♥', { size: 46, color: new Color(244, 150, 178) }, 205, 690);
        label(this.root, '✦', { size: 22, color: Col.gold }, -150, 712);
        label(this.root, '✦', { size: 20, color: Col.gold }, 158, 708);
        label(this.root, '分娩计划（如无医学指征，优先顺产）', { size: 22, color: Col.gray }, 0, 642);

        // 滚动区
        const regionH = PAD_TOP - PAD_BOTTOM;
        const regionCy = (PAD_TOP + PAD_BOTTOM) / 2;
        const view = new Node('view');
        this.root.addChild(view);
        ui(view, DW, regionH, 0, regionCy);
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const mg = view.addComponent(Graphics);
        mg.rect(-DW / 2, -regionH / 2, DW, regionH);
        mg.fill();
        const content = new Node('content');
        view.addChild(content);
        ui(content, DW, 100, 0, 0);
        this.content = content;
        this.viewH = regionH;

        const marks: Node[][] = SECTIONS.map((s) => s.options.map(() => null as unknown as Node));

        const build = (): void => {
            const prevY = this.contentH > 0 ? content.position.y : regionH / 2;
            content.removeAllChildren();
            let y = 0;   // content 局部：顶边起向下排

            // 顶部档案信息（基本信息 / 健康信息）
            infoSections().forEach((sec) => {
                const cardH = INFO_HEADER_H + sec.rows.length * INFO_ROW_H + 18;
                const card = block(content, CARD_W, cardH, Col.white, 26, 0, y - cardH / 2, Col.line);
                const head = block(card, CARD_W - 10, INFO_HEADER_H - 8, new Color(253, 232, 231), 22, 0, cardH / 2 - INFO_HEADER_H / 2);
                label(head, sec.title, { size: 30, bold: true, color: Col.pinkDeep });
                sec.rows.forEach((row, ri) => {
                    const ry = cardH / 2 - INFO_HEADER_H - 9 - INFO_ROW_H / 2 - ri * INFO_ROW_H;
                    const l = label(card, row.label, { size: 22, color: Col.gray });
                    l.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
                    l.node.setPosition(-CARD_W / 2 + 36, ry);
                    const v = label(card, row.value, { size: 22, color: Col.ink });
                    v.node.getComponent(UITransform)!.setAnchorPoint(1, 0.5);
                    v.node.setPosition(CARD_W / 2 - 36, ry);
                    if (ri < sec.rows.length - 1) {
                        const ln = new Node('rowline');
                        card.addChild(ln);
                        ui(ln, CARD_W - 90, 2, 0, ry - INFO_ROW_H / 2);
                        const lg = ln.addComponent(Graphics);
                        lg.fillColor = new Color(240, 226, 232);
                        lg.rect(-(CARD_W - 90) / 2, -1, CARD_W - 90, 2);
                        lg.fill();
                    }
                });
                y -= cardH + 20;
            });

            SECTIONS.forEach((sec, si) => {
                const open = this.expanded[si];
                const bodyH = open ? sec.options.length * OPT_H + 16 : 0;
                const cardH = HEADER_H + bodyH + (open ? 8 : 12);
                const card = block(content, CARD_W, cardH, new Color(255, 243, 238), 26, 0, y - cardH / 2);
                // 头部：标题（左对齐）+ 折叠箭头
                const tl = label(card, sec.title, { size: 32, bold: true, color: Col.ink });
                tl.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
                tl.node.setPosition(-CARD_W / 2 + 40, cardH / 2 - HEADER_H / 2);
                const chev = new Node('chev');
                card.addChild(chev);
                ui(chev, 40, 40, CARD_W / 2 - 52, cardH / 2 - HEADER_H / 2);
                const cg = chev.addComponent(Graphics);
                cg.fillColor = Col.ink;
                if (open) {
                    cg.moveTo(-14, 6); cg.lineTo(14, 6); cg.lineTo(0, -12);
                } else {
                    cg.moveTo(-8, 12); cg.lineTo(-8, -12); cg.lineTo(10, 0);
                }
                cg.close();
                cg.fill();
                card.on(Node.EventType.TOUCH_END, () => {
                    if (this.scrollMoved > 14) return;
                    this.expanded[si] = !this.expanded[si];
                    build();
                });
                // 选项
                if (open) {
                    sec.options.forEach((optText, oi) => {
                        const oy = cardH / 2 - HEADER_H - 8 - OPT_H / 2 - oi * OPT_H;
                        const row = new Node('opt');
                        card.addChild(row);
                        ui(row, CARD_W - 24, OPT_H, 0, oy);
                        const mark = new Node('mark');
                        row.addChild(mark);
                        ui(mark, 46, 46, -CARD_W / 2 + 62, 0);
                        marks[si][oi] = mark;
                        this.paintMark(mark.addComponent(Graphics), sec.type, this.sel[si][oi]);
                        const tl2 = label(row, GameState.subst(optText), { size: 28, color: Col.ink });
                        tl2.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
                        tl2.node.setPosition(-CARD_W / 2 + 100, 0);
                        row.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
                            e.propagationStopped = true;
                            if (this.scrollMoved > 14) return;
                            if (sec.type === 'radio') {
                                const was = this.sel[si][oi];
                                this.sel[si] = this.sel[si].map(() => false);
                                this.sel[si][oi] = !was;
                                // 重绘该分区全部标记
                                sec.options.forEach((_, j) => {
                                    const m = marks[si][j];
                                    if (m && m.isValid) this.paintMark(m.getComponent(Graphics)!, 'radio', this.sel[si][j]);
                                });
                            } else {
                                this.sel[si][oi] = !this.sel[si][oi];
                                this.paintMark(mark.getComponent(Graphics)!, 'multi', this.sel[si][oi]);
                            }
                        });
                        // 选项间虚线分隔
                        if (oi < sec.options.length - 1) {
                            const dash = new Node('dash');
                            card.addChild(dash);
                            ui(dash, CARD_W - 110, 4, 12, oy - OPT_H / 2);
                            const dg = dash.addComponent(Graphics);
                            dg.strokeColor = new Color(232, 220, 226);
                            dg.lineWidth = 2;
                            for (let dx = -(CARD_W - 110) / 2; dx < (CARD_W - 110) / 2; dx += 16) {
                                dg.moveTo(dx, 0);
                                dg.lineTo(dx + 8, 0);
                            }
                            dg.stroke();
                        }
                    });
                }
                y -= cardH + 20;
            });
            this.contentH = -y + 20;
            const t = content.getComponent(UITransform)!;
            t.setContentSize(DW, this.contentH);
            t.setAnchorPoint(0.5, 1);
            // 展开/收起后保持当前滚动位置，避免长表单跳回顶部
            const maxUp = Math.max(0, this.contentH - this.viewH);
            content.setPosition(0, Math.max(regionH / 2, Math.min(regionH / 2 + maxUp, prevY)), 0);
        };
        build();

        // 拖动滚动（14px 死区，滚动中不触发点击）
        let dragging = false;
        let lastY = 0;
        view.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            dragging = true;
            this.scrollMoved = 0;
            lastY = e.getUILocation().y;
        });
        view.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!dragging) return;
            const yy = e.getUILocation().y;
            const dy = yy - lastY;
            lastY = yy;
            this.scrollMoved += Math.abs(dy);
            this.scrollBy(dy);
        });
        view.on(Node.EventType.TOUCH_END, () => { dragging = false; });
        view.on(Node.EventType.TOUCH_CANCEL, () => { dragging = false; });

        // 保存按钮
        const btn = block(this.root, 330, 84, Col.pink, 42, 152, -700);
        const bb = btn.addComponent(Button);
        bb.transition = Button.Transition.SCALE;
        bb.zoomScale = 0.95;
        bb.target = btn;
        Img.sprite(btn, 'ico_save', 30, -130, 0);
        label(btn, '保存到待产包', { size: 28, bold: true, color: Col.white }, 18, 0);
        btn.on(Button.EventType.CLICK, () => {
            GameState.prefs = this.sel.map((row) => row.map((v, i) => (v ? i : -1)).filter((i) => i >= 0));
            GameState.save();
            const n = GameState.prefs.reduce((a, b) => a + b.length, 0);
            this.caption(`📄 生产偏好文档已收进待产包。（已勾选 ${n || '—'} 项，稍后选出最想让医护记住的一条）`);
            setTimeout(() => {
                void this.fadeOut().then(() => {
                    const r = this.formResolve;
                    this.formResolve = null;
                    if (r) r();
                });
            }, 1900);
        });

        return new Promise<void>((r) => { this.formResolve = r; });
    }

    private scrollBy(dy: number): void {
        if (!this.content) return;
        const p = this.content.position;
        const maxUp = Math.max(0, this.contentH - this.viewH);
        // content 顶边从视口顶部（viewH/2）向上下均可夹取：上滑内容上移露出下方
        let ny = p.y + dy;
        ny = Math.min(this.viewH / 2 + maxUp, Math.max(this.viewH / 2, ny));
        this.content.setPosition(p.x, ny, p.z);
    }

    private paintMark(g: Graphics, type: 'radio' | 'multi', on: boolean): void {
        g.clear();
        if (type === 'radio') {
            if (on) {
                g.fillColor = Col.pink;
                g.circle(0, 0, 21);
                g.fill();
                g.lineWidth = 5;
                g.strokeColor = Col.white;
                g.moveTo(-9, 0); g.lineTo(-3, -8); g.lineTo(10, 8);
                g.stroke();
            } else {
                g.fillColor = Col.white;
                g.circle(0, 0, 19);
                g.fill();
                g.lineWidth = 5;
                g.strokeColor = new Color(243, 160, 188);
                g.circle(0, 0, 19);
                g.stroke();
            }
        } else if (on) {
            g.fillColor = Col.pink;
            g.roundRect(-19, -19, 38, 38, 11);
            g.fill();
            g.lineWidth = 5;
            g.strokeColor = Col.white;
            g.moveTo(-9, 0); g.lineTo(-3, -8); g.lineTo(10, 8);
            g.stroke();
        } else {
            g.fillColor = Col.white;
            g.roundRect(-19, -19, 38, 38, 11);
            g.fill();
            g.lineWidth = 5;
            g.strokeColor = new Color(243, 160, 188);
            g.roundRect(-19, -19, 38, 38, 11);
            g.stroke();
        }
    }

    /** 底部小提示条（保存成功的说明） */
    private caption(msg: string, holdMs = 1800): void {
        const n = block(this.root, 660, 96, new Color(60, 52, 58, 235), 22, 0, -580);
        labelInBox(n, msg, 620, 84, { size: 22, color: Col.white, lineHeight: 30 });
        const op = opacity(n);
        op.opacity = 0;
        tween(op).to(0.2, { opacity: 255 }).start();
        setTimeout(() => {
            tween(op).to(0.3, { opacity: 0 }).call(() => n.destroy()).start();
        }, holdMs);
    }

    /** 星标页：在已勾选项里选一条最重要的；点选 → 金色星标 → 自动收起 */
    playStar(): Promise<void> {
        this.fadeIn();
        this.paintBg();

        label(this.root, '如果只能让他们记住一条…', { size: 38, bold: true, color: Col.pink }, 0, 600);
        label(this.root, '点选一条，它会变成金色星标', { size: 26, color: Col.gray }, 0, 538);

        // 候选 = 已勾选的偏好；没有勾选时用全部选项
        const picks: string[] = [];
        GameState.prefs.forEach((secPicks, si) => {
            secPicks.forEach((oi) => {
                if (SECTIONS[si] && SECTIONS[si].options[oi] !== undefined) picks.push(GameState.subst(SECTIONS[si].options[oi]));
            });
        });
        const list = picks.length ? picks : SECTIONS.flatMap((s) => s.options.map((o) => GameState.subst(o)));

        const regionTop = 460;
        const regionBottom = -680;
        const regionH = regionTop - regionBottom;
        const view = new Node('view');
        this.root.addChild(view);
        ui(view, DW, regionH, 0, (regionTop + regionBottom) / 2);
        const mask = view.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const mg = view.addComponent(Graphics);
        mg.rect(-DW / 2, -regionH / 2, DW, regionH);
        mg.fill();
        const content = new Node('content');
        view.addChild(content);
        ui(content, DW, 100, 0, 0);

        let y = 0;
        const rows: { text: string; y: number }[] = [];
        list.forEach((text) => {
            rows.push({ text, y });
            const card = block(content, 630, 86, Col.white, 20, 0, y - 43, Col.line);
            const tl = label(card, text, { size: 26, color: Col.ink });
            tl.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
            tl.node.setPosition(-287, 0);
            y -= 104;
        });
        const contentH = Math.max(regionH, -y + 20);
        const ct = content.getComponent(UITransform)!;
        ct.setContentSize(DW, contentH);
        ct.setAnchorPoint(0.5, 1);
        content.setPosition(0, regionH / 2, 0);

        // 点选：变金色星标
        content.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (this.scrollMoved > 14) return;
            const p = e.getUILocation();
            const local = content.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
            const idx = rows.findIndex((r) => local.y <= r.y && local.y >= r.y - 86);
            if (idx < 0) return;
            GameState.starPick = rows[idx].text;
            GameState.save();
            const card = content.children[idx];
            const star = label(card, '⭐', { size: 40, color: Col.gold }, 250, 0);
            star.node.setScale(0.4, 0.4, 1);
            tween(star.node).to(0.25, { scale: new Vec3(1.15, 1.15, 1) }).to(0.15, { scale: new Vec3(1, 1, 1) }).start();
            const g = card.getComponent(Graphics);
            if (g) paintBlock(g, 630, 86, new Color(255, 250, 240), 20, Col.gold, 4);
            setTimeout(() => {
                void this.fadeOut().then(() => {
                    const r2 = this.starResolve;
                    this.starResolve = null;
                    if (r2) r2();
                });
            }, 1000);
        });

        // 滚动
        let dragging = false;
        let lastY = 0;
        view.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            dragging = true;
            this.scrollMoved = 0;
            lastY = e.getUILocation().y;
        });
        view.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!dragging) return;
            const yy = e.getUILocation().y;
            const dy = yy - lastY;
            lastY = yy;
            this.scrollMoved += Math.abs(dy);
            const maxUp = Math.max(0, contentH - regionH);
            const p = content.position;
            const ny = Math.min(regionH / 2 + maxUp, Math.max(regionH / 2, p.y + dy));
            content.setPosition(p.x, ny, p.z);
        });
        view.on(Node.EventType.TOUCH_END, () => { dragging = false; });
        view.on(Node.EventType.TOUCH_CANCEL, () => { dragging = false; });

        return new Promise<void>((r) => { this.starResolve = r; });
    }
}
