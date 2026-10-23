/**
 * AI 小智同源代理。
 *
 * 上游 https://bozhiyunyu.cn/qwen 没有返回 CORS 头，浏览器不能从
 * game.<subdomain>.workers.dev 直接调用。这里只转发固定路径，避免成为
 * 任意 URL 的开放代理：
 *   POST /api/xiaozhi -> https://bozhiyunyu.cn/qwen
 *
 * 其余请求交给 Workers 静态资源（dist/）。
 */

const UPSTREAM = 'https://bozhiyunyu.cn/qwen';
const MAX_BODY_BYTES = 64 * 1024;

interface Env {
    ASSETS: { fetch(request: Request): Promise<Response> };
}

/** 仅本地 Cocos 预览需要跨域；生产环境同源，不需要 CORS 头 */
function localDevOrigin(origin: string | null): string | null {
    if (!origin) return null;
    try {
        const u = new URL(origin);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1' || u.hostname === '[::1]') return origin;
    } catch (e) { /* ignore */ }
    return null;
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
    });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (url.pathname !== '/api/xiaozhi') return env.ASSETS.fetch(request);

        const devOrigin = localDevOrigin(request.headers.get('Origin'));
        const cors: Record<string, string> = devOrigin ? {
            'Access-Control-Allow-Origin': devOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
        } : {};

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: { Allow: 'POST, OPTIONS', ...cors },
            });
        }

        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) {
            return json(413, { error: 'Request too large' }, cors);
        }

        let upstream: Response;
        try {
            upstream = await fetch(UPSTREAM, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body,
            });
        } catch (e) {
            return json(502, { error: 'Upstream unavailable' }, cors);
        }

        const headers = new Headers(cors);
        headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/event-stream');
        headers.set('Cache-Control', 'no-cache, no-store, no-transform');
        headers.set('X-Accel-Buffering', 'no');
        return new Response(upstream.body, { status: upstream.status, headers });
    },
};
