#!/bin/sh

set -e

# create admin password at first login
sh /firstStart/first-passwd-init.sh

chown -R 100:101 /apps
chown -R 100:101 /runtime-data

exec su-exec jetty java -XX:+UnlockExperimentalVMOptions -XX:+UseCGroupMemoryLimitForHeap $JAVA_OPTS -jar -Djava.io.tmpdir=$TMPDIR $JETTY_HOME/start.jar /usr/local/jetty/etc/jetty.xml /usr/local/jetty/etc/jetty-http-forwarded.xml $RUNTIME_OPTS $PLATFORM_OPTS
