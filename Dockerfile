FROM maven:3-jdk-11 AS builder
RUN mkdir workdir
WORKDIR /workdir

RUN apt update
RUN apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates gnupg openjdk-11-jdk python2 build-essential xz-utils

# Install Gradle
RUN wget https://services.gradle.org/distributions/gradle-6.5.1-bin.zip -P /tmp
RUN unzip -d /opt/gradle /tmp/gradle-6.5.1-bin.zip
RUN ln -s /opt/gradle/gradle-6.5.1 /opt/gradle/latest
RUN echo "export GRADLE_HOME=/opt/gradle/latest" >> /etc/profile.d/gradle.sh
RUN echo "export PATH=${GRADLE_HOME}/bin:${PATH}" >> /etc/profile.d/gradle.sh
RUN chmod +x /etc/profile.d/gradle.sh

# Install Node.js v14.x from the official Node.js binary distribution
RUN arch="$(dpkg --print-architecture)" \
    && case "${arch}" in \
        amd64) node_arch='x64'; node_sha256='bef2685d9469058c1229cc7789e171861044fe3f70316ec744e9bf3609cd45ed' ;; \
        arm64) node_arch='arm64'; node_sha256='f06642bfcf0b8cc50231624629bec58b183954641b638e38ed6f94cd39e8a6ef' ;; \
        *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
    esac \
    && curl -fsSLO "https://nodejs.org/download/release/latest-fermium/node-v14.21.3-linux-${node_arch}.tar.xz" \
    && echo "${node_sha256}  node-v14.21.3-linux-${node_arch}.tar.xz" | sha256sum -c - \
    && tar -xJf "node-v14.21.3-linux-${node_arch}.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
    && rm "node-v14.21.3-linux-${node_arch}.tar.xz"
RUN apt update && apt -y install libsass-dev

# Install Yarn
RUN npm install --global yarn

# Copy package.json and run npm install
#COPY package.json /workdir
#RUN npm install

CMD ["tail", "-f", "/dev/null"]
