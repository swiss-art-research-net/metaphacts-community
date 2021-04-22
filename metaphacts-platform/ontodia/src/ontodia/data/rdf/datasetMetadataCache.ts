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
import { HashSet } from '../../viewUtils/hashMap';

import { MemoryDataset } from './memoryDataset';
import * as Rdf from './rdfModel';

export interface DatasetMetadataCacheOptions {
    factory: Rdf.DataFactory;
    labelPredicates: ReadonlyArray<string> | undefined;
    guessLabelPredicate: boolean;
    imagePredicates: ReadonlyArray<string> | undefined;
    datatypePredicates: ReadonlyArray<string> | undefined;
}

export class DatasetMetadataCache {
    private readonly defaultLabelPredicates: ReadonlySet<string>;
    private readonly guessLabelPredicate: boolean;

    private labelPredicates = new Map<string, Rdf.NamedNode>();
    private imagePredicates = new Map<string, Rdf.NamedNode>();
    private datatypePredicates = new Map<string, Rdf.NamedNode>();
    private knownResources = new Set<string>();

    constructor(options: DatasetMetadataCacheOptions) {
        const defaultLabelPredicates = new Set<string>();
        if (options.labelPredicates) {
            for (const predicate of options.labelPredicates) {
                defaultLabelPredicates.add(predicate);
            }
        } else {
            defaultLabelPredicates.add('http://www.w3.org/2000/01/rdf-schema#label');
            defaultLabelPredicates.add('http://xmlns.com/foaf/0.1/name');
            defaultLabelPredicates.add('http://schema.org/name');
            defaultLabelPredicates.add('http://www.w3.org/2004/02/skos/core#prefLabel');
            defaultLabelPredicates.add('http://www.w3.org/2004/02/skos/core#label');
            defaultLabelPredicates.add('http://www.w3.org/2004/02/skos/core#altLabel');
        }

        if (options.imagePredicates) {
            for (const predicate of options.imagePredicates) {
                this.imagePredicates.set(predicate, options.factory.namedNode(predicate));
            }
        }

        if (options.datatypePredicates) {
            for (const predicate of options.datatypePredicates) {
                this.datatypePredicates.set(predicate, options.factory.namedNode(predicate));
            }
        }

        this.defaultLabelPredicates = defaultLabelPredicates;
        this.guessLabelPredicate = options.guessLabelPredicate;
    }

    addFrom(quads: ReadonlyArray<Rdf.Quad>) {
        for (const t of quads) {
            if (t.predicate.termType === 'NamedNode' && this.looksLikeLabelPredicate(t.predicate)) {
                if (!this.labelPredicates.has(t.predicate.value)) {
                    this.labelPredicates.set(t.predicate.value, t.predicate);
                }
                // assume that we know about resource if there is a label for it
                this.knownResources.add(t.subject.value);
            }
        }
    }

    hasResourceInfo(resourceIri: string): boolean {
        return this.knownResources.has(resourceIri);
    }

    findLabels(dataset: MemoryDataset, subject: Rdf.NamedNode | Rdf.BlankNode): Rdf.Literal[] {
        const result = new HashSet<Rdf.Literal>(Rdf.hashTerm, Rdf.equalTerms);
        this.labelPredicates.forEach(predicate => {
            for (const t of dataset.iterateMatches(subject, predicate, undefined)) {
                if (t.object.termType === 'Literal') {
                    result.add(t.object);
                }
            }
        });
        return Array.from(result);
    }

    isLabelPredicate(predicate: Rdf.NamedNode): boolean {
        return this.labelPredicates.has(predicate.value);
    }

    private looksLikeLabelPredicate(predicate: Rdf.NamedNode): boolean {
        if (this.defaultLabelPredicates.has(predicate.value)) {
            return true;
        }
        if (this.guessLabelPredicate && /(?:prefLabel|prefName|label|name|name)$/i.test(predicate.value)) {
            return true;
        }
        return false;
    }

    findImages(dataset: MemoryDataset, subject: Rdf.NamedNode | Rdf.BlankNode): string[] {
        const set = new Set<string>();
        this.imagePredicates.forEach(predicate => {
            for (const t of dataset.iterateMatches(subject, predicate, undefined)) {
                if (t.object.termType === 'NamedNode' || t.object.termType === 'Literal') {
                    set.add(t.object.value);
                }
            }
        });
        const result: string[] = [];
        set.forEach(image => result.push(image));
        return result;
    }

    isImagePredicate(predicate: Rdf.NamedNode): boolean {
        return this.imagePredicates.has(predicate.value);
    }

    isDatatypePredicate(predicate: Rdf.NamedNode): boolean {
        return this.datatypePredicates.has(predicate.value);
    }

    isDatatypeProperty(predicate: Rdf.NamedNode, value: Rdf.Term): boolean {
        if (value.termType === 'Literal') {
            return true;
        }
        return this.datatypePredicates.has(predicate.value) &&
            (value.termType === 'NamedNode' || value.termType === 'BlankNode');
    }
}
