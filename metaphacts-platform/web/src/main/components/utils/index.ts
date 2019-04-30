/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import * as _ from 'lodash';

import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import { ConfigHolder } from 'platform/api/services/config-holder';
import { getPreferredUserLanguage } from 'platform/api/services/language';

/**
 * Transform sparql results to make sure that there are values in the bindings
 * for all projection variables. This simplify handling of results in visualization
 * components.
 */
export function prepareResultData(data: SparqlClient.SparqlSelectResult) {
  return _.each(
    data.results.bindings,
    binding => _.map(
      data.head.vars, bindingVar => binding[bindingVar] ? binding[bindingVar] : Rdf.literal('')
    )
  );
}

/**
 * Returns the label with the user preferred language, otherwise returns the label based on
 * the order of the preferredLanguages. In case the label is missing, returns the label with
 * empty language. If no label exists, returns undefined.
 *
 * This client-side logic is only to be used in exceptional cases (i.e. if physical triples might
 * no be present in the triple store) and otherwise the global/backend label service should be used.
 */
export function getPreferredLabel(
  label: string | ReadonlyArray<Rdf.LangLiteral> | undefined
): string | undefined {
  if (label !== undefined) {
    if (typeof label === 'string') {
      return label;
    }
    if (label.length > 0) {
      const userPreferredLanguage = getPreferredUserLanguage();
      let preferredLabel = label.find(({lang}) => lang === userPreferredLanguage);
      if (preferredLabel) {
        return preferredLabel.value;
      }

      const {preferredLanguages} = ConfigHolder.getUIConfig();
      for (const preferredLanguage of preferredLanguages) {
        preferredLabel = label.find(({lang}) => lang === preferredLanguage);
        if (preferredLabel) {
          return preferredLabel.value;
        }
      }

      preferredLabel = label.find(({lang}) => lang === '');
      if (preferredLabel) {
        return preferredLabel.value;
      }

      return label[0].value;
    }
  }
  return undefined;
}

export * from './KefirComponent';
export * from './LoadingBackdrop';
export * from './ComponentUtils';
export * from './Action';
export * from './HideableLink';
export * from './ControlledProps';

// temporary re-export to minimize merge conflicts
export { BrowserPersistence } from 'platform/api/persistence';
