#!/bin/bash

BRANCH_NAME="$1"

# branch names have all / changed to - already

if [[ "$BRANCH_NAME" =~ mp-.+$ ]]; then
    echo "./metaphacts-platform/platform-only-root-build.json"
else
    echo "./metaphactory/build-configs/metaphactory-root-build.json"
fi
