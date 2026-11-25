#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npm ci
npm run check
npm run pack:build
printf '\nBuild concluído. A pasta atual está pronta para ser copiada para Data/systems/op2-comunidade-fork.\n'
