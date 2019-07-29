#!/bin/bash

BRANCH_NAME="$1"

if [[ "$BRANCH_NAME" =~ ^rs.* || "$BRANCH_NAME" == "researchspace" ]]; then
    echo "./researchspace/researchspace-root-build.json"
elif [[ "$BRANCH_NAME" =~ ^mosp.* ]]; then
    echo "./metaphactory/build-configs/platform-only-root-build.json"
else
    echo "./metaphactory/build-configs/metaphactory-root-build.json"
fi