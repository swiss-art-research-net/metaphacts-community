# DISCLAIMER

This Docker build process has been adopted from the ResearchSpace workflow: https://github.com/researchspace/researchspace

1. Build artefacts:

```
./gradlew -DbuildEnv=prod platformWar
````

2. Copy the artefacts to the Docker build folder

```
cp target/platform-4.0.0.war dist/docker/platform/ROOT.war
```

3. Build Docker image

```
cd dist/docker/platform
docker image build -t swissartresearx/metaphacts-community:4.0.0 --no-cache .
```

# Docker Image


This docker image hosts the platform and is derived from the official Jetty image. 


## Links

* [Official Jetty Docker image](https://hub.docker.com/_/jetty/)
* [Jetty version history](https://github.com/eclipse/jetty.project/blob/jetty-9.4.x/VERSION.txt)
* [Repository](https://github.com/docker-library/docs/tree/master/jetty) containing the Dockerfile of the official Jetty image.
Follow the links in the readme to get to the desired version corresponding to the FROM clause of our base Dockerfile

## Building the image locally

See main ResearchSpace README.md file.
