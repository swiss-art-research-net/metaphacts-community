#!\bin\bash

./build.sh -DbuildEnv=prod -Dbuildjson=./metaphacts-platform/platform-only-root-build.json -DplatformVersion=$1 platformWar

export DOCKER_FOLDER="$(pwd)/metaphacts-platform/dist/docker"
cp target/platform-$1.war $DOCKER_FOLDER/platform/ROOT.war
mkdir $DOCKER_FOLDER/platform/etc
cp metaphacts-platform/webapp/etc/* $DOCKER_FOLDER/platform/etc
mkdir $DOCKER_FOLDER/platform/config
cp -r metaphacts-platform/app/config/* $DOCKER_FOLDER/platform/config

cd $DOCKER_FOLDER/platform
docker build -t swissartresearx/metaphacts-community:$1 .