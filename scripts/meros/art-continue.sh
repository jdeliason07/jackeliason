#!/usr/bin/env bash
# Resumes Meros art production from wherever it stopped, on this machine or a fresh one:
#   1. signs gcloud in with the service-account key in $GOOGLE_CLOUD_KEY_JSON (if not already),
#   2. restarts scripts/meros/generate-art.mts in the background unless it's running,
#   3. cuts out any new character/chest photos (scripts/meros/cutout.py; sets up .venv-art once),
#   4. renders Veo loops for any estate stage that has a still but no loop.
# Prints one status line. Safe to run as often as you like.
#
#   GCP_PROJECT=korvo-booking-511805 bash scripts/meros/art-continue.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
: "${GCP_PROJECT:?Set GCP_PROJECT}"
export GCP_PROJECT
unset CLOUDSDK_AUTH_ACCESS_TOKEN
LOG=${ART_LOG:-.cache/meros-art.log}
mkdir -p .cache

if ! gcloud auth print-access-token >/dev/null 2>&1; then
  KEY=$(mktemp)
  python3 -c 'import os,json; v=os.environ["GOOGLE_CLOUD_KEY_JSON"].strip().rstrip(","); d=json.loads(v if v.startswith("{") else "{"+v+"}"); print(json.dumps(d))' > "$KEY"
  gcloud auth activate-service-account --key-file="$KEY" >/dev/null 2>&1
  rm -f "$KEY"
  gcloud config set project "$GCP_PROJECT" >/dev/null 2>&1
fi

[ -d node_modules ] || npm ci --silent >/dev/null 2>&1

if ! pgrep -f "scripts/meros/generate-art.mts" >/dev/null; then
  ART_CONCURRENCY=${ART_CONCURRENCY:-4} nohup npx tsx scripts/meros/generate-art.mts >> "$LOG" 2>&1 &
  started="restarted generator"
else
  started="generator running"
fi

if [ ! -x .venv-art/bin/python ]; then
  python3 -m venv .venv-art >/dev/null 2>&1 && .venv-art/bin/pip install -q "rembg[cpu]" pillow >/dev/null 2>&1
fi
.venv-art/bin/python scripts/meros/cutout.py 2>/dev/null | tail -1

if ! pgrep -f "scripts/meros/generate-loops.mts" >/dev/null; then
  nohup npx tsx scripts/meros/generate-loops.mts >> .cache/meros-loops.log 2>&1 &
fi

chars=$(ls public/meros/art/char 2>/dev/null | wc -l)
loops=$(ls public/meros/art/estate/*.mp4 2>/dev/null | wc -l)
echo "$(date +%T) $started; characters $chars/432; estate loops $loops/7; last: $(tail -1 "$LOG" 2>/dev/null)"
