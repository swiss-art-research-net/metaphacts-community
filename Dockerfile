FROM maven:3-jdk-11 AS builder
RUN mkdir workdir
WORKDIR /workdir

RUN apt update
RUN apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates openjdk-11-jdk python2 build-essential

# Install Gradle
RUN wget https://services.gradle.org/distributions/gradle-6.5.1-bin.zip -P /tmp
RUN unzip -d /opt/gradle /tmp/gradle-6.5.1-bin.zip
RUN ln -s /opt/gradle/gradle-6.5.1 /opt/gradle/latest
RUN echo "export GRADLE_HOME=/opt/gradle/latest" >> /etc/profile.d/gradle.sh
RUN echo "export PATH=${GRADLE_HOME}/bin:${PATH}" >> /etc/profile.d/gradle.sh
RUN chmod +x /etc/profile.d/gradle.sh

# Install Node.js v12x
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
RUN curl -fsSL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs
RUN npm install --global yarn
RUN apt install -y libsass-dev

# Copy package.json and run npm install
#COPY package.json /workdir
#RUN npm install

CMD ["tail", "-f", "/dev/null"]