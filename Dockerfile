# 运行阶段: 用 nginx 托管 Cocos Creator 的 Web 构建产物。
# dist/ 由 macOS 本机通过 scripts/build-web.sh 生成并提交到仓库，
# 这里只做静态托管，不在镜像内编译。
FROM nginx:1.27-alpine

# 构建产物（web-mobile / web-desktop 输出）
COPY dist/ /usr/share/nginx/html/

# nginx 站点配置（gzip、缓存策略、SPA 回退）
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# dist 未提交时快速失败，给出明确提示
RUN test -f /usr/share/nginx/html/index.html \
    || (echo "错误: dist/ 不存在或缺少 index.html，请先运行 scripts/build-web.sh 并提交 dist/" >&2; exit 1)

EXPOSE 80
