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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import { Component, Children, cloneElement } from 'react';
import { DataProvider, CompositeDataProvider } from 'ontodia';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import { isValidChild, componentDisplayName } from 'platform/components/utils';

import { FieldConfiguration } from '../authoring/FieldConfigurationCommon';

export interface CreateDataProviderParams {
  readonly fieldConfiguration: FieldConfiguration;
}

export interface DataProviderComponent {
  getName(): string;
  createDataProvider(params: CreateDataProviderParams): DataProvider;
  initializeDataProvider(dataProvider: DataProvider): Kefir.Property<void>;
}

/**
 * Consists data providers that `ontodia` will use to fetch data.
 * Requires at least one data provider.
 */
export interface OntodiaDataProvidersConfig {
  /**
   * Data providers.
   */
  children: JSX.Element | ReadonlyArray<JSX.Element>;
}

export type OntodiaDataProvidersProps = OntodiaDataProvidersConfig;

export class OntodiaDataProviders extends Component<OntodiaDataProvidersProps, {}> {
  private _dataProviders: Array<DataProviderComponent> = [];

  render() {
    const {children} = this.props;
    if (Children.count(children) === 0) {
      throw Error(`<ontodia-data-providers /> should have one or more data providers.`);
    }
    return Children.map(children, child => {
      if (isValidChild(child)) {
        return cloneElement(child, {ref: this.onDataProviderMounted});
      }
      throw Error(`${componentDisplayName(child)} is an invalid data provider type.`);
    });
  }

  get dataProviders(): Array<DataProviderComponent> {
    return this._dataProviders;
  }

  private onDataProviderMounted = (dataProvider: DataProviderComponent | null) => {
    if (dataProvider && isDataProvider(dataProvider)) {
      this._dataProviders.push(dataProvider)
    }
  }
}

function isDataProvider(
  dataProvider: DataProviderComponent
): dataProvider is DataProviderComponent {
  return dataProvider.getName !== undefined && dataProvider.createDataProvider !== undefined;
}

export function createDataProvider(
  dataProvidersComponents: ReadonlyArray<DataProviderComponent>,
  params: CreateDataProviderParams
): { dataProvider: DataProvider; initializeDataProvider: () => Kefir.Property<void> } {
  const dataProviders = dataProvidersComponents.map(dataProviderComponent => {
    const dataProvider = dataProviderComponent.createDataProvider(params);
    return {
      name: dataProviderComponent.getName(),
      dataProvider: dataProvider,
      initializeDataProvider: () => dataProviderComponent.initializeDataProvider(dataProvider),
    };
  });
  const initializeDataProvider = () => {
    return Kefir.zip(
      dataProviders.map(dataProvider => dataProvider.initializeDataProvider())
    ).map(() => { /* nothing */ }).toProperty();
  };
  let dataProvider: DataProvider;
  if (dataProviders.length === 1) {
    dataProvider = dataProviders[0].dataProvider;
  } else {
    dataProvider = new CompositeDataProvider(dataProviders, {factory: Rdf.DATA_FACTORY});
  }
  return {dataProvider, initializeDataProvider};
}

export default OntodiaDataProviders;
