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
import * as maybe from 'data.maybe';
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { fetchSearchProfilesQuery, fetchSearchProfilesInline } from './SearchProfileService';
import { SearchProfileConfig, SemanticSearchConfig, isQuerySearchProfileConfig, QuerySearchProfileConfig, InlineSearchProfileConfig } from '../../config/SearchConfig';
import { getCategoryTypes } from '../search/ModelUtils';
import {
  Category, Categories,
  Relation, Relations,
  Profile, Profiles,
} from './Model';

// refactor to search and edit store, + one generic store
export class SearchProfileStore {
  _availableProfiles: Profiles;
  _profile: Profile;
  _config: SemanticSearchConfig;

  constructor(
    config: SemanticSearchConfig, profiles: Profiles
  ) {
    this._availableProfiles = profiles;
    this._profile = (this.availableProfiles as any).first();

    if (isQuerySearchProfileConfig(config.searchProfile)) {
      const profileConfig = config.searchProfile as QuerySearchProfileConfig;
      if (profileConfig.defaultProfile) {
        this._profile = this._availableProfiles.get(
          Rdf.fullIri(profileConfig.defaultProfile)
        );
      }
    }
    this._config = config;
  }

  public get availableProfiles(): Profiles {
    return this._availableProfiles;
  }

  public get profile(): Profile {
    return this._profile;
  }

  public get categories(): Categories {
    return this._profile.categories;
  }

  public get domains(): Categories {
    return this.filterCategories(rel => rel.hasDomain);
  }

  public get relations(): Relations {
    return this._profile.relations;
  }

  public get ranges(): Categories {
    return this.filterCategories(rel => rel.hasRange);
  }

  public rangesFor = (domain: Category): Categories => {
    const ranges = this.categories.filter(
      category =>
        this.relations.some(
          relation =>
            relation.hasDomain.iri.equals(domain.iri) && relation.hasRange.iri.equals(category.iri)
        ) || _.includes(getCategoryTypes(this._config, category), 'text')
    ) as Categories;
    return ranges;
  }

  public relationsFor(
    {
      domain = maybe.Nothing<Category>(),
      range = maybe.Nothing<Category>(),
    }
  ): Relations {
    return this.relations.filter(
      rel => {
        const domainMatch =
          domain.map(
            d => rel.hasDomain.iri.equals(d.iri)
          ).getOrElse(true);
        const rangeMatch =
          range.map(
            r => rel.hasRange.iri.equals(r.iri)
          ).getOrElse(true);
        return domainMatch && rangeMatch;
      }
    ) as Relations;
  }

  private filterCategories(getCategory: (rel: Relation) => Category): Categories {
    return this.categories.filter(category =>
      this.relations.some(rel => getCategory(rel).iri.equals(category.iri))
    ) as Categories;
  }
}

export function createSearchProfileStore(
  config: SemanticSearchConfig, profileConfig: SearchProfileConfig
): Kefir.Property<SearchProfileStore> {
  if (isQuerySearchProfileConfig(profileConfig)) {
    return fetchSearchProfilesQuery(profileConfig).map(ps => new SearchProfileStore(config, ps));
  } else {
    return fetchSearchProfilesInline(profileConfig).map(ps => new SearchProfileStore(config, ps));
  }
}

export default SearchProfileStore;
