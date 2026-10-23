import {
    BlockInputEvents, Button, Color, EditBox, EventTouch, Graphics, HorizontalTextAlignment, Label, Mask,
    Node, Tween, tween, UITransform, Vec3, VerticalTextAlignment,
} from 'cc';
import { AiChatClient, AiChatError } from '../core/AiChat';
import { Img } from '../core/Assets';
import {
    block, Col, DH, DW, label, labelInBox, layer, opacity, paintBlock, ui,
} from '../core/UITheme';

const CARD_W = 700;
const CARD_H = 1480;
const HEADER_H = 112;
const LIST_W = 640;
const LIST_H = 1180;
const LIST_Y = 8;
const INPUT_Y = -660;

const BUBBLE_MAX_TEXT_W = 470;
const PAD_X = 22;
const PAD_Y = 16;
const BUBBLE_RADIUS = 22;
const AI_LEFT = -252;
const USER_RIGHT = 304;
const GAP = 18;

const ENTRY_X = -DW / 2 + 62;
const ENTRY_Y = DH / 2 - 400;

const WELCOME = '嗨，我是小智。孕产期的身体变化、情绪起伏、喂养和宝宝护理，都可以问我。';
const SUGGESTIONS = [
    '最近总是睡不好，正常吗？',
    '产后情绪低落怎么办？',
    '母乳喂养要注意什么？',
];

type Role = 'user' | 'assistant';

interface Bubble {
    node: Node;
    bg: Graphics;
    text: Label;
    avatar: Node | null;
    role: Role;
    textValue: string;
    w: number;
    h: number;
    x: number;
}

interface ListItem { node: Node; h: number; x: number; }

/** 去掉模型回答里的简单 Markdown 标记，Cocos Label 不渲染 Markdown */
function cleanText(s: string): string {
    return s
        .replace(/\r\n/g, '\n')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*]\s+/gm, '• ')
        .replace(/\n{3,}/g, '\n\n');
}

/**
 * AI 小智聊天窗口。
 *
 * 入口挂在 HUD 层（会被存档/弹窗/手机等上层自然遮住），聊天窗口挂在最顶层。
 * 消息区是 Mask + 手动拖拽滚动，输入用 EditBox，回复按 SSE 增量刷新。
 */
export class XiaozhiChatView {
    /** 最顶层聊天窗口（隐藏时 active=false） */
    root: Node;

    private entry: Node;
    private entryAllowed = false;
    private dim: Node;
    private card: Node;
    private listView: Node;
    private listContent: Node;
    private edit: EditBox;
    private sendN: Node;
    private sendL: Label;

    private client = new AiChatClient();
    private items: ListItem[] = [];
    private bubbles: Bubble[] = [];
    private suggestNode: Node | null = null;
    private retryNode: Node | null = null;
    private welcomeShown = false;

    private streaming = false;
    private abort: AbortController | null = null;
    private lastQuery = '';
    private gen = 0;
    private animToken = 0;

    private contentH = LIST_H;
    private stickToBottom = true;
    private scrollMoved = 0;

    constructor(entryParent: Node, modalParent: Node) {
        // 入口放在 HUD 层：标题/存档/弹窗/手机等上层会自然把它盖住
        this.entry = new Node('xiaozhi-entry');
        entryParent.addChild(this.entry);
        ui(this.entry, 116, 170, ENTRY_X, ENTRY_Y);
        this.buildEntry();
        this.entry.active = false;

        // 聊天窗口放在最顶层，必须最后创建
        this.root = layer(modalParent, 'xiaozhi-chat');
        this.root.active = false;
        this.buildModal();
    }

    /** 剧情开始后显示入口；聊天窗口打开时入口保持隐藏 */
    setEntryVisible(v: boolean): void {
        this.entryAllowed = v;
        this.entry.active = v && !this.root.active;
    }

    /* ---------------------------------- 入口 ---------------------------------- */

    private buildEntry(): void {
        // 透明命中区（覆盖头像 + AI 小智标签）
        const hit = block(this.entry, 116, 170, new Color(255, 255, 255, 0));
        const btn = hit.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.94;
        btn.target = this.entry;
        hit.on(Button.EventType.CLICK, () => this.open());

        // 呼吸光晕 + 白底圆 + 小智头像
        block(this.entry, 104, 104, new Color(214, 64, 118, 26), 52, 0, 28);
        block(this.entry, 96, 96, Col.white, 48, 0, 28, Col.pink, 3);
        const avatar = Img.sprite(this.entry, 'xiaozhi', 66, 0, 30);
        tween(avatar)
            .to(1.3, { scale: new Vec3(1.06, 1.06, 1) })
            .to(1.3, { scale: new Vec3(1, 1, 1) })
            .union()
            .repeatForever()
            .start();

        // 底部 AI 小智标签
        const tag = block(this.entry, 104, 32, Col.pink, 16, 0, -54);
        label(tag, 'AI 小智', { size: 19, bold: true, color: Col.white });
    }

    /* ---------------------------------- 窗口 ---------------------------------- */

    private buildModal(): void {
        this.dim = block(this.root, 20000, 20000, new Color(30, 20, 30, 150));
        // 盖住游戏层，避免点聊天背景时触发剧情/选项
        this.dim.addComponent(BlockInputEvents);
        this.dim.on(Node.EventType.TOUCH_END, () => { /* 吞掉点击 */ });

        this.card = new Node('card');
        this.root.addChild(this.card);
        ui(this.card, CARD_W, CARD_H);

        block(this.card, CARD_W, CARD_H, Col.white, 34, 0, 0, Col.line, 2);

        this.buildHeader();
        this.buildList();
        this.buildInput();
    }

    private buildHeader(): void {
        const header = block(this.card, CARD_W, HEADER_H, Col.pink, 34, 0, CARD_H / 2 - HEADER_H / 2);
        // 补平标题栏下半圆角
        block(header, CARD_W, 40, Col.pink, 0, 0, -HEADER_H / 2 + 20);

        // 小智头像
        block(header, 76, 76, Col.white, 38, -282, 0);
        Img.sprite(header, 'xiaozhi', 54, -282, 2);

        // 标题 / 副标题
        const title = label(header, '小智', { size: 34, bold: true, color: Col.white });
        title.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        title.node.setPosition(-228, 15);
        const sub = label(header, 'AI 孕产健康助手', { size: 20, color: new Color(255, 238, 244, 220) });
        sub.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
        sub.node.setPosition(-228, -18);

        // 新对话
        const newN = block(header, 118, 44, new Color(255, 255, 255, 46), 22, 150, 0);
        label(newN, '新对话', { size: 20, color: Col.white });
        newN.on(Node.EventType.TOUCH_END, () => this.resetConversation());

        // 关闭
        const closeN = block(header, 56, 56, new Color(255, 255, 255, 46), 28, 296, 0);
        const xN = new Node('x');
        closeN.addChild(xN);
        ui(xN, 28, 28);
        const xg = xN.addComponent(Graphics);
        xg.strokeColor = Col.white;
        xg.lineWidth = 4;
        xg.moveTo(-9, -9);
        xg.lineTo(9, 9);
        xg.moveTo(-9, 9);
        xg.lineTo(9, -9);
        xg.stroke();
        closeN.on(Node.EventType.TOUCH_END, () => this.close());
    }

    private buildList(): void {
        this.listView = new Node('list');
        this.card.addChild(this.listView);
        ui(this.listView, LIST_W, LIST_H, 0, LIST_Y);

        const mask = this.listView.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        const mg = this.listView.addComponent(Graphics);
        mg.fillColor = Col.white;
        mg.rect(-LIST_W / 2, -LIST_H / 2, LIST_W, LIST_H);
        mg.fill();

        this.listContent = new Node('content');
        this.listView.addChild(this.listContent);
        const ct = ui(this.listContent, LIST_W, LIST_H, 0, LIST_H / 2);
        ct.setAnchorPoint(0.5, 1);

        this.bindScroll();
    }

    private buildInput(): void {
        const bar = block(this.card, 640, 96, Col.pinkSoft, 30, 0, INPUT_Y, Col.line);

        // 圆角白底放在外层；EditBox 自带的 Sprite 背景留空，避免方角盖住描边
        const inputWrap = new Node('inputWrap');
        bar.addChild(inputWrap);
        ui(inputWrap, 480, 80, -50, 0);
        block(inputWrap, 480, 80, Col.white, 18, 0, 0, Col.line, 2);

        const inputBox = new Node('input');
        inputWrap.addChild(inputBox);
        ui(inputBox, 480, 80, 0, 0);

        const eb = inputBox.addComponent(EditBox);
        eb.backgroundImage = null;
        eb.placeholder = '问问小智…';
        eb.inputMode = EditBox.InputMode.SINGLE_LINE;
        eb.returnType = EditBox.KeyboardReturnType.SEND;
        eb.maxLength = 500;

        const tl = labelInBox(inputBox, '', 430, 80, {
            size: 28, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT,
        });
        const pl = labelInBox(inputBox, '问问小智…', 430, 80, {
            size: 28, color: Col.gray, hAlign: HorizontalTextAlignment.LEFT,
        });
        for (const l of [tl, pl]) {
            const t = l.node.getComponent(UITransform)!;
            t.setAnchorPoint(0, 1);
            t.setContentSize(430, 80);
            l.node.setPosition(-215, 40);
            l.verticalAlign = VerticalTextAlignment.CENTER;
        }
        eb.textLabel = tl;
        eb.placeholderLabel = pl;
        // EditBox 初始化自带的默认白字节点，替换引用后要销毁
        for (const nm of ['TEXT_LABEL', 'PLACEHOLDER_LABEL']) {
            const stale = inputBox.getChildByName(nm);
            if (stale && stale !== tl.node && stale !== pl.node) stale.destroy();
        }
        eb.node.on(EditBox.EventType.EDITING_RETURN, () => { void this.submit(); });
        // 聚焦时 Cocos 会隐藏自己的占位 Label，把占位文字补到 DOM input 上
        eb.node.on(EditBox.EventType.EDITING_DID_BEGAN, () => {
            setTimeout(() => this.fitInputDom(), 0);
        });
        this.edit = eb;

        // 发送 / 停止
        this.sendN = block(bar, 108, 72, Col.pink, 36, 252, 0);
        this.sendL = label(this.sendN, '发送', { size: 26, bold: true, color: Col.white });
        this.sendN.on(Node.EventType.TOUCH_END, () => {
            if (this.streaming) this.stop();
            else void this.submit();
        });

        label(this.card, '内容由 AI 生成，仅供参考', { size: 16, color: Col.gray }, 0, -727);
    }

    /* ---------------------------------- 消息列表 ---------------------------------- */

    private addBubble(role: Role, text: string): Bubble {
        const node = new Node('msg');
        this.listContent.addChild(node);
        ui(node, 10, 10);

        const bgN = new Node('bg');
        node.addChild(bgN);
        ui(bgN, 10, 10);
        const bg = bgN.addComponent(Graphics);

        const textL = label(node, '', {
            size: 28,
            color: role === 'user' ? Col.white : Col.ink,
            lineHeight: 40,
            hAlign: HorizontalTextAlignment.LEFT,
        });

        let avatar: Node | null = null;
        if (role === 'assistant') {
            avatar = new Node('avatar');
            node.addChild(avatar);
            ui(avatar, 48, 48);
            block(avatar, 48, 48, Col.white, 24, 0, 0, Col.line);
            Img.sprite(avatar, 'xiaozhi', 38, 0, 2);
        }

        const b: Bubble = { node, bg, text: textL, avatar, role, textValue: text, w: 0, h: 0, x: 0 };
        this.bubbles.push(b);
        this.items.push({ node, h: 72, x: 0 });
        this.paintBubble(b);
        this.relayout();
        return b;
    }

    private paintBubble(b: Bubble): void {
        const raw = b.role === 'assistant' ? cleanText(b.textValue) : b.textValue;
        const l = b.text;
        const t = l.node.getComponent(UITransform)!;
        const content = raw || ' ';

        l.string = content;
        l.horizontalAlign = HorizontalTextAlignment.LEFT;
        l.enableWrapText = false;
        l.overflow = Label.Overflow.NONE;
        t.setAnchorPoint(0, 1);
        t.setContentSize(0, 0);
        l.updateRenderData(true);

        let tw = t.width;
        if (tw > BUBBLE_MAX_TEXT_W) {
            l.enableWrapText = true;
            l.overflow = Label.Overflow.RESIZE_HEIGHT;
            t.setContentSize(BUBBLE_MAX_TEXT_W, 0);
            l.updateRenderData(true);
            tw = BUBBLE_MAX_TEXT_W;
        }

        const th = Math.max(t.height, l.lineHeight);
        const w = Math.max(80, Math.min(BUBBLE_MAX_TEXT_W, tw) + PAD_X * 2);
        const h = th + PAD_Y * 2;
        b.w = w;
        b.h = h;
        b.x = b.role === 'user' ? USER_RIGHT - w / 2 : AI_LEFT + w / 2;

        // 气泡高度是动态的，布局项必须同步，否则流式长回复会和上一条重叠
        const item = this.items.find((it) => it.node === b.node);
        if (item) {
            item.h = h;
            item.x = b.x;
        }

        const nt = b.node.getComponent(UITransform)!;
        nt.setContentSize(w, h);

        const g = b.bg;
        const bgT = g.node.getComponent(UITransform)!;
        bgT.setContentSize(w, h);
        g.clear();
        if (b.role === 'user') {
            g.fillColor = Col.pink;
            g.roundRect(-w / 2, -h / 2, w, h, BUBBLE_RADIUS);
            g.fill();
        } else {
            g.fillColor = new Color(247, 244, 246);
            g.strokeColor = Col.line;
            g.lineWidth = 2;
            g.roundRect(-w / 2, -h / 2, w, h, BUBBLE_RADIUS);
            g.fill();
            g.stroke();
        }

        l.node.setPosition(-w / 2 + PAD_X, h / 2 - PAD_Y);
        if (b.avatar) b.avatar.setPosition(-w / 2 - 30, h / 2 - 24);
    }

    private relayout(): void {
        let y = 16;
        for (const it of this.items) {
            y += it.h / 2;
            it.node.setPosition(it.x, -y, 0);
            y += it.h / 2 + GAP;
        }
        this.contentH = Math.max(LIST_H, y + 8);

        const t = this.listContent.getComponent(UITransform)!;
        t.setContentSize(LIST_W, this.contentH);
        t.setAnchorPoint(0.5, 1);

        const maxP = this.maxScroll();
        const p = this.listContent.position;
        const py = this.stickToBottom ? maxP : Math.min(maxP, Math.max(LIST_H / 2, p.y));
        this.listContent.setPosition(0, py, 0);
    }

    private maxScroll(): number {
        return Math.max(LIST_H / 2, this.contentH - LIST_H / 2);
    }

    private scrollToBottom(): void {
        this.stickToBottom = true;
        this.listContent.setPosition(0, this.maxScroll(), 0);
    }

    private bindScroll(): void {
        let dragging = false;
        let lastY = 0;
        this.listView.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            dragging = true;
            this.scrollMoved = 0;
            lastY = e.getUILocation().y;
        });
        this.listView.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!dragging) return;
            const yy = e.getUILocation().y;
            const dy = yy - lastY;
            lastY = yy;
            this.scrollMoved += Math.abs(dy);
            const maxP = this.maxScroll();
            const p = this.listContent.position;
            const ny = Math.min(maxP, Math.max(LIST_H / 2, p.y + dy));
            this.listContent.setPosition(0, ny, 0);
            this.stickToBottom = ny >= maxP - 24;
        });
        const end = (): void => { dragging = false; };
        this.listView.on(Node.EventType.TOUCH_END, end);
        this.listView.on(Node.EventType.TOUCH_CANCEL, end);
    }

    /* ---------------------------------- 欢迎语与建议 ---------------------------------- */

    private showWelcome(): void {
        if (this.welcomeShown) return;
        this.welcomeShown = true;
        this.addBubble('assistant', WELCOME);
        this.addSuggestions(SUGGESTIONS);
    }

    private addSuggestions(list: string[]): void {
        const totalH = list.length * 56 + (list.length - 1) * 12;
        const node = new Node('suggestions');
        this.listContent.addChild(node);
        ui(node, LIST_W, totalH);

        list.forEach((text, i) => {
            const probe = label(node, text, { size: 24, color: Col.pinkDeep });
            probe.updateRenderData(true);
            const tw = probe.node.getComponent(UITransform)!.width;
            probe.node.destroy();
            const w = Math.min(LIST_W - 40, Math.max(190, tw + 48));
            const y = totalH / 2 - 28 - i * 68;
            const x = -LIST_W / 2 + 20 + w / 2;
            const pill = block(node, w, 56, Col.pinkSoft, 28, x, y, Col.pink, 2);
            const l = label(pill, text, { size: 24, color: Col.pinkDeep });
            l.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
            l.node.setPosition(-w / 2 + 24, 0);
            pill.on(Node.EventType.TOUCH_END, () => {
                if (this.scrollMoved > 14) return;
                this.removeSuggestions();
                void this.submit(text);
            });
        });

        this.suggestNode = node;
        this.items.push({ node, h: totalH, x: 0 });
        this.relayout();
    }

    private removeSuggestions(): void {
        if (!this.suggestNode) return;
        const n = this.suggestNode;
        this.suggestNode = null;
        this.items = this.items.filter((it) => it.node !== n);
        n.destroy();
        this.relayout();
    }

    private addRetryChip(): void {
        this.removeRetry();
        const node = new Node('retry');
        this.listContent.addChild(node);
        ui(node, 140, 54);
        const pill = block(node, 140, 54, Col.white, 27, 0, 0, Col.pink, 2);
        label(pill, '重 试', { size: 24, bold: true, color: Col.pinkDeep });
        pill.on(Node.EventType.TOUCH_END, () => {
            if (this.scrollMoved > 14) return;
            this.retry();
        });
        this.retryNode = node;
        this.items.push({ node, h: 54, x: AI_LEFT + 70 });
        this.relayout();
    }

    private removeRetry(): void {
        if (!this.retryNode) return;
        const n = this.retryNode;
        this.retryNode = null;
        this.items = this.items.filter((it) => it.node !== n);
        n.destroy();
        this.relayout();
    }

    /* ---------------------------------- 发送 ---------------------------------- */

    private async submit(preset?: string, appendUser = true): Promise<void> {
        if (this.streaming) return;
        const q = (preset ?? this.edit.string).trim().slice(0, 500);
        if (!q) return;

        this.edit.string = '';
        this.removeSuggestions();
        this.removeRetry();
        this.lastQuery = q;
        this.stickToBottom = true;

        if (appendUser) this.addBubble('user', q);
        const ai = this.addBubble('assistant', '…');

        this.streaming = true;
        this.gen++;
        const gen = this.gen;
        const ctrl = new AbortController();
        this.abort = ctrl;
        this.updateSendButton();

        let got = false;
        let answer = '';
        try {
            const full = await this.client.send(q, (delta) => {
                if (gen !== this.gen) return;
                if (!got) {
                    got = true;
                    answer = '';
                    ai.textValue = '';
                }
                answer += delta;
                ai.textValue = answer;
                this.paintBubble(ai);
                this.relayout();
            }, ctrl.signal);

            if (gen !== this.gen) return;
            if (!full.trim()) throw new AiChatError(-2, '小智暂时没有回应，请稍后再试。');
            ai.textValue = full;
            this.paintBubble(ai);
            this.relayout();
        } catch (e) {
            if (gen !== this.gen) return;
            if (ctrl.signal.aborted) {
                ai.textValue = got && answer ? `${answer}\n\n（已停止）` : '（已停止）';
                this.paintBubble(ai);
                this.relayout();
            } else {
                const msg = this.errorText(e);
                ai.textValue = got && answer ? `${answer}\n\n${msg}` : msg;
                this.paintBubble(ai);
                this.relayout();
                if (this.canRetry(e)) this.addRetryChip();
            }
        } finally {
            if (gen === this.gen) {
                this.streaming = false;
                if (this.abort === ctrl) this.abort = null;
                this.updateSendButton();
            }
        }
    }

    private stop(): void {
        if (this.abort) this.abort.abort();
    }

    private retry(): void {
        if (this.streaming || !this.lastQuery) return;
        this.removeRetry();
        const last = this.bubbles[this.bubbles.length - 1];
        if (last && last.role === 'assistant') this.removeBubble(last);
        void this.submit(this.lastQuery, false);
    }

    private removeBubble(b: Bubble): void {
        const i = this.items.findIndex((it) => it.node === b.node);
        if (i >= 0) this.items.splice(i, 1);
        const j = this.bubbles.indexOf(b);
        if (j >= 0) this.bubbles.splice(j, 1);
        b.node.destroy();
        this.relayout();
    }

    private canRetry(e: unknown): boolean {
        if (e instanceof AiChatError) return e.code !== 6 && e.code !== 400;
        return true;
    }

    private errorText(e: unknown): string {
        if (e instanceof AiChatError) {
            if (e.code === 6) return '今日对话次数已用完，明天再来找小智吧。';
            if (e.code === -2) return '小智暂时没有回应，请稍后再试。';
            if (e.code === 400) return '这条消息没能发出去，换个说法再试试。';
            if (e.code === 413) return '消息太长啦，缩短一点再发。';
            if (e.code === 502) return '小智的服务暂时不可用，请稍后再试。';
            return e.message || '小智开小差了，请稍后再试。';
        }
        if (e instanceof TypeError) return '连接不上小智，请检查网络后再试。';
        return '小智开小差了，请稍后再试。';
    }

    private updateSendButton(): void {
        const g = this.sendN.getComponent(Graphics);
        if (g) paintBlock(g, 108, 72, this.streaming ? new Color(160, 148, 156) : Col.pink, 36);
        this.sendL.string = this.streaming ? '停止' : '发送';
    }

    /* ---------------------------------- 开关 ---------------------------------- */

    private open(): void {
        if (this.root.active) return;
        this.animToken++;
        this.entry.active = false;
        this.root.active = true;
        this.stickToBottom = true;

        const dimOp = opacity(this.dim);
        const cardOp = opacity(this.card);
        Tween.stopAllByTarget(dimOp);
        Tween.stopAllByTarget(cardOp);
        Tween.stopAllByTarget(this.card);
        dimOp.opacity = 0;
        cardOp.opacity = 0;
        this.card.setScale(new Vec3(0.94, 0.94, 1));
        tween(dimOp).to(0.2, { opacity: 255 }).start();
        tween(cardOp).to(0.2, { opacity: 255 }).start();
        tween(this.card).to(0.2, { scale: new Vec3(1, 1, 1) }).start();

        if (!this.welcomeShown) this.showWelcome();
        else this.relayout();
        this.scrollToBottom();

        // 在点击手势内聚焦，移动端才会弹出键盘
        try { this.edit.focus(); } catch (e) { /* ignore */ }
        setTimeout(() => { if (this.root.active) this.fitInputDom(); }, 60);
    }

    private close(): void {
        if (!this.root.active) return;
        this.stop();
        this.edit.blur();

        const token = ++this.animToken;
        const dimOp = opacity(this.dim);
        const cardOp = opacity(this.card);
        Tween.stopAllByTarget(dimOp);
        Tween.stopAllByTarget(cardOp);
        Tween.stopAllByTarget(this.card);
        tween(dimOp).to(0.18, { opacity: 0 }).start();
        tween(cardOp).to(0.18, { opacity: 0 }).start();
        tween(this.card).to(0.18, { scale: new Vec3(0.96, 0.96, 1) }).start();

        setTimeout(() => {
            if (token !== this.animToken) return;
            this.root.active = false;
            dimOp.opacity = 255;
            cardOp.opacity = 255;
            this.card.setScale(new Vec3(1, 1, 1));
            if (this.entryAllowed) this.entry.active = true;
        }, 190);
    }

    private resetConversation(): void {
        this.gen++;
        this.animToken++;
        if (this.abort) {
            this.abort.abort();
            this.abort = null;
        }
        this.streaming = false;
        this.client.reset();
        for (const it of this.items) it.node.destroy();
        this.items = [];
        this.bubbles = [];
        this.suggestNode = null;
        this.retryNode = null;
        this.welcomeShown = false;
        this.lastQuery = '';
        this.edit.string = '';
        this.stickToBottom = true;
        this.contentH = LIST_H;
        this.updateSendButton();
        this.showWelcome();
        this.scrollToBottom();
    }

    /** Cocos 单行 EditBox 的 DOM 输入框默认贴顶；聚焦时补上圆角框高度和占位文字 */
    private fitInputDom(): void {
        if (typeof document === 'undefined') return;
        const el = document.activeElement as (HTMLInputElement | HTMLTextAreaElement | null);
        if (!el || !el.classList || !el.classList.contains('cocosEditBox')) return;
        el.style.lineHeight = '80px';
        if (!el.placeholder) el.placeholder = '问问小智…';
    }
}
