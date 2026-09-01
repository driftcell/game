#!/usr/bin/env bash
# 在 macOS 上用 Cocos Creator 3.8.8 命令行构建 Web 版本，
# 产物输出到项目根目录下的 dist/（该目录会提交到 GitHub，由 CI 打包成 Docker 镜像）。
#
# 用法:
#   ./scripts/build-web.sh
#
# 可选环境变量:
#   COCOS_CREATOR  编辑器可执行文件路径（默认自动探测常见安装位置）
#   PLATFORM       构建平台（默认 web-mobile，可选 web-desktop）
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLATFORM="${PLATFORM:-web-mobile}"
OUTPUT_NAME="${OUTPUT_NAME:-dist}"

CREATOR="${COCOS_CREATOR:-}"
if [[ -z "$CREATOR" ]]; then
  for candidate in \
    /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator \
    /Applications/CocosCreator/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator; do
    if [[ -x "$candidate" ]]; then
      CREATOR="$candidate"
      break
    fi
  done
fi

if [[ -z "$CREATOR" || ! -x "$CREATOR" ]]; then
  echo "错误: 未找到 Cocos Creator 3.8.8，请用 COCOS_CREATOR 环境变量指定编辑器可执行文件路径" >&2
  exit 1
fi

echo "==> 使用编辑器: $CREATOR"
echo "==> 构建平台:   $PLATFORM"
echo "==> 输出目录:   $PROJECT_DIR/$OUTPUT_NAME"

"$CREATOR" \
  --project "$PROJECT_DIR" \
  --build "platform=$PLATFORM;buildPath=$PROJECT_DIR;outputName=$OUTPUT_NAME;md5Cache=true"

echo "==> 构建完成: $PROJECT_DIR/$OUTPUT_NAME"
echo "    提交 dist/ 到 GitHub 后，GitHub Actions 会自动打包并推送镜像到 ghcr.io"
