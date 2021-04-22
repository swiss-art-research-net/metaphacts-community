/*
 * Copyright (C) 2015-2018, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} RootBuildConfig
 * @property {Array<string>} includeProjects
 * @property {Array<string>} [bundleAppsFrom]
 * @property {string} [applyThemeFrom]
 * @property {string} [defaultShiroIniFolder]
 * @property {boolean} [noTsCheck]
 */

/**
 * @typedef {Object} WebProject
 * @property {string} name
 * @property {string} rootDir
 * @property {string} webDir
 * @property {string} [schemasAlias]
 * @prop {{ [entry: string]: string }} [entries]
 * @prop {Array<string>} [stableEntryNames]
 * @prop {{ [entry: string]: string }} [aliases]
 * @prop {Array<string>} [extensions]
 * @prop {Array<string>} [cssModulesBasedComponents]
 * @prop {Array<string | { interfaceName: string; schemaName: string }>} [generatedJsonSchemas]
 */

/**
 * @typedef {Object} ComponentMetadata
 * @property {string} path
 * @prop {{ [attributeName: string]: true }} [deferAttributes]
 * @prop {{ [attributeName: string]: { [propertyName: string]: true } }} [deferJsonProperties]
 * @prop {string} [propsSchema]
 * @prop {Array<string>} [additionalSchemas]
 * @prop {string} [helpResource]
 */

module.exports = function () {
  /** folder with metaphactory and all extensions */
  const ROOT_DIR = path.join(__dirname, '../..');
  const DIST = path.join(__dirname, 'assets');

  const ROOT_BUILD_PATH = process.env.buildjson || 'default-root-build.json';
  /** @type {RootBuildConfig} */
  const ROOT_BUILD_CONFIG = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, ROOT_BUILD_PATH), 'utf-8')
  );

  /** @type {Array<WebProject>} */
  const WEB_PROJECTS = [];

  for (const projectName of ROOT_BUILD_CONFIG.includeProjects) {
    const rootDir = path.join(ROOT_DIR, projectName);
    if (!fs.statSync(rootDir).isDirectory()) {
      continue;
    }
    const webDir = path.join(rootDir, 'web');
    const settingsPath = path.join(webDir, 'platform-web-build.json');
    if (!fs.existsSync(settingsPath)) {
      continue;
    }
    /** @type {WebProject} */
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.name = projectName;
    settings.rootDir = rootDir;
    settings.webDir = webDir;
    if (settings.generatedJsonSchemas) {
      settings.schemasAlias = `platform-schemas-root/${settings.name}`;
    }
    WEB_PROJECTS.push(settings);
  }

  const platformProject = WEB_PROJECTS.find(p => p.name === 'metaphacts-platform');
  if (!platformProject) {
    throw new Error(`Failed to find 'metaphacts-platform' web project`);
  }
  /** platform code root */
  const METAPHACTORY_ROOT_DIR = platformProject.webDir;
  const METAPHACTORY_DIRS = {
    src: path.join(METAPHACTORY_ROOT_DIR, 'src/main'),
    test: path.join(METAPHACTORY_ROOT_DIR, 'src/test')
  };

  const allRootDirs = WEB_PROJECTS.map(project => project.webDir);
  const srcs = allRootDirs.map(dir => path.join(dir, 'src/main'));
  const tests = allRootDirs.map(dir => path.join(dir, 'src/test'));

  return {
    ROOT_BUILD_CONFIG,
    WEB_PROJECTS,
    ALIASES: makeAliasesConfig(WEB_PROJECTS),
    ROOT_DIR: ROOT_DIR,
    METAPHACTORY_ROOT_DIR: METAPHACTORY_ROOT_DIR,
    METAPHACTORY_DIRS: METAPHACTORY_DIRS,
    DIST: DIST,
    SRC_DIRS: srcs,
    TEST_DIRS: tests,
    resolveModulePath,
  };
};

/**
 * @param {Array<WebProject>} projects
 */
function makeAliasesConfig(projects) {
  /** @type {{ [alias: string]: string }} */
  const aliases = {};
  for (const project of projects) {
    if (project.aliases) {
      Object.keys(project.aliases).forEach(key => {
        const aliasPath = project.aliases[key];
        aliases[key] = resolveModulePath(project, aliasPath);
      });
    }
    if (project.schemasAlias) {
      aliases[project.schemasAlias] = path.join(project.webDir, 'schemas');
    }
  }
  return aliases;
}

/**
 * @param {WebProject} project
 * @param {string} modulePath
 */
function resolveModulePath(project, modulePath) {
  return modulePath.startsWith('./') || modulePath.startsWith('../')
    ? path.join(project.webDir, modulePath)
    : modulePath;
}
