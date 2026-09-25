#!/bin/bash
# 使い方: dev/shot.sh 出力名 "クエリ" [幅] [高さ] [待ちms]
# 例:     dev/shot.sh round "shot=round&month=3&shiki=kappa" 390 844 3000
# ヘッドレスEdgeで「幅×高さのiframeに入れた index.html?クエリ」を撮影して dev/shots/出力名.png に保存する
# （ヘッドレスは窓の最小幅が500px前後あるため、スマホ幅は iframe で再現する）
cd "$(dirname "$0")/.."
mkdir -p dev/shots
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
W=${3:-390}; H=${4:-844}; T=${5:-2500}
Q=$(printf '%s' "$2" | sed 's/&/%26/g; s/=/%3D/g; s/,/%2C/g')
WW=$(( W < 520 ? 520 : W ))
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --mute-audio \
  --window-size=$WW,$H --virtual-time-budget=$T \
  --screenshot="$(cygpath -w "$PWD/dev/shots/$1.png")" "http://localhost:8766/dev/phone.html?w=$W&h=$H&q=$Q" 2>/dev/null
echo "dev/shots/$1.png"
