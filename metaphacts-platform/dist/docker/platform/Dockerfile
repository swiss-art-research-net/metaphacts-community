FROM docker.metaphacts.com/release/jetty-jre8-alpine:9.4.12
MAINTAINER metaphacts support@metaphacts.com

USER root

# enable jetty logging configuration module
RUN java -jar "$JETTY_HOME/start.jar" --add-to-start="logging-jetty"
COPY jetty-logging.properties /var/lib/jetty/resources/jetty-logging.properties

# install su-exec so we can switch in the entrypoint to jetty user packages
RUN apk --update add su-exec && rm -rf /var/cache/apk/*

COPY ROOT.war /var/lib/jetty/webapps/ROOT.war

COPY etc/ /var/lib/jetty/webapps/etc

COPY shiro-tools-hasher-1.3.2-cli.jar /firstStart/
COPY first-passwd-init.sh /firstStart/

COPY config/shiro.ini /runtime-data/config/shiro.ini

# Custom apps can be mounted under /apps folder
RUN mkdir /apps

RUN chown -R 100:101 /apps && chown -R 100:101 /runtime-data

VOLUME /runtime-data
VOLUME /apps

ENV RUNTIME_OPTS "-DruntimeDirectory=/runtime-data -Dcom.metaphacts.config.baselocation=/runtime-data/config -DappsDirectory=/apps -Dconfig.environment.shiroConfig=/runtime-data/config/shiro.ini -Dorg.eclipse.jetty.server.Request.maxFormContentSize=104857600"

COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
