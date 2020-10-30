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
import * as Immutable from 'immutable';
import * as React from 'react';
import ReactSelect, { Options, OnChangeHandler } from 'react-select';
import * as maybe from 'data.maybe';

import { Rdf } from 'platform/api/rdf';
import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';

export interface SemanticSearchDomainSwitchProps {
  /**
   * Specifies the available search domains, ties them with the projection variables
   */
  availableDomains?: { [iri: string]: string }
}

export class SemanticSearchDomainSwitch extends React.Component<SemanticSearchDomainSwitchProps> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <SemanticSearchDomainSwitchInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends SemanticSearchDomainSwitchProps {
  context: InitialQueryContext;
}

class SemanticSearchDomainSwitchInner extends React.Component<InnerProps, {}> {
  componentDidMount() {
    this.setAvailableDomains();
  }

  private setAvailableDomains() {
    maybe.fromNullable(this.props.availableDomains).map(
      domains => Immutable.Map(domains).mapKeys(Rdf.iri) as Immutable.Map<Rdf.Iri, string>
    ).map(
      this.props.context.setAvailableDomains
    );
  }

  private onChangeDomain = (option: { value: string; label: string }) => {
    const {searchProfileStore, setDomain} = this.props.context;
    const profileStore = searchProfileStore.get();
    const category = profileStore.categories.get(Rdf.iri(option.value));
    setDomain(category);
  }

  render() {
    const {availableDomains, domain, searchProfileStore} = this.props.context;
    if (availableDomains.isNothing || domain.isNothing) { return null; }

    const value = domain.get().iri.value;
    const profileStore = searchProfileStore.get();

    const options: Options<string> = [];
    availableDomains.get().forEach((projection, iri) => {
      const category = profileStore.categories.get(iri);
      if (category) {
        options.push({value: category.iri.value, label: category.label});
      }
    });

    return <ReactSelect value={value} options={options} clearable={false}
      onChange={this.onChangeDomain as OnChangeHandler<string>} />;
  }
}

export default SemanticSearchDomainSwitch;
