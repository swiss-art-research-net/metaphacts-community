# Metaphacts Platform Development

## Quick Overview
The development workspace (i.e. the root folder) is divided into these parts:

* `metaphacts-platform` - core metaphacts platform;
* `project` - all build related artifacts (Gradle scripts, Webpack config, etc);
* additional extension folders - extensions for backend services and/or frontend components.

For the frontend we are using Yarn for dependency management, Webpack for bundling.

We use Gradle as a single entry point for compiling and bundling the sources, whereas the Gradle build script calls Webpack for compiling and bundling the frontend part.

## Core Platform Overview

* `metaphacts-platform/core` - platform backend

  Developed in Java 11. Mainly builds upon RDF4J 3.x for processing and handling RDF data, Guice for dependency injection, Apache Shiro for security matters and Jersey for developing RESTful services.

  OSS dependencies are managed by Gradle and NPM and are retrieved from the public repositories.

* `metaphacts-platform/client-api` - platform client

  Initial Java 11 based client to (remotely) connect to the platform. Provides dedicated interfaces for accessing assets and services such as queries. Provides some further utils ontop of RDF4J.

* `metaphacts-platform/web` - platform frontend

  Developed in Typescript and compiled to clean, simple JavaScript code which runs on any browser. Mainly using React for web-component development, SCSS for stylesheets.

## Development Setup

### Prerequisites
It is possible to use an unix-based OS as well as Windows for development against the platform. As prerequisites you need to have installed on your machine:

* OpenJDK 11
* Node.js 8.x (or later)
* Gradle
* Yarn
* an RDF database or at least access to such (see section below)

In particular, on OSX and Unix systems the most stable versions for Node.js are usually available from common package managers (e.g. homebrew, apt) and as such easy to install and to upgrade.
On Windows the use of [Chocolatey](https://chocolatey.org/) is highly recommended.

### RDF Database (Triplestore)

For most developments (i.e. for starting-up the platform properly) you will need to have a RDF database in place. The database does not necessarily need to run on your local machine as long as it is accessible over a standard conform SPARQL endpoint interface. For your convenience, we recommend to run, for example, Blazegraph as a container on your local docker daemon so you can easily run serveral databases in parallel and switch between them:

1. Login into DockerHub: `docker login`
2. Pull latest blazegraph image: `docker pull metaphacts/blazegraph-basic:2.2.0-20160908.003514-6-jetty9.4.35-jre8-a53ba9b`
3. Run Blazegraph container with local storage mounted as data volume: `docker run --name blazegraph -d --restart=always -p 10080:8080 --env JAVA_OPTS="" -v /home/user/path-to-blazegraph-journal:/blazegraph-data metaphacts/blazegraph-basic:2.2.0-20160908.003514-6-jetty9.4.35-jre8-a53ba9b`

Where `/home/user/path-to-blazegraph-journal-folder` is the folder on the host system where blazegraph journal will be stored.

**Please note that on Windows, it is required to first activate sharing of drives through `Docker Desktop App > Settings > Shared Drives`. You can afterwards specify the folder like `C:\path-to-blzaegraph-journal`**

Afterwards, **connect your development setup to the SPARQL endpoint** as exposed by the Blazegraph container running on your docker machine by adding `sparqlEndpoint=http://localhost:10080/blazegraph/sparql` to your `runtime/config/environment.prop` configuration file. The folder structure and the `environment.prop file` do not exist right after checkout and have to be created manually or will be created during first build run.

### IDE
At metaphacts we are using various IDEs and text editors like Eclipse, IDEA, VSCode, Atom and Emacs. While there exist some addons for JavaScript and Typescript in Eclipse, it is in principle possible to develop everything in only one IDE, e.g. Eclipse or IDEA. However, in particular for the JavaScript/TypeScript development it can be convenient to use editors such as VSCode, Atom or Emacs with much more powerful plugins.

### Initial Setup

#### Gradle environment

As a build eco system we rely on Gradle. All relevant build definitions are provided and documented in the following.

For convenience it is possible to create a `gradle.properties` file in the root folder of the project to configure the environment. This allows to specify the local `buildjson` definition as well as other settings (e.g. debug), see below for details. A template is provided in `gradle.properties.template`.

#### NPM Dependencies

In the Gradle environment we provide a convenience task to initialize all web projects. The script basically invokes `yarn install` on all relevant projects. This script can be executed using `./gradlew initializeNpm`. Note that this may take some time.

#### Eclipse
If you are used to develop in Eclipse, you can import the Gradle project using Buildship tooling, i.e. use the regular import functionality with project type `Gradle`.

The Gradle environment first resolves all required dependencies and then automatically generates the classpath file as well as required Eclipse metadata files.

To update the classpath (e.g. if there are new dependencies) right click on the project, select `Gradle` and then `Refresh Gradle project`. 

#### VSCode
When developing frontend code in the Visual Studio Code we recommend setting TypeScript compiler to locally installed one by clicking on compiler version number in the status bar while viewing any `*.ts` file, or manually setting `"typescript.tsdk": "project/webpack/node_modules/typescript/lib"` in the `.vscode/settings.json`.

## Running the Platform

The platform can be started from using Gradle with the command `./gradlew appRun`. This will compile all sources and start the jetty server. Note that the process will watch all source directories for changes in order to trigger incremental compilation, so any change to the server-side or client-side sources triggers re-deployment, which takes no more than a few seconds until they are picked-up by Jetty.

Finally, go to [http://127.0.0.1:10214/](http://127.0.0.1:10214/). You should see the login screen and should be able to login with standard login `admin:admin`.

### Summary of Gradle Commands & Settings

#### Commands

```
./gradlew appRun
./gradlew -Ddebug=true appRun
./gradlew platformWar
./gradlew appZip
./gradlew test
./gradlew generateLicenseReport
./gradlew generateJsonSchema
```

#### System properties

System properties can be defined using `-Dprop=value` in the `.gradlew` (e.g. `./gradlew -Ddebug=true appRun`) or in `gradle.properties` in the project root folder using the prefix `systemProp.` (see also `gradle.properties.template`).

```
runtimeDirectory => location of the runtime directory (relative to root project). Default: runtime
log => log4j configuration profile (supported values: log4j2 log4j2-debug, log4j2-trace, log4j2-trace2) Default: log4j2-debug
buildJson => location of the build JSON configuration
debug => whether JVM debug is enabled (default port 5005)
debug.port => JVM debug port. Default: 5005
debug.suspend => suspend on debug (true|false). Default: false
platformVersion => the platform version
```

## Debugging

### Backend
Run `./gradlew` with an additional parameter `-Ddebug=true` will open a remote debugging port when starting Jetty with `appRun`.
Once the Gradle console displays the message "Listening for transport dt_socket at address: 5005" you can connect to the respective port using, for example, the remote debugging functionality in Eclipse (Run -> Debug Configurations .. -> New "Remote Java Application" -> Choose a name, `localhost` as host and `5005` as port parameter).

### Frontend
At metaphacts we are using standard browser developer tools for debugging the frontend. Furthermore, there is a dedicated plugin called "React Developer Tools" (available for Chrome, Firefox) for debugging and tracing states of React components.

There are several convenient specifies, if being in the development mode:

* Hot-Reloading

  Changes to JS/TS and CSS/LESS files are compiled and pushed during runtime. We are using so called "hot loaders" which will try to "swap" changes live into the client application i.e. without the need to reload the entire page in the browser.

* Source Attachments

  Sourcemaps are being attached (`webpack://./src`) i.e. you can debug in the Typescript code instead of in the compile JS code.

* Save app data directly to checked-out working copy of repository

  Base plaform app `metaphacts-platform` and other attached apps are directly available for write. This means any changes to the storage-based data (templates, configuration, namespaces, etc) will be applied directly to the working directory which is managed by git.

## Backend Logging
The platform's backend is using log4j2 (and respective adapters) for logging and comes with four pre-configured log profiles.
The default profile is "debug", however, the profile can easily be switched by supplying the `-Dlog={log4j2-debug,log4j2-trace,log4j2-trace2,log4j2}` environment variable
to the Gradle command. The `log4j2-trace` and `log4j2-trace2` profile produce a lot of log messages, however, can particularly be useful when one needs to trace, for example, request headers or queries without goint to debug low level APIs.

**Please note:** If an old `log4j2.xml` file is still present in the compilation `/target/webapp/WEB-INF` folder, it will always be be preceded over the file set via the `-Dlog` env variable. Execute `clean` and `clean-files` in the sbt console to clean the target folder.

## Codestyle & Linting

### Java

We are using a a code style that is pretty close to the Eclipse proposals and the [Google styleguide](https://google.github.io/styleguide/javaguide.html).

Most important styling:

* Tab policy: 4 spaces
* Braces in same line
* Maximum line width 120

Most important guidelines:

* license header must be present in each source file (automatically added through Gradle)
* new source files should be attributed with the @author annotation in javadoc, preferred format Firstname Lastname (my@email.com)
* always add braces around blocks, even if they are optional

It is recommended to import the code style to your workspace (Eclipse Preferences → Java → Code Style → Formatter → Import), and furthermore to set the "save actions" to format all edited lines upon save (Eclipse Preferences → Java → Editor → Save Actions).

### Typescript & SCSS

You will find a `tslint.json` file in the root folder of the project, which should automatically be recognised by your IDE and respective linting extensions. Make sure that your IDE has installed the latest tslint plugin/extension, i.e.  the `tslint@1.0.x` extension in Visual Code (View -> Extensions -> search … 'tslint' ) is deprecated and you should install `tslint@1.2.x` or newer, which is a separate extension and requires to uninstall the old extension.

## Commits and Pull Requests

For legal compliance all commits to the codebase need to be done by metaphacts employees or under contractual agreements (e.g. a valid CLA).

For this repository we enforce special rules for merging a PR:

* all commits of a PR require to use a metaphacts.com email address in the author and committer field
* each commit must start with a reference to our issue tracker (e.g. ID-1234)
* general conformance of commit messages to widely applied best practices
    * first line (commit message summary) must be a concise description with at most 74 characters
    * second line of the commit message must be empty to separate the summary from the body
    * all details about the commit (e.g. technical explanation and design rationals) can be provided in the body
* commits should be well-organized and self-contained increments to the code base
    * concise description in the summary
    * for complex changes it is best practice to provide explanations in the commit message body to help other developers or future readers understanding

## Testing
Running `./gradlew test` command will execute all backend tests (Java JUnit) as well as client-side unit tests (using mainly mocha, chai, sinon). To just execute the client-side test, you can also run `npm run test` in the `project/webpack` folder. We also have a number of integration tests, see `researchspace/integration-tests`.

## Packaging
Run `./gradlew -DbuildEnv=prod platformWar`. The compiled war file will be copied to `/target/platform-*.war` and can be deployed using common servlet containers such as Jetty or Tomcat.

## Generate JSON Schema from JSDoc

To generate generate JSON schema from any TypeScript interface to use in the documentation with `mp-documentation`, add the interface name to `platform-web-build.json` under the `generatedJsonSchemas` property and execute the following Gradle task.

```
./gradlew generateJsonSchema
```


Technically this will run the following script at `project/webpack` directory for all web projects:

```
# for all interfaces
yarn run generate-schema <project-name> --all

# (not recommended) for a single interface
yarn run generate-schema <project-name> <interface-name>
```

## Third party components

All third party dependencies are managed through the Gradle dependency management system (for Java) or through NPM package.json (for Java Script).

The build system automatically generates a `THIRDPARTY.html` report which provides an overview about all shipped dependencies. This report can also be generated using the `./gradlew generateLicenseReport` command (see `target/reports/licenses/THIRDPARTY.html`).

The tooling tries to automatically infer the license of the component from its metadata (i.e. POM, manifest, ...). If this is not possible, or if the license name / URL needs to be normalized, respective information can be provided using transformation rules in `project/license-normalizer-bundle.json`.

## Troubleshooting

* We have been reported that fetching and installing dependencies may fail on the first run, (e.g. when running `./gradlew initalizeNpm` initially) there might be random `npm` errors/race conditions. These are typically related to compiling certain `npm` (peer/dev) dependencies (depending on the node.js version and operation system being used). Usually running the command a second time will solve the issue. Once the dependencies are compiled/installed, these will be cached unless running `./gradlew cleanNpm`.
* In case you notice problems with the NPM build (e.g. frontend UI does not render properly),
try to solve it using the following steps
    * kill all running `npm`, `node` and `java` processes using the task manager
    * run `./gradlew --rerun-tasks cleanNpm generateWebpackDll`
    * run the application using your launch script, e.g. `gradlew appRun

