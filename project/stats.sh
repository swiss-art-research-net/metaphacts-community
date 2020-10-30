#!/bin/bash

# this script prints current cpu usage in %% and memory usage in MBs every 5 secs for a period specified in SECONDS+X
# you can run with a build using ./stats.sh &
# NB: this could lock CI active for +X seconds

end=$((SECONDS+600))
while [ $SECONDS -lt $end ]; do
CPU=$(top -bn1 | grep "^CPU:" | awk '{printf "CPU2: %s\t\t\n", $2}')
MEMORY=$(free -m | awk 'NR==2{printf "MEM: %.0fMB\t", $3 }')
echo "$MEMORY$CPU"
sleep 5
done
