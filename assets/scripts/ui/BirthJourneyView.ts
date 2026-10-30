import { Button, Color, EventTouch, Graphics, HorizontalTextAlignment, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { Img } from '../core/Assets';
import { block, button, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui } from '../core/UITheme';

type JourneyStep = 'fetal' | 'night' | 'contractions' | 'bleeding' | 'triage' | 'entry' | 'road';

interface ContractionRecord {
    duration: number;
    interval: number | null;
}

const NIGHT_BG = new Color(28, 41, 73);
const ROAD_BG = NIGHT_BG;
const BLEEDING_COLORS = ['粉褐', '鲜红', '褐色'];
const BLEEDING_AMOUNTS = ['比护垫上一小片还少', '和月经量差不多', '更多'];

function formatGap(seconds: number | null): string {
    if (seconds === null) return '—';
    const safe = Math.max(0, Math.floor(seconds));
    return `${Math.floor(safe / 60)}分${safe % 60}秒`;
}

function currentTime(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * 第二章后段：胎动记录 → 夜晚铺垫 → 宫缩记录 → 见红 → 分诊 → 玄关 → 去医院。
 * 心理回应与生产偏好由现有 Script / PrefsView 负责，这里不重复实现。
 */
export class BirthJourneyView {
    root: Node;
    private content: Node;
    private resolve: (() => void) | null = null;
    private finishing = false;
    private epoch = 0;

    constructor(parent: Node) {
        this.root = layer(parent, 'birth-journey');

        // 空白处也命中最底层的热区，避免触摸落到下层游戏界面。
        const catcher = new Node('catcher');
        this.root.addChild(catcher);
        ui(catcher, 20000, 20000);
        const stop = (e: EventTouch): void => { e.propagationStopped = true; };
        catcher.on(Node.EventType.TOUCH_START, stop);
        catcher.on(Node.EventType.TOUCH_MOVE, stop);
        catcher.on(Node.EventType.TOUCH_END, stop);
        catcher.on(Node.EventType.TOUCH_CANCEL, stop);
        this.root.on(Node.EventType.TOUCH_START, stop);
        this.root.on(Node.EventType.TOUCH_MOVE, stop);
        this.root.on(Node.EventType.TOUCH_END, stop);
        this.root.on(Node.EventType.TOUCH_CANCEL, stop);

        this.content = new Node('content');
        this.root.addChild(this.content);
        ui(this.content, DW, DH);
        this.root.active = false;
    }

    /** 从胎动记录开始；全部步骤结束后淡出并 resolve。 */
    play(): Promise<void> {
        this.finishing = false;
        this.root.active = true;
        this.showStep('fetal');
        const op = opacity(this.root);
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).start();
        return new Promise<void>((r) => { this.resolve = r; });
    }

    /** 调试入口：fetal / night / contractions / bleeding / triage / entry / road。 */
    debugShow(step: string): void {
        const steps: JourneyStep[] = ['fetal', 'night', 'contractions', 'bleeding', 'triage', 'entry', 'road'];
        if (steps.indexOf(step as JourneyStep) < 0) return;
        this.finishing = false;
        this.root.active = true;
        const op = opacity(this.root);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        this.showStep(step as JourneyStep);
    }

    private showStep(step: JourneyStep): void {
        if (this.finishing) return;
        if (step === 'fetal') this.renderFetal();
        else if (step === 'night') this.renderNight();
        else if (step === 'contractions') this.renderContractions();
        else if (step === 'bleeding') this.renderBleedingIntro();
        else if (step === 'triage') this.renderTriage();
        else if (step === 'entry') this.renderEntry(false);
        else this.renderRoad();
    }

    /** 每一步连容器一起销毁，挂在 content 上的监听也不会留到后续步骤。 */
    private beginStep(): void {
        this.epoch++;
        const old = this.content;
        this.root.removeChild(old);
        old.destroy();
        this.content = new Node('content');
        this.root.addChild(this.content);
        ui(this.content, DW, DH);
    }

    /** 仅用于分诊接通的短延时；切步骤后旧回调自动失效。 */
    private after(ms: number, cb: () => void): void {
        const epoch = this.epoch;
        setTimeout(() => {
            if (epoch === this.epoch && !this.finishing) cb();
        }, ms);
    }

    /** 整张手机场景图等比铺到设计分辨率，不使用房间取景函数。 */
    private fullScene(parent: Node, key: string, fallback: Color = Col.night): Node {
        block(parent, 4000, 4000, fallback);
        const n = Img.sprite(parent, key, DW);
        n.getComponent(UITransform)!.setContentSize(DW, DH);
        n.setPosition(0, 0, 0);
        return n;
    }

    private bottomCard(parent: Node, height: number): Node {
        return block(parent, DW, height, new Color(255, 250, 252, 248), 30, 0, -DH / 2 + height / 2);
    }

    /** 阻止按钮的触摸继续冒泡到胎动计数等全屏热区。 */
    private stopTouch(n: Node): void {
        const stop = (e: EventTouch): void => { e.propagationStopped = true; };
        n.on(Node.EventType.TOUCH_START, stop);
        n.on(Node.EventType.TOUCH_MOVE, stop);
        n.on(Node.EventType.TOUCH_END, stop);
        n.on(Node.EventType.TOUCH_CANCEL, stop);
    }

    /* ---------------- 胎动记录 ---------------- */

    private renderFetal(): void {
        this.beginStep();
        const c = this.content;
        block(c, 4000, 4000, NIGHT_BG);
        const countLabel = label(c, '胎动：0', { size: 42, bold: true, color: Col.white }, 0, 690);
        const fetal = Img.sprite(c, 'fetal_outline', 330, 0, 150);
        opacity(fetal).opacity = 235;

        const stars: Node[] = [];
        for (let i = 0; i < 5; i++) {
            const star = Img.sprite(c, 'gold_star', 82, (i - 2) * 112, -190);
            opacity(star).opacity = 95;
            stars.push(star);
        }
        labelInBox(c, '感到一次胎动，就点一下屏幕。和你自己平时的感觉比，不和别人比。', 660, 150,
            { size: 28, color: new Color(238, 235, 248), lineHeight: 44 }, 0, -630);

        let count = 0;
        let complete: Node | null = null;
        c.on(Node.EventType.TOUCH_END, () => {
            if (this.finishing) return;
            count++;
            countLabel.string = `胎动：${count}`;
            stars.forEach((star, i) => { opacity(star).opacity = i < Math.min(count, 5) ? 255 : 95; });
            const star = stars[(count - 1) % stars.length];
            Tween.stopAllByTarget(star);
            star.setScale(1, 1, 1);
            tween(star)
                .to(0.12, { scale: new Vec3(1.2, 1.2, 1) })
                .to(0.16, { scale: new Vec3(1, 1, 1) })
                .start();

            if (count >= 3 && !complete) {
                complete = button(c, '完成记录', () => {
                    if (count >= 3) this.showStep('night');
                }, { w: 360, h: 88, y: -410 });
                this.stopTouch(complete);
            }
        });
    }

    /* ---------------- 夜晚铺垫 ---------------- */

    private renderNight(): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, 'birth_bedroom_night');
        const timeCard = Img.sprite(c, 'calendar', 290, 205, 680);
        labelInBox(timeCard, '孕39周+1天\n凌晨 1:02', 250, 94,
            { size: 26, bold: true, color: Col.pinkDeep, lineHeight: 40 }, 0, -4);

        const panel = this.bottomCard(c, 330);
        labelInBox(panel, '肚子有些发紧。先和伴侣一起记录几次，看看间隔。', 640, 116,
            { size: 28, color: Col.ink, lineHeight: 40 }, 0, 90);
        // 按钮底边为根坐标 -710，避开底部 100px 安全区。
        button(panel, '开始记录', () => this.showStep('contractions'), { w: 350, h: 88, y: -20 });
    }

    /* ---------------- 宫缩记录 ---------------- */

    private renderContractions(): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, 'living_night_couple');
        const panelH = 610;
        const panel = this.bottomCard(c, panelH);
        block(panel, DW, 88, Col.pink, 28, 0, panelH / 2 - 44);
        label(panel, '记录', { size: 34, bold: true, color: Col.white }, 0, panelH / 2 - 44);

        const list = new Node('records');
        panel.addChild(list);
        ui(list, 420, 300, 125, 35);
        const records: ContractionRecord[] = [];
        let complete: Node | null = null;
        let holding = false;
        let startedAt = 0;
        let previousStart: number | null = null;

        const renderRecords = (): void => {
            const oldRows = list.children.slice();
            list.removeAllChildren();
            oldRows.forEach((n) => n.destroy());
            if (!records.length) {
                labelInBox(list, '发紧时按住左侧圆钮，\n缓解后松开。', 390, 150,
                    { size: 24, color: Col.gray, lineHeight: 38 });
                return;
            }
            const visible = records.slice(Math.max(0, records.length - 3));
            visible.forEach((record, i) => {
                const row = block(list, 420, 82, Col.pinkSoft, 17, 0, 90 - i * 90);
                const text = `持续 ${record.duration}秒 / 间隔 ${formatGap(record.interval)}`;
                labelInBox(row, text, 396, 66, { size: 22, color: Col.ink, shrink: true });
            });
        };
        renderRecords();

        const hold = block(panel, 180, 180, Col.pink, 90, -240, -35);
        const holdG = hold.getComponent(Graphics)!;
        labelInBox(hold, '按住＝正在发紧', 150, 100, { size: 24, bold: true, color: Col.white, lineHeight: 36 });
        labelInBox(panel, '发紧时按住\n缓解后松开', 190, 76,
            { size: 22, color: Col.gray, lineHeight: 32 }, -240, -180);

        const paintHold = (): void => {
            paintBlock(holdG, 180, 180, holding ? Col.pinkDeep : Col.pink, 90);
        };
        hold.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
            if (holding || this.finishing) return;
            holding = true;
            startedAt = Date.now();
            paintHold();
        });
        hold.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { e.propagationStopped = true; });
        const endHold = (e: EventTouch): void => {
            e.propagationStopped = true;
            if (!holding || this.finishing) return;
            holding = false;
            paintHold();
            const elapsed = Math.max(0, Date.now() - startedAt);
            const duration = Math.max(1, Math.floor(elapsed / 1000));
            // 间隔按两次发紧的开始时间计算；系统时钟异常时也不出现负值。
            const interval = previousStart === null ? null : Math.max(0, Math.floor((startedAt - previousStart) / 1000));
            previousStart = startedAt;
            records.push({ duration, interval });
            renderRecords();
            if (records.length >= 3 && !complete) {
                complete = button(panel, '完成记录', () => {
                    if (records.length >= 3) this.showStep('bleeding');
                }, { w: 350, h: 88, x: 125, y: -160 });
                this.stopTouch(complete);
            }
        };
        hold.on(Node.EventType.TOUCH_END, endHold);
        hold.on(Node.EventType.TOUCH_CANCEL, endHold);
    }

    /* ---------------- 见红 ---------------- */

    private renderBleedingIntro(): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, 'bathroom', Col.pinkPale);
        const panel = this.bottomCard(c, 310);
        labelInBox(panel, '发现见红时，先记录时间、颜色和量。', 640, 88,
            { size: 28, color: Col.ink, lineHeight: 40 }, 0, 85);
        button(panel, '查看并记录', () => this.renderBleedingImage(), { w: 360, h: 88, y: -10 });
    }

    private renderBleedingImage(): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, 'bathroom', Col.pinkPale);
        block(c, DW, DH, new Color(30, 25, 40, 80));
        const card = block(c, 660, 800, new Color(255, 250, 252, 250), 32, 0, 20);
        label(card, '见红记录', { size: 40, bold: true, color: Col.pinkDeep }, 0, 310);
        Img.sprite(card, 'bleeding_tissue', 390, 0, 80);
        labelInBox(card, '先看清颜色和量，再记录下来。', 560, 70,
            { size: 25, color: Col.gray }, 0, -205);
        button(card, '记录见红', () => this.renderBleedingForm(), { w: 350, h: 88, y: -300 });
    }

    private renderBleedingForm(): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, 'bathroom', Col.pinkPale);
        const card = block(c, 700, 1300, new Color(255, 250, 252, 250), 32);
        block(card, 700, 88, Col.pink, 28, 0, 606);
        label(card, '见红记录', { size: 36, bold: true, color: Col.white }, 0, 606);
        labelInBox(card, '时间（自动填入）', 290, 54,
            { size: 27, bold: true, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT, shrink: true }, -155, 465);
        labelInBox(card, currentTime(), 220, 54,
            { size: 29, color: Col.ink, hAlign: HorizontalTextAlignment.RIGHT }, 190, 465);
        labelInBox(card, '颜色', 220, 54,
            { size: 28, bold: true, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT }, -190, 345);
        labelInBox(card, '量', 220, 54,
            { size: 28, bold: true, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT }, -190, -120);
        const hint = labelInBox(card, '', 600, 46, { size: 23, color: Col.pinkDeep }, 0, -525);

        let colorChoice = -1;
        let amountChoice = -1;
        const colorMarks: Graphics[] = [];
        const amountMarks: Graphics[] = [];
        BLEEDING_COLORS.forEach((text, i) => {
            this.radioRow(card, text, 240 - i * 110, colorMarks, () => {
                colorChoice = i;
                hint.string = '';
                colorMarks.forEach((g, j) => this.paintRadio(g, j === colorChoice));
            });
        });
        BLEEDING_AMOUNTS.forEach((text, i) => {
            this.radioRow(card, text, -225 - i * 115, amountMarks, () => {
                amountChoice = i;
                hint.string = '';
                amountMarks.forEach((g, j) => this.paintRadio(g, j === amountChoice));
            });
        });

        button(card, '保存记录', () => {
            if (colorChoice < 0 || amountChoice < 0) {
                hint.string = '请先选择颜色和量，再保存记录。';
                return;
            }
            this.showStep('triage');
        }, { w: 360, h: 88, y: -594 });
    }

    private radioRow(parent: Node, text: string, y: number, marks: Graphics[], choose: () => void): void {
        const row = block(parent, 620, 88, Col.white, 18, 0, y, Col.line);
        const mark = new Node('radio');
        row.addChild(mark);
        ui(mark, 46, 46, -266, 0);
        const g = mark.addComponent(Graphics);
        marks.push(g);
        this.paintRadio(g, false);
        labelInBox(row, text, 480, 66,
            { size: 25, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT, shrink: true }, 35, 0);
        row.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            e.propagationStopped = true;
            choose();
        });
    }

    private paintRadio(g: Graphics, selected: boolean): void {
        g.clear();
        g.fillColor = selected ? Col.pink : Col.white;
        g.circle(0, 0, 20);
        g.fill();
        g.lineWidth = 4;
        g.strokeColor = selected ? Col.pink : new Color(225, 157, 184);
        g.circle(0, 0, 20);
        g.stroke();
        if (selected) {
            g.fillColor = Col.white;
            g.circle(0, 0, 7);
            g.fill();
        }
    }

    /* ---------------- 产科分诊台 ---------------- */

    private renderTriage(): void {
        this.beginStep();
        const c = this.content;
        block(c, 4000, 4000, Col.pinkPale);
        Img.sprite(c, 'hospital_badge', 210, 0, 410);
        label(c, '产科分诊台', { size: 42, bold: true, color: Col.pinkDeep }, 0, 205);
        const status = label(c, '正在接通…', { size: 31, color: Col.ink }, 0, 85);
        Img.sprite(c, 'voice_wave', 360, 0, -85);

        let connected = false;
        const hangup = Img.sprite(c, 'hangup_button', 156, 0, -420);
        const hangupButton = hangup.addComponent(Button);
        hangupButton.transition = Button.Transition.SCALE;
        hangupButton.zoomScale = 0.94;
        hangupButton.target = hangup;
        hangupButton.interactable = false;
        const hint = label(c, '接通后可结束通话', { size: 27, color: Col.gray }, 0, -545);
        hangup.on(Button.EventType.CLICK, () => {
            if (connected) this.showStep('entry');
        });
        this.after(1200, () => {
            connected = true;
            status.string = '已接通，请说明你的情况';
            hangupButton.interactable = true;
            hint.string = '结束通话，准备出发';
            hint.color = Col.ink;
        });
    }

    /* ---------------- 玄关与夜路 ---------------- */

    private renderEntry(family: boolean): void {
        this.beginStep();
        const c = this.content;
        this.fullScene(c, family ? 'entry_family' : 'entry_bag');
        const panel = this.bottomCard(c, 300);
        labelInBox(panel, family ? '我们去医院。' : '待产包和证件都已带好。', 640, 72,
            { size: 28, bold: family, color: Col.ink, lineHeight: 40 }, 0, 90);
        button(panel, family ? '出发' : '准备出发', () => {
            if (family) this.showStep('road');
            else this.renderEntry(true);
        }, { w: 350, h: 88, y: 0 });
    }

    private renderRoad(): void {
        this.beginStep();
        const c = this.content;
        block(c, 4000, 4000, ROAD_BG);
        // 夜路切图只有 375x681：等宽、顶对齐，剩余底部保留深蓝，绝不纵向拉伸。
        const size = Img.size('hospital_road');
        const height = DW * (size.height / size.width);
        Img.sprite(c, 'hospital_road', DW, 0, DH / 2 - height / 2);
        label(c, '去医院路上', { size: 42, bold: true, color: Col.white }, 0, 700);
        labelInBox(c, '物品已经带好，情况也已经告诉医院。', 660, 48,
            { size: 26, color: new Color(235, 235, 248), lineHeight: 38 }, 0, -580);
        button(c, '完成第二章', () => this.finish(), { w: 400, h: 88, y: -660 });
    }

    private finish(): void {
        if (this.finishing) return;
        this.finishing = true;
        this.epoch++;
        const op = opacity(this.root);
        Tween.stopAllByTarget(op);
        tween(op).to(0.3, { opacity: 0 }).call(() => {
            this.root.active = false;
            const r = this.resolve;
            this.resolve = null;
            if (r) r();
        }).start();
    }
}
