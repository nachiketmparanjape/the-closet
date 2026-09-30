#!/bin/bash
# Closet weekly deploy to Firebase Hosting.
# 1. Re-export the artifact first via artifact.export (slug: closet).
# 2. Then run this script from ~/workspace/wardrobe-app/hosting.
set -e
cd "$(dirname "$0")"
cp ~/workspace/your_files/closet/closet.html public/index.html
export FIREBASE_TOKEN
FIREBASE_TOKEN=$(cat ~/.config/firebase-ci-token)
~/workspace/tools/node_modules/.bin/firebase deploy --only hosting --project closet-404e9
