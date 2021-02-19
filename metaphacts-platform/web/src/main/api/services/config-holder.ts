/*
 * "Commons Clause" License Condition v1.0
 *
 * The Software is provided to you by the Licensor under the
 * License, as defined below, subject to the following condition.
 *
 * Without limiting other conditions in the License, the grant
 * of rights under the License will not include, and the
 * License does not grant to you, the right to Sell the Software.
 *
 * For purposes of the foregoing, "Sell" means practicing any
 * or all of the rights granted to you under the License to
 * provide to third parties, for a fee or other consideration
 * (including without limitation fees for hosting or
 * consulting/ support services related to the Software), a
 * product or service whose value derives, entirely or substantially,
 * from the functionality of the Software. Any
 * license notice or attribution required by the License must
 * also include this Commons Clause License Condition notice.
 *
 * License: LGPL 2.1 or later
 * Licensor: metaphacts GmbH
 *
 * Copyright (C) 2015-2021, metaphacts GmbH
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
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { SparqlUtil } from 'platform/api/sparql';

import * as ConfigService from './config';
import { NotEnoughPermissionsError } from './security';

interface RawConfig {
  environment: EnvironmentConfig;
  ui: RawUIConfig;
  global: GlobalConfig;
}

/**
 * This is static holder of configuration. It's initalized in MainApp, everything is rendered after
 * this component is ready. To use, call getEnvironmentConfig, it will get you either config or
 * throw an error if it's not initialized yet
 */
export class ConfigHolderClass {
  private isLoading: boolean;

  private environmentConfig: EnvironmentConfig;
  private uiConfig: UIConfig;
  private globalConfig: GlobalConfig;

  constructor() {
    this.isLoading = true;
  }

  /**
   * Get environment config in runtime. Values will be available when rendering.
   * @returns EnvironmentConfig
   */
  public getEnvironmentConfig(): EnvironmentConfig {
    if (this.isLoading) { throw Error('Config has not been initialized yet'); }
    return this.environmentConfig;
  }

  /**
   * Get environment config in runtime. Values will be available when rendering.
   * @returns EnvironmentConfig
   */
  public getUIConfig(): UIConfig {
    if (this.isLoading) { throw Error('Config has not been initialized yet'); }
    return this.uiConfig;
  }

  /**
   * Get global config in runtime. Values will be available when rendering.
   * @returns GlobalConfig
   */
  public getGlobalConfig(): GlobalConfig {
    if (this.isLoading) { throw Error('Config has not been initialized yet'); }
    return this.globalConfig;
  }

  fetchConfig(): Kefir.Property<RawConfig> {
    return Kefir.combine({
      environment: ConfigService.getConfigsInGroup('environment'),
      ui: ConfigService.getConfigsInGroup('ui'),
      global: ConfigService.getConfigsInGroup('global'),
    }).toProperty();
  }

  /**
   * This method is to be called by MainApp to trigger config initialization.
   */
  initializeConfig(rawConfig: RawConfig) {
    this.setEnvironmentConfig(rawConfig.environment);
    this.setUIConfig(rawConfig.ui);
    this.setGlobalConfig(rawConfig.global);
    this.isLoading = false;
  }

  private setEnvironmentConfig(config: EnvironmentConfig) {
    if (!config.resourceUrlMapping) {
      throw new NotEnoughPermissionsError(
        'Configuration property "resourceUrlMapping" is undefined. ' +
          'Most likely permissions for reading the configuration properties are not set correctly.'
      );
    }
    this.environmentConfig = config;
  }

  private setUIConfig(config: RawUIConfig) {
    const {
      preferredLanguages,
      preferredLabels,
      preferredThumbnails,
      templateIncludeQuery,
      enableUiComponentBasedSecurity,
      clearScreenOnLogout
    } = config;

    const labelPaths = preferredLabels ? preferredLabels.value : [];
    const thumbnailPaths = preferredThumbnails ? preferredThumbnails.value : [];
    this.uiConfig = {
      preferredLanguages: preferredLanguages ? preferredLanguages.value : [],
      labelPropertyPattern: makePropertyPattern(labelPaths),
      labelPropertyPath: makePropertyPath(labelPaths),
      thumbnailPropertyPattern: makePropertyPattern(thumbnailPaths),
      thumbnailPropertyPath: makePropertyPath(thumbnailPaths),
      templateIncludeQuery: templateIncludeQuery ? templateIncludeQuery.value : undefined,
      enableUiComponentBasedSecurity: enableUiComponentBasedSecurity
        ? Boolean(enableUiComponentBasedSecurity.value) : false,
      clearScreenOnLogout: clearScreenOnLogout
        ? Boolean(clearScreenOnLogout.value) : false,
    };
  }

  private setGlobalConfig(config: GlobalConfig) {
    this.globalConfig = config;
  }
}

export interface EnvironmentConfig {
  readonly resourceUrlMapping?: StringValue;
}

interface RawUIConfig {
  preferredLanguages?: StringArray;
  preferredLabels?: StringArray;
  preferredThumbnails?: StringArray;
  templateIncludeQuery?: StringValue;
  enableUiComponentBasedSecurity?: BooleanValue;
  supportedBrowsers?: StringArray;
  unsupportedBrowserMessage?: StringValue;
  clearScreenOnLogout?: BooleanValue;
}

export interface UIConfig {
  readonly preferredLanguages: ReadonlyArray<string>;
  readonly labelPropertyPattern: string;
  readonly labelPropertyPath: SparqlJs.PropertyPath;
  readonly thumbnailPropertyPattern: string;
  readonly thumbnailPropertyPath: SparqlJs.PropertyPath;
  readonly templateIncludeQuery: string | undefined;
  readonly enableUiComponentBasedSecurity: boolean;
  readonly supportedBrowsers?: ReadonlyArray<string>;
  readonly unsupportedBrowserMessage?: string | undefined;
  readonly clearScreenOnLogout?: boolean;
}

export interface GlobalConfig {
  readonly homePage?: StringValue
}

export interface StringValue {
  value: string;
  shadowed: boolean;
}

export interface StringArray {
  value: string[];
  shadowed: boolean;
}

export interface BooleanValue {
  value: boolean;
  shadowed: boolean;
}

function makePropertyPattern(paths: ReadonlyArray<string>): string {
  return keepOnlyPropertyPaths(paths).join('|');
}

function makePropertyPath(paths: ReadonlyArray<string>): SparqlJs.PropertyPath {
  const alternatives: Array<SparqlJs.IriTerm | SparqlJs.PropertyPath> = [];
  for (const path of keepOnlyPropertyPaths(paths)) {
    try {
      const alternative = SparqlUtil.parsePropertyPath(path);
      alternatives.push(alternative);
    } catch (err) {
      console.warn('Invalid label property path', err);
    }
  }

  if (alternatives.length === 0) {
    throw new Error('Failed to construct property path for labels (path is empty)');
  }

  return {
    type: 'path',
    pathType: '|',
    items: alternatives,
  };
}

function keepOnlyPropertyPaths(paths: ReadonlyArray<string>): string[] {
  return paths.filter(path => !(path.startsWith('{') || path.endsWith('}')));
}

export const ConfigHolder = new ConfigHolderClass();
