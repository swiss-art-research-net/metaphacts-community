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
import * as Kefir from 'kefir';
import * as Immutable from 'immutable';

import {
  QuerySearchProfileConfig, InlineSearchProfileConfig, RELATION_PROFILE_VARIABLES,
  InlineCategory, InlineRelation,
} from '../../config/SearchConfig';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import {
  Category, Categories,
  Relation, Relations, RelationKey,
  Profiles, Profile,
} from './Model';
import * as SearchDefaults from '../../config/Defaults';


export function fetchSearchProfilesQuery(
  config: QuerySearchProfileConfig
): Kefir.Property<Profiles> {
  return Kefir.combine([
    SparqlClient.select(config.categoriesQuery),
    SparqlClient.select(config.relationsQuery),
  ], (categoriesBindings, relationsBindings) => {
    const profilesCategories = constructCategories(categoriesBindings.results.bindings);
    const profilesRelations =
      constructRelations(relationsBindings.results.bindings, profilesCategories);
    const profiles =
      profilesCategories.mapEntries(
        ([profile, categories]) => {
          return [profile, {
            iri: profile,
            label: profile.value,
            categories: categories,
            relations: profilesRelations.get(profile),
          }];
        }
      );
    return profiles as any;
  }).toProperty();
}

export function fetchSearchProfilesInline(
  config: InlineSearchProfileConfig
): Kefir.Property<Profiles> {
  const categories: Categories = constructCategoriesFromInline(config.categories);
  const relations: Relations = constructRelationsFromInline(config.relations, categories);
  const dummyProfile = Rdf.fullIri(SearchDefaults.DefaultInlineProfile);
  const theProfile: Profile = {
      iri: dummyProfile,
      label: dummyProfile.value,
      description: dummyProfile.value,
      tuple: {iri: dummyProfile},
      categories: categories,
      relations: relations,
    };
  const profiles = Immutable.Map([[ dummyProfile, theProfile]]);
  return Kefir.constant(profiles);
}

type ProfilesCategories = Immutable.Map<Rdf.Iri, Categories>;
function constructCategories(bindings: SparqlClient.Bindings): ProfilesCategories {
  const categoriesByProfile =
    Immutable.List(bindings).groupBy(
      binding => binding[RELATION_PROFILE_VARIABLES.PROFILE_PROJECTION_VAR] as Rdf.Iri
    );

  return categoriesByProfile.map(
    constructCategoriesFromBindings
  ).toMap();
}

function constructCategoriesFromInline(inlineConfigs: Array<InlineCategory>): Categories {
  return Immutable.List(inlineConfigs).map(constructCategoryFromInline)
    .groupBy(
      category => category.iri
    ).toOrderedMap().map(
      cs => cs.first()
    ) as Categories;
}

function constructCategoryFromInline(inlineConfig: InlineCategory): Category {
  return {
    iri: Rdf.fullIri(inlineConfig.iri),
    label: inlineConfig.label,
    thumbnail: inlineConfig.thumbnail,
    color: inlineConfig.color,
    description: inlineConfig.label,
    tuple: {
      iri: Rdf.fullIri(inlineConfig.iri),
      label: Rdf.literal(inlineConfig.label),
      thumbnail: inlineConfig.thumbnail ? Rdf.literal(inlineConfig.thumbnail) : undefined,
    }
  };
}

function constructCategoriesFromBindings(
  bindings: Immutable.Iterable<unknown, SparqlClient.Binding>
): Categories {
  return bindings
    .map(
      constructCategoryBromBinding
    ).groupBy(
      category => category.iri
    ).toOrderedMap().map(
      cs => cs.first()
    ) as Categories;
}

function constructCategoryBromBinding(binding: SparqlClient.Binding): Category {
  const thumbnail = binding[RELATION_PROFILE_VARIABLES.THUMBNAIL_PROJECTION_VAR];
  return {
    iri: binding[RELATION_PROFILE_VARIABLES.CATEGORY_PROJECTION_VAR] as Rdf.Iri,
    label: binding[RELATION_PROFILE_VARIABLES.LABEL_PROJECTION_VAR].value,
    description: binding[RELATION_PROFILE_VARIABLES.DESCRIPTION_PROJECTION_VAR].value,
    thumbnail: thumbnail ? thumbnail.value : undefined,
    tuple: binding,
  };
}

type ProfilesRelations = Immutable.Map<Rdf.Iri, Relations>;
function constructRelations(
  bindings: SparqlClient.Bindings, categories: ProfilesCategories
): ProfilesRelations {
  const relationsByProfile =
    Immutable.List(bindings).groupBy(
      binding => binding[RELATION_PROFILE_VARIABLES.PROFILE_PROJECTION_VAR] as Rdf.Iri
    );

  return relationsByProfile.map(
    (profileBindings: Immutable.Iterable<number, SparqlClient.Binding>, profile: Rdf.Iri) =>
      constructRelationsFromBindings(profileBindings, categories.get(profile) as Categories)
  ).toMap();
}

function constructRelationsFromBindings(
  bindings: Immutable.Iterable<number, SparqlClient.Binding>, categories: Categories
): Relations {
    return bindings
    .map(
      binding => constructRelationBromBinding(binding, categories)
    ).groupBy(({iri, hasDomain, hasRange}) =>
        RelationKey.key({iri, domain: hasDomain.iri, range: hasRange.iri})
    ).toOrderedMap().map(
      rs => rs.first()
    ) as Relations;
}

function constructRelationBromBinding(
  binding: SparqlClient.Binding, categories: Categories
): Relation {
  const iri = binding[RELATION_PROFILE_VARIABLES.RELATION_PROJECTION_VAR] as Rdf.Iri;
  return {
    iri: iri,
    label: binding[RELATION_PROFILE_VARIABLES.LABEL_PROJECTION_VAR].value,
    description: binding[RELATION_PROFILE_VARIABLES.DESCRIPTION_PROJECTION_VAR].value,
    hasRange: categories.get(
      binding[RELATION_PROFILE_VARIABLES.RELATION_RANGE_PROJECTION_VAR] as Rdf.Iri
    ),
    hasDomain: categories.get(
      binding[RELATION_PROFILE_VARIABLES.RELATION_DOMAIN_PROJECTION_VAR] as Rdf.Iri
    ),
    tuple: binding,
    hashCode: () => Rdf.hashTerm(iri),
    equals: (other: Relation) => iri.equals(other.iri)
  };
}

function constructRelationsFromInline(
  inlineConfigs: Array<InlineRelation>, categories: Categories
): Relations {
    return Immutable.List(inlineConfigs)
      .map(inlineRelation => constructRelationFromInline(inlineRelation, categories))
      .groupBy(({iri, hasDomain, hasRange}) =>
        RelationKey.key({iri, domain: hasDomain.iri, range: hasRange.iri})
      )
      .toOrderedMap()
      .map(rs => rs.first()) as Relations;
}

function constructRelationFromInline(
  inlineConfig: InlineRelation, categories: Categories
): Relation {
  const iri = Rdf.fullIri(inlineConfig.iri);
  return {
    iri: iri,
    label: inlineConfig.label,
    description: inlineConfig.label,
    hasDomain: categories.get(
      Rdf.fullIri(inlineConfig.hasDomain)),
    hasRange: categories.get(
      Rdf.fullIri(inlineConfig.hasRange)),
    tuple: {iri: Rdf.fullIri(inlineConfig.iri), label: Rdf.literal(inlineConfig.label)},
    hashCode: () => Rdf.hashTerm(iri),
    equals: (other: Relation) => iri.equals(other.iri)
  };
}
