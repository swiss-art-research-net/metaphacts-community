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

import { Rdf, vocabularies } from 'platform/api/rdf';
import { Template, Argument } from 'platform/components/query-editor';
import { LdpService, LdpServiceContext } from './ldp';
import { includes } from 'lodash';

const { VocabPlatform, xsd, rdf, rdfs, spl, spin, dct } = vocabularies;

const DEFAULT_NAMESPACE = 'http://metaphacts.com/query/';
const CATEGORIES_PREDICATE = dct.subject;


export class QueryTemplateServiceClass extends LdpService {

  public addItem(template: Template, queryIri: string, namespace: string): Kefir.Property<{}> {
    const graph = this.createGraph(template, queryIri, namespace);
    return this.addResource(graph, maybe.Just(template.identifier));
  }

  public updateItem(
    iri: Rdf.Iri, template: Template, queryIri: string, namespace: string
  ): Kefir.Property<{}> {
    const graph = this.createGraph(template, queryIri, namespace);

    return this.update(iri, graph);
  }

  private createGraph(
    template: Template, queryIri: string, namespace = DEFAULT_NAMESPACE
  ): Rdf.Graph {
    const {identifier, label, description, args} = template;
    const subject = Rdf.iri('');

    const argsTriples = args.map((arg, index) => {
      const argIri = Rdf.iri(namespace + identifier + '/arg/' + index);

      const triples = [
        Rdf.triple(
          subject, spin.constraintProp, argIri
        ),
        Rdf.triple(
          argIri, rdf.type, spl.Argument
        ),
        Rdf.triple(
          argIri, rdfs.label, Rdf.literal(arg.label)
        ),
        Rdf.triple(
          argIri,
          spl.predicateProp,
          Rdf.iri(namespace + identifier + '/predicate/' + arg.variable)
        ),
        Rdf.triple(
          argIri, spl.valueTypeProp, Rdf.iri(arg.valueType)
        ),
      ];

      if (arg.defaultValue) {
        triples.push(Rdf.triple(argIri, spl.defaultValue, arg.defaultValue));
      }

      // serialize default to false i.e. by default values should not be optional
      const optional = arg.optional !== undefined ? arg.optional : false;
      triples.push(
        Rdf.triple(
          argIri, spl.optionalProp, Rdf.literal(optional, xsd.boolean)
        )
      );

      if (arg.comment !== undefined) {
        triples.push(
          Rdf.triple(
            argIri, rdfs.comment, Rdf.literal(arg.comment)
          )
        );
      }
      return triples;
    });

    const mergedArgsTriples: Rdf.Triple[] = ([] as Rdf.Triple[]).concat.apply([], argsTriples);
    const categories = template.categories.map(
      category => Rdf.triple(subject, CATEGORIES_PREDICATE, category));

    return Rdf.graph([
      Rdf.triple(subject, rdf.type, spin.Template),
      Rdf.triple(subject, rdf.type, template.templateType),
      Rdf.triple(subject, rdfs.label, Rdf.literal(label)),
      Rdf.triple(subject, rdfs.comment, Rdf.literal(description)),
      Rdf.triple(subject, spin.bodyProp, Rdf.iri(queryIri)),
      ...mergedArgsTriples,
      ...categories,
    ]);
  }

  public getQueryTemplate(iri: Rdf.Iri): Kefir.Property<{template: Template, queryIri: string}> {
    return this.get(iri).map(graph => this.parseGraphToQueryTemplate(iri, graph));
  }

  private parseGraphToQueryTemplate(
    iri: Rdf.Iri,
    graph: Rdf.Graph
  ): {template: Template, queryIri: string} {
    const templateTypes = [spin.AskTemplate,
                           spin.SelectTemplate,
                           spin.ConstructTemplate,
                           spin.UpdateTemplate].map( qt => qt.value);
    const templateType = graph.triples
        .find(
          t => t.p.equals(rdf.type) &&
                  includes(templateTypes, t.o.value)
        ).o as Rdf.Iri;

    const argsIris = graph.triples
      .filter(
        t => t.s.equals(iri) && t.p.equals(spin.constraintProp)
      )
      .toArray()
      .map(item => item.o);

    const args = argsIris.map((item): Argument => {
      const label = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(rdfs.label)).o.value;
      const variable = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(spl.predicateProp)).o.value;
      const comment = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(rdfs.comment)).o.value;
      const optional = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(spl.optionalProp));
      const valueType = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(spl.valueTypeProp)).o.value;
      const defaultValue = graph.triples.find(
        t => t.s.equals(item) && t.p.equals(spl.defaultValue) && Rdf.isNode(t.o));

      return {
        label: label,
        variable: this.extractValueFromIri(variable),
        comment: comment,
        valueType: valueType,
        defaultValue: defaultValue ? defaultValue.o as Rdf.Node : undefined,
        optional: optional ? (optional.o.value === 'true') : false,
      };
    });

    const template: Template = {
      templateType: templateType,
      identifier: this.extractValueFromIri(iri.value),
      label: graph.triples.find(t => t.s.equals(iri) && t.p.equals(rdfs.label)).o.value,
      description: graph.triples.find(t => t.s.equals(iri) && t.p.equals(rdfs.comment)).o.value,
      categories: graph.triples
        .filter(t => t.s.equals(iri) && t.p.equals(CATEGORIES_PREDICATE) && Rdf.isIri(t.o))
        .map(t => t.o as Rdf.Iri).toArray(),
      args: args,
    };

    const queryIri = graph.triples.find(t => t.s.equals(iri) && t.p.equals(spin.bodyProp)).o.value;

    return {template, queryIri};
  }

  /**
   * Return substring after last '/'
   */
  private extractValueFromIri(iri: string): string {
    return /[^/]*$/.exec(iri)[0];
  }
}


export const QueryTemplateService = function(context: LdpServiceContext){
  return new QueryTemplateServiceClass(VocabPlatform.QueryTemplateContainer.value, context);
};
