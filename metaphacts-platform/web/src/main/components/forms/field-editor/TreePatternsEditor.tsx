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
import * as React from 'react';
import { Component, FormEvent } from 'react';

import { SparqlEditor } from 'platform/components/sparql-editor';
import {
  DefaultLightweightPatterns, createDefaultTreeQueries,
} from 'platform/components/semantic/lazy-tree';

import { FieldEditorRow } from './FieldEditorRow';
import {
  ValidatedTreeConfig, ValidatedSimpleTreeConfig, ValidatedFullTreeConfig,
} from './FieldEditorState';

export interface TreePatternsEditorProps {
  config: ValidatedTreeConfig;
  onChange: (config: ValidatedTreeConfig) => void;
}

const CLASS_NAME = 'tree-patterns-editor';

export class TreePatternsEditor extends Component<TreePatternsEditorProps, {}> {
  private readonly fullConfigDefaults = createDefaultTreeQueries();

  render() {
    const {config} = this.props;
    const typeSwitchClass = `${CLASS_NAME}__type-switch`;
    return (
      <div className={CLASS_NAME}>
        <FieldEditorRow label='type' expanded={true}>
          <label className={typeSwitchClass}><input type='radio'
            value='simple'
            checked={config.type === 'simple'}
            onChange={this.changeConfigType} /> Simple</label>
          <label className={typeSwitchClass}><input type='radio'
            value='full'
            checked={config.type === 'full'}
            onChange={this.changeConfigType} /> Full</label>
        </FieldEditorRow>
        {config.type === 'simple'
          ? this.renderSimpleEditor(config)
          : this.renderFullEditor(config)}
      </div>
    );
  }

  private changeConfigType = (event: FormEvent<HTMLInputElement>) => {
    const type = event.currentTarget.value as ValidatedTreeConfig['type'];

    let newConfig: ValidatedTreeConfig;
    if (type === 'simple') {
      newConfig = {type};
    } else {
      const {rootsQuery, childrenQuery, parentsQuery, searchQuery} = createDefaultTreeQueries();
      newConfig = {
        type: 'full',
        rootsQuery: {value: rootsQuery},
        childrenQuery: {value: childrenQuery},
        parentsQuery: {value: parentsQuery},
        searchQuery: {value: searchQuery},
      };
    }

    this.props.onChange(newConfig);
  }

  renderSimpleEditor(config: ValidatedSimpleTreeConfig) {
    return (
      <div key='simple' className={`${CLASS_NAME}__simple-config`}>
        <FieldEditorRow label='scheme pattern'
          expanded={Boolean(config.schemePattern)}
          onExpand={() => this.changeConfig(config, {
            schemePattern: {value: DefaultLightweightPatterns.schemePattern},
          })}
          onCollapse={() => this.changeConfig(config, {schemePattern: undefined})}
          error={config.schemePattern ? config.schemePattern.error : undefined}>
          <SparqlEditor syntaxErrorCheck={false}
            query={config.schemePattern ? config.schemePattern.value : ''}
            onChange={e => this.changeConfig(config, {schemePattern: {value: e.value}})}
          />
        </FieldEditorRow>
        <FieldEditorRow label='relation pattern'
          expanded={Boolean(config.relationPattern)}
          onExpand={() => this.changeConfig(config, {
            relationPattern: {value: DefaultLightweightPatterns.relationPattern}
          })}
          onCollapse={() => this.changeConfig(config, {relationPattern: undefined})}
          error={config.relationPattern ? config.relationPattern.error : undefined}>
          <SparqlEditor syntaxErrorCheck={false}
            query={config.relationPattern ? config.relationPattern.value : ''}
            onChange={e => this.changeConfig(config, {relationPattern: {value: e.value}})}
          />
        </FieldEditorRow>
      </div>
    );
  }

  renderFullEditor(config: ValidatedFullTreeConfig) {
    return (
      <div key='full' className={`${CLASS_NAME}__full-config`}>
        {this.renderFullQuery(config, 'rootsQuery', 'roots query')}
        {this.renderFullQuery(config, 'childrenQuery', 'children query')}
        {this.renderFullQuery(config, 'parentsQuery', 'parents query')}
        {this.renderFullQuery(config, 'searchQuery', 'search query')}
      </div>
    );
  }

  private renderFullQuery(
    config: ValidatedFullTreeConfig,
    queryKey: 'rootsQuery' | 'childrenQuery' | 'parentsQuery' | 'searchQuery',
    label: string,
  ) {
    const query = config[queryKey];
    const defaultValue = this.fullConfigDefaults[queryKey];
    return (
      <FieldEditorRow label={label}
        expanded={Boolean(query)}
        expandOnMount={true}
        onExpand={() => this.changeConfig(config, {[queryKey]: {value: defaultValue}})}
        error={query ? query.error : undefined}>
        <SparqlEditor syntaxErrorCheck={false}
          query={query ? query.value : undefined}
          onChange={e => this.changeConfig(config, {[queryKey]: {value: e.value}})}
        />
      </FieldEditorRow>
    );
  }

  private changeConfig(
    previous: ValidatedSimpleTreeConfig,
    update: Partial<ValidatedSimpleTreeConfig>
  ): void;
  private changeConfig(
    previous: ValidatedFullTreeConfig,
    update: Partial<ValidatedFullTreeConfig>
  ): void;
  private changeConfig(previous: any, update: Partial<any>) {
    this.props.onChange({...previous, ...update});
  }
}
