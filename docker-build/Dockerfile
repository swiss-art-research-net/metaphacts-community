FROM openjdk:11 AS buildstage

RUN apt-get update -y
# install Node.js 14.x
#RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
# install yarn
RUN curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update && apt-get install yarn
# install SBT
RUN echo "deb https://dl.bintray.com/sbt/debian /" | tee -a /etc/apt/sources.list.d/sbt.list
RUN apt-key adv --keyserver hkps://keyserver.ubuntu.com:443 --recv 2EE0EA64E40A89B84B2DF73499E82A75642AC823
RUN apt-get update && apt-get install sbt

# copy metaphacts-platform
COPY . /metaphacts-platform
WORKDIR /metaphacts-platform
# use researchspace build.json
RUN cp ./researchspace/researchspace-root-build.json default-root-build.json
# build (creates /metaphacts-platform/target/platform-3.1.0.war)
RUN ./gradlew -DbuildEnv=prod platformWar

##
## run stage using Jetty
## (borrowed from metaphacts-platform/dist/docker/platform/Dockerfile)
##
FROM jetty:9-jre8-alpine AS runstage

USER root

# enable jetty logging configuration module
RUN java -jar "$JETTY_HOME/start.jar" --add-to-start="logging-jetty"
COPY metaphacts-platform/dist/docker/platform/jetty-logging.properties /var/lib/jetty/resources/jetty-logging.properties

# install su-exec so we can switch in the entrypoint to jetty user packages
RUN apk --update add su-exec && rm -rf /var/cache/apk/*

COPY --from=buildstage /metaphacts-platform/target/platform-3.6.0.war /var/lib/jetty/webapps/ROOT.war

COPY docker-build/etc/ /var/lib/jetty/webapps/etc/

COPY metaphacts-platform/dist/docker/platform/shiro-tools-hasher-1.3.2-cli.jar /firstStart/
COPY metaphacts-platform/dist/docker/platform/first-passwd-init.sh /firstStart/

RUN mkdir /runtime-data
COPY docker-build/config/ /runtime-data/config/

# Custom apps can be mounted under /apps folder
RUN mkdir /apps

RUN chown -R 100:101 /apps && chown -R 100:101 /runtime-data

VOLUME /runtime-data
VOLUME /apps

ENV RUNTIME_OPTS "-DruntimeDirectory=/runtime-data -Dcom.metaphacts.config.baselocation=/runtime-data/config -DappsDirectory=/apps -Dconfig.environment.shiroConfig=/runtime-data/config/shiro.ini -Dorg.eclipse.jetty.server.Request.maxFormContentSize=104857600"

COPY metaphacts-platform/dist/docker/platform/entrypoint.sh /
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
