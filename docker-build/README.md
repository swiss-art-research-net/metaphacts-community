# Docker image build file for metaphacts/researchspace

Important note: the build process has to be run in the project root directory, not this directory!

You can supply your own Log4J config in the `etc` subdirectory (it gets copied to `/var/lib/jetty/webapps/etc/`) and your own `shiro.ini` in the `config` subdirectory.  

In the project root directory run:
```
docker build -f docker-build/Dockerfile -t docker.gitlab.gwdg.de/mpiwg/research-it/metaphacts:3.1.0-snapshot .
```
