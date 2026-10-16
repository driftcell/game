#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抠底 + 归一化：把 AI 生图（白底/纯色底道具图）处理成项目道具图规范。

用法:
    python3 key_and_pack.py INPUT.png OUTPUT.png [--tol 22] [--core 55] [--cleanup 70] [--maxdim 88]

流程:
  1. 从四边泛洪（容差 tol）去掉背景；
  2. 用高置信前景像素（与背景距离 > core）算内容 bbox，清掉框外低对比残影（阴影/光晕）；
  3. 内容缩放至最大边 maxdim，居中放入 100x100 透明画布。

提示:
  - 生图请用「纯白色背景 + 无阴影 + 清晰描边」的提示词（粉底生图会漏色出破洞）。
  - 处理完必须放大 3 倍目检：破洞调小 tol，脏边调大 tol。
"""
import argparse
from collections import deque

from PIL import Image


def key_out_bg(im: Image.Image, tol: int, core_dist: int, cleanup_dist: int) -> Image.Image:
    im = im.convert('RGBA')
    W, H = im.size
    px = im.load()

    samples = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, H - 1]]
    br, bg, bb = sorted(samples, key=lambda c: samples.count(c))[-1][:3]

    def dist(c):
        return abs(c[0] - br) + abs(c[1] - bg) + abs(c[2] - bb)

    # 1. flood fill sure background from borders
    seen = [[False] * W for _ in range(H)]
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not seen[y][x] and dist(px[x, y]) < tol:
                seen[y][x] = True
                q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if not seen[y][x] and dist(px[x, y]) < tol:
                seen[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and dist(px[nx, ny]) < tol:
                seen[ny][nx] = True
                q.append((nx, ny))

    # 2. core bbox from confident object pixels
    minx, miny, maxx, maxy = W, H, 0, 0
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and dist(px[x, y]) > core_dist:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    minx -= 6; miny -= 6; maxx += 6; maxy += 6

    # 3. remove low-contrast residues (shadow / halo) outside the core bbox
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] == 0:
                continue
            if (x < minx or x > maxx or y < miny or y > maxy) and dist(c) < cleanup_dist:
                px[x, y] = (0, 0, 0, 0)
    return im


def normalize(im: Image.Image, maxdim: int, canvas_size: int = 100) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise SystemExit('内容为空：抠底把整个图都吃掉了，检查 tol / 背景色')
    obj = im.crop(bbox)
    w, h = obj.size
    s = maxdim / max(w, h)
    obj = obj.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(obj, ((canvas_size - obj.width) // 2, (canvas_size - obj.height) // 2), obj)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--tol', type=int, default=22, help='背景泛洪容差（破洞调小，脏边调大）')
    ap.add_argument('--core', type=int, default=55, help='高置信前景阈值')
    ap.add_argument('--cleanup', type=int, default=70, help='框外残影清除阈值')
    ap.add_argument('--maxdim', type=int, default=88, help='内容最大边（项目规范 88）')
    args = ap.parse_args()

    im = Image.open(args.input)
    out = normalize(key_out_bg(im, args.tol, args.core, args.cleanup), args.maxdim)
    out.save(args.output)
    print('saved', args.output, 'content bbox:', out.getbbox())


if __name__ == '__main__':
    main()
