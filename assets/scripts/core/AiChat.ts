import { sys } from 'cc';

/**
 * AI 小智对话客户端。
 *
 * 浏览器端调用同源 /api/xiaozhi（Worker 代理到 bozhiyunyu.cn/qwen），
 * 接口用 SSE 流式返回：data: {"answer":"..."}。
 *
 * 本地 Cocos 预览没有 Worker 时，可在控制台设置代理地址：
 *   localStorage.setItem('growup30.ai.endpoint', 'http://127.0.0.1:8787/api/xiaozhi')
 * 然后用 `wrangler dev` 启动代理。
 */

const UID_KEY = 'growup30.ai.uid.v1';
const ENDPOINT_KEY = 'growup30.ai.endpoint';
const DEFAULT_ENDPOINT = '/api/xiaozhi';
/** 发送给模型的历史条数上限（user/assistant 各算一条） */
const MAX_HISTORY = 12;

export class AiChatError extends Error {
    code: number;

    constructor(code: number, message: string) {
        super(message);
        this.name = 'AiChatError';
        this.code = code;
        // 兼容 ES5 目标下的 instanceof
        Object.setPrototypeOf(this, AiChatError.prototype);
    }
}

function uuid(): string {
    const c = (globalThis as unknown as {
        crypto?: { randomUUID?: () => string; getRandomValues?: (b: Uint8Array) => Uint8Array };
    }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const b = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
    else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readUid(): string {
    try {
        const old = sys.localStorage.getItem(UID_KEY);
        if (old) return old;
    } catch (e) { /* ignore */ }
    const id = uuid();
    try { sys.localStorage.setItem(UID_KEY, id); } catch (e) { /* ignore */ }
    return id;
}

function endpoint(): string {
    try {
        const custom = sys.localStorage.getItem(ENDPOINT_KEY);
        if (custom) return custom;
    } catch (e) { /* ignore */ }
    return DEFAULT_ENDPOINT;
}

interface SseEvent { event: string; data: string; }

function parseSse(raw: string): SseEvent {
    let event = '';
    const data: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
    }
    return { event, data: data.join('\n') };
}

function readError(payload: unknown, fallback: string): { code: number | null; message: string } {
    if (payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        const code = typeof p.code === 'number' ? p.code : null;
        if (typeof p.message === 'string' && p.message) return { code, message: p.message };
        if (typeof p.error === 'string' && p.error) return { code, message: p.error };
    }
    return { code: null, message: fallback };
}

export class AiChatClient {
    private uid = readUid();
    private cid = uuid();
    private history: string[] = [];

    /** 开始一段新对话：换 cid，清空上下文 */
    reset(): void {
        this.cid = uuid();
        this.history = [];
    }

    get turns(): number { return this.history.length / 2; }

    /**
     * 发送一条消息并消费 SSE。
     * onDelta 收到的是增量文本；成功时返回完整回答。
     */
    async send(query: string, onDelta: (delta: string) => void, signal?: AbortSignal): Promise<string> {
        const body = {
            uid: this.uid,
            cid: this.cid,
            status: 0,
            query,
            history_chat: this.history.slice(-MAX_HISTORY),
        };

        let res: Response;
        try {
            res = await fetch(endpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(body),
                signal,
            });
        } catch (e) {
            if (signal && signal.aborted) throw e;
            throw new AiChatError(-1, '连接不上小智，请检查网络后再试。');
        }

        if (!res.ok) {
            let payload: unknown = null;
            try { payload = await res.json(); } catch (e) { /* ignore */ }
            const info = readError(payload, `请求失败（${res.status}）`);
            throw new AiChatError(info.code ?? res.status, info.message);
        }

        if (!res.body) throw new AiChatError(-2, '小智暂时没有回应，请稍后再试。');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let answer = '';

        const handle = (raw: string): void => {
            const evt = parseSse(raw);
            if (evt.event === 'FatalError') {
                let code = -1;
                let message = evt.data || '小智服务出错，请稍后再试。';
                if (evt.data) {
                    let parsed: unknown;
                    try { parsed = JSON.parse(evt.data); } catch (e) { /* ignore */ }
                    if (typeof parsed === 'number') code = parsed;
                    else if (parsed && typeof parsed === 'object') {
                        const info = readError(parsed, message);
                        code = info.code ?? -1;
                        message = info.message;
                    } else if (typeof parsed === 'string' && parsed) {
                        if (/^\d+$/.test(parsed)) code = parseInt(parsed, 10);
                        else message = parsed;
                    } else if (/^\d+$/.test(evt.data)) {
                        code = parseInt(evt.data, 10);
                    }
                }
                throw new AiChatError(code, message);
            }
            if (!evt.data || evt.data === '[DONE]') return;
            let payload: unknown;
            try { payload = JSON.parse(evt.data); } catch (e) { return; }
            if (!payload || typeof payload !== 'object') return;
            const p = payload as Record<string, unknown>;
            if (typeof p.answer === 'string' && p.answer) {
                answer += p.answer;
                onDelta(p.answer);
            }
            if (p.error || (!p.answer && typeof p.code === 'number' && p.code !== 0)) {
                const info = readError(payload, '小智服务出错，请稍后再试。');
                throw new AiChatError(info.code ?? -1, info.message);
            }
        };

        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let match = /\r?\n\r?\n/.exec(buffer);
                while (match) {
                    const raw = buffer.slice(0, match.index);
                    buffer = buffer.slice(match.index + match[0].length);
                    if (raw.trim()) handle(raw);
                    match = /\r?\n\r?\n/.exec(buffer);
                }
            }
            buffer += decoder.decode();
            if (buffer.trim()) handle(buffer);
        } catch (e) {
            try { await reader.cancel(); } catch (err) { /* ignore */ }
            throw e;
        } finally {
            try { reader.releaseLock(); } catch (e) { /* ignore */ }
        }

        const text = answer.trim();
        if (!text) throw new AiChatError(-2, '小智暂时没有回应，请稍后再试。');

        this.history.push(query, text);
        if (this.history.length > MAX_HISTORY * 2) {
            this.history = this.history.slice(-MAX_HISTORY * 2);
        }
        return text;
    }
}
