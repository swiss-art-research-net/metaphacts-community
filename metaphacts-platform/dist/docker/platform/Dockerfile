ARG  JETTY_VERSION=9.4.35-jre11
FROM jetty:${JETTY_VERSION}
MAINTAINER metaphacts support@metaphacts.com

LABEL maintainer="metaphacts support@metaphacts.com"

USER root

# install additional packages
# Alpine installation:
#RUN apk --update add vim && rm -rf /var/cache/apk/*
# Debian installation:
RUN apt-get update && apt-get install -y --no-install-recommends vim \
      && rm -rf /var/lib/apt/lists/* \
      && rm -rf /var/cache/apt/archives/*

# when on Debian, change uid of user jetty to 100 and gid of group jetty to 101
# note that we delete temporary user _apt which has uid 100 to avoid conflicts
RUN echo "fixing user and group id for Jetty" \
	&& userdel -f _apt \
	&& usermod -u 100 jetty \
	&& groupmod -g 101 jetty

# add user jetty to group root which is used for most of the permissions
# user jetty has uid 100
# group root has gid 0
RUN addgroup jetty root

# make group 'root' (no special permissions!) owning group of the various jetty base, home, and temp folders
# to allow the container to be run by non-root and non-jetty users as well (this is required e.g. for OpenShift)
# also set same permissions as for owner
RUN echo "fixing group ownership for Jetty base, home, and temp folders" \
	&& umask 0002 \
	&& chown -R 100:0 "$TMPDIR" \
	&& chmod -R g=u "$TMPDIR" \
	&& chmod -R g+s "$TMPDIR" \
	&& chown -R 100:0 "$JETTY_BASE" \
	&& chmod -R g=u "$JETTY_BASE" \
	&& chmod -R g+s "$JETTY_BASE" \
	&& chown -R 100:0 "$JETTY_HOME"\
	&& chmod -R g=u "$JETTY_HOME" \
	&& chmod -R g+s "$JETTY_HOME"


COPY --chown=100:0 entrypoint.sh /
RUN chmod a+x /entrypoint.sh


# Custom apps can be mounted under /apps folder
RUN echo "setting up platform, apps, and runtime folders" \
	&& umask 0002 \
	&& mkdir /firstStart \
	&& chown -R 100:0 "/firstStart" \
	&& chmod -R g=u "/firstStart" \
	&& chmod -R g+ws "/firstStart" \
	&& mkdir /apps \
	&& chown -R 100:0 "/apps" \
	&& chmod -R g=u "/apps" \
	&& chmod -R g+ws "/apps" \
	&& mkdir /bundled \
	&& chown -R 100:0 "/bundled" \
	&& chmod -R g=u "/bundled" \
	&& chmod -R g+ws "/bundled" \
	&& mkdir /runtime-data \
	&& mkdir -p /runtime-data/config/repositories \
	&& mkdir -p /runtime-data/data/repositories \
	&& chown -R 100:0 "/runtime-data" \
	&& chmod -R g=u "/runtime-data" \
	&& chmod -R g+ws "/runtime-data" \
	&& mkdir /storage \
	&& chown -R 100:0 "/storage" \
	&& chmod -R g=u "/storage" \
	&& chmod -R g+ws "/storage" \
	&& mkdir -p /home/jetty \
	&& chown -R 100:0 "/home/jetty" \
	&& chmod -R g=u "/home/jetty" \
	&& chmod -R g+ws "/home/jetty" \
	&& mkdir /var/lib/jetty/logs \
	&& chown -R 100:0 "/var/lib/jetty/logs" \
	&& chmod -R g=u "/var/lib/jetty/logs" \
	&& chmod -R g+ws "/var/lib/jetty/logs"

COPY --chown=100:0 jetty-logging.properties /var/lib/jetty/resources/jetty-logging.properties
#COPY --chown=100:0 etc/ /var/lib/jetty/webapps/etc

COPY --chown=100:0 shiro-tools-hasher-1.3.2-cli.jar /firstStart/
COPY --chown=100:0 first-passwd-init.sh /firstStart/

COPY --chown=100:0 ROOT.xml /var/lib/jetty/webapps/ROOT.xml
COPY --chown=100:0 ROOT.war /var/lib/jetty/webapps/ROOT.war
#COPY --chown=100:0 bundled/apps/ /bundled/apps

COPY --chown=100:0 config/shiro.ini /runtime-data/config/shiro.ini

# create .ssh dir with correct permissions in jetty homedir
RUN echo "Setting up ssh key storage directory in /home/jetty" \
        && mkdir -p "/home/jetty/.ssh" \
        && chown 100:0 "/home/jetty/.ssh" \
        && chmod 700 "/home/jetty/.ssh"

# one final, recursive change of permissions in /runtime-data
RUN chmod g+w "/var/lib/jetty/webapps/ROOT.xml" \
	&& chown -R 100:0 "/runtime-data" \
	&& chmod -R g=u "/runtime-data" \
	&& chmod -R g+ws "/runtime-data"

USER 100

# enable jetty logging configuration module
RUN java -jar "$JETTY_HOME/start.jar" --approve-all-licenses --add-to-start="https,http2,logging-jetty"

ENV PLATFORM_OPTS=
ENV PLATFORM_JETTY_OPTS=
ENV RUNTIME_OPTS "-DruntimeDirectory=/runtime-data -DstorageDirectory=/storage -Dcom.metaphacts.config.baselocation=/runtime-data/config -DappsDirectory=/apps -Dconfig.environment.shiroConfig=/runtime-data/config/shiro.ini -Dlog4j.configurationFile=file:///var/lib/jetty/webapps/etc/log4j2.xml -Dorg.eclipse.jetty.server.Request.maxFormContentSize=104857600"


ENTRYPOINT ["/entrypoint.sh"]


VOLUME /runtime-data
VOLUME /storage
# note: if /apps is also required as volume, it can be mounted as such from the docker-compose file
