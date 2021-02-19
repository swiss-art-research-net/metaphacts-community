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
import * as Immutable from 'immutable';
import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';

import { Cancellation } from 'platform/api/async';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { addNotification } from 'platform/components/ui/notification';
import { refresh, navigateToResource } from 'platform/api/navigation';
import { RDFGraphStoreService } from 'platform/api/services/rdf-graph-store';

const { rdf, rdfs } = vocabularies;
const OWL_ONTOLOGY = Rdf.iri('http://www.w3.org/2002/07/owl#Ontology');

interface CreateOntologyState {
  alertState?: AlertConfig;
  namespace?: string;
  iri: string;
  title: string;
  previousTitle?: string;
}

interface CreateOntologyConfig {
  /**
   * Optional post-action to be performed after a new ontology have been created.
   * Can be either 'reload' or 'redirect' (redirects to the newly created resource)
   * or any IRI string to which the form will redirect.
   */
  postAction?: 'none' | 'reload' | 'redirect';

  /**
   * The base IRI for creating the ontology IRI
   *
   * @default http://ontologies.metaphacts.com/
   */
  baseIri?: string;
}

export type CreateOntologyProps = CreateOntologyConfig;

/**
 * Component which allows users to create a new ontology
 * by defining IRI and rdf:label of ontology.
 */
export class CreateOntology extends React.Component<CreateOntologyProps, CreateOntologyState> {
  private readonly cancellation = new Cancellation();
  static defaultProps: Required<Pick<CreateOntologyProps, 'baseIri'>> = {
    baseIri: 'http://ontologies.metaphacts.com/'
  };

  constructor(props: CreateOntologyProps, context: any) {
    super(props, context);

    this.state = {
      alertState: undefined,
      iri: props.baseIri,
      title: '',
      namespace: props.baseIri
    };

  }

  updateIriFromTitle = () => {
    const iri = normalizeIri(this.iriFromTitle(this.state.iri));
    this.setState({ iri: iri });
  }

  updateNamespaceFromTitle = () => {
    const {namespace} = this.state;
    let iri = this.endsWithSlashOrHash(namespace) ? namespace.slice(0,-1) : namespace;
    iri = normalizeIri(this.iriFromTitle(iri));
    if (!this.endsWithSlashOrHash(iri)) {
      iri = iri + '/';
    }
    this.setState({ namespace: iri });
  }

  endsWithSlashOrHash = (str: string): boolean => {
    return str.endsWith('/') || str.endsWith('#');
  }

  /**
   * create the ontology IRI based on the title provided by the user.
   *
   * Pattern:
   *
   * %currentIri% + %ESCAPED_LOWER_CASE_TITLE%
   */
  iriFromTitle = (iri: string): string => {
    if (!iri) { return ''; }
    const { title, previousTitle } = this.state;
    // decode URI component, replace space with _, and non-alphanumeric with ""
    const titleDecoded = decodeURIComponent(title.toLowerCase()
      .replace(/ /g, '_').replace(/\W/g, ''));
    const hashFragment = iri.lastIndexOf('#') > 1 ? iri.substring(iri.lastIndexOf('#')) : '';
    try {
      const url = new URL(iri);
      if (!url.pathname) { url.pathname = '/'; }
      if (!previousTitle) {
        url.pathname = url.pathname + titleDecoded;
      } else {
        const previousTitleDecoded = decodeURIComponent(previousTitle.toLowerCase()
          .replace(/ /g, '_').replace(/\W/g, ''));
        // replace the last occurrence of the previous title string
        // this is to avoid that shorter tokens to not replace strings in high/manually
        // entered path elements
        let pos = url.pathname.lastIndexOf(previousTitleDecoded);
        if (pos !== -1) {
          const str = url.pathname.substring(0, pos) + titleDecoded
            + url.pathname.substring(pos + previousTitleDecoded.length);
          url.pathname = str;
        }
      }

      return url.toString() + hashFragment;
    } catch { /* do nothing */ }

    return iri; // in the worst case do nothing

  }

  createOntology() {
    const { iri, title: label, namespace } = this.state;
    const normalizedIri = normalizeIri(iri);
    const targetGraph = Rdf.iri(`${normalizedIri}/graph`);
    const ontologyIri = Rdf.iri(normalizeIri(iri));
    const repository = this.getRepository();

    const graphData = new Rdf.Graph(Immutable.Set([
      Rdf.triple(
        ontologyIri,
        rdf.type,
        OWL_ONTOLOGY
      ),
      Rdf.triple(
        ontologyIri,
        Rdf.iri('http://purl.org/dc/terms/title'),
        Rdf.literal(label)
      ),
      Rdf.triple(
        ontologyIri,
        Rdf.iri('http://www.linkedmodel.org/1.2/schema/vaem#namespace'),
        Rdf.iri(namespace)
      ),
      Rdf.triple(
        ontologyIri,
        rdfs.label,
        Rdf.literal(label)
      ),
    ]));

    const createGraph = RDFGraphStoreService.createGraph({targetGraph, graphData, repository});

    this.cancellation.map(createGraph).observe({
      value: () => {
        addNotification({
          message: `Ontology ${normalizedIri} was successfully created!`,
          level: 'success',
        });
        this.setState({
          alertState: {
            alert: AlertType.SUCCESS,
            message: `Ontology ${normalizedIri} was successfully created!`,
          },
          iri: normalizedIri,
        }, () => {
          this.performPostAction();
        });
      },
      error: error => {
        addNotification({
          message:
            `Error has occurred during the ontology creation process ontology iri: ${normalizedIri}!`,
          level: 'error',
        });
        this.setState({
          alertState: {
            alert: AlertType.WARNING,
            message: error,
          },
          iri: normalizedIri,
        });
      },
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const { alertState, iri, title: label, namespace } = this.state;
    const alert = this.state.alertState ? <Alert {...alertState}></Alert> : null;
    const iriIsCorrect = !iri || checkIri(iri);
    const caCreateOntology = iri && label && iriIsCorrect && !alert;
    const errorStyle = {
      borderColor: '#F04124',
      boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
    };
    return <div style={{
      display: 'flex',
      flexDirection: 'column',
    }}>
      {alert}
      <label>Ontology Title</label>
      <input
        value={label}
        placeholder={'Enter the ontology title...'}
        title={'New ontology title'}
        onChange={event => {
          this.setState({
            previousTitle: this.state.title,
            title: event.target.value,
            alertState: null
          }, () => {
            this.updateIriFromTitle();
            this.updateNamespaceFromTitle();
          });
        }}
        className='form-control'/>
      <label>Ontology IRI</label>
      <input
        value={iri}
        placeholder={'Enter the new ontology IRI...'}
        title={'New ontology IRI'}
        onChange={event => {
          this.setState({
            iri: event.target.value,
            alertState: null
          });
        }}
        className='form-control'
        style={!iriIsCorrect ? errorStyle : {}}
      />
      <label>Base Element Namespace (IRI)</label>
      <input
        value={namespace}
        placeholder={'Enter a namespace (IRI) for ontology elements...'}
        title={'Namespace used as default for all ontology elements to be created within this ontology. Must end with / or #.'}
        onChange={event => {
          const v = event.target.value;
          this.setState({
            namespace: v,
            alertState: this.endsWithSlashOrHash(v) ? null : {
              alert: AlertType.DANGER, message: 'Base Element Namespace must end with / or #'
            }
          });
        }}
        className='form-control'
        style={!iriIsCorrect ? errorStyle : {}}
      />

      <div style={{marginTop: 10}}>
        <button
          disabled={!caCreateOntology}
          type='button'
          title={caCreateOntology ? `Create ontology ${iri}` : iriIsCorrect ? 'You should fill all fields' : 'Iri is incorrect'}
          onClick={() => {
            this.createOntology();
          }}
          className='btn btn-primary'>
          Create new Ontology
        </button>
      </div>
    </div>;
  }

  private getRepository() {
    return this.context && this.context.semanticContext && this.context.semanticContext.repository ?
      this.context.semanticContext.repository : 'default';
  }

  /**
   * Performs either a reload (default) or an redirect after the form as been submitted
   * and the data been saved.
   */
  private performPostAction = (): void => {
    const { postAction } = this.props;
    const { iri } = this.state;

    if (postAction === 'none') { return; }

    if (!postAction || postAction === 'reload') {
      refresh();
    } else if (this.props.postAction === 'redirect') {
      navigateToResource(
        Rdf.iri(iri),
        getPostActionUrlQueryParams(this.props)
      ).onValue(v => v);
    } else {
      let params = getPostActionUrlQueryParams(this.props);
      params['ontologyIri'] = iri;
      navigateToResource(
        Rdf.iri(this.props.postAction),
        params
      ).onValue(v => v);
    }
  }
}

function normalizeIri(rawIri: string) {
  if (!rawIri) { return undefined; }
  let url: URL;

  try { // normalize path
    url = new URL(rawIri); // The exception could be throw here if rawIri is not URL
    url.pathname = url.pathname.split('/').filter(token => Boolean(token)).join('/');
    if (!url.pathname) { url.pathname = '/'; }
    rawIri = decodeURIComponent(url.href);
  } catch { /* do nothing */ }

  if (rawIri.endsWith('#')) {
    return rawIri.substring(0, rawIri.length - 1);
  } else {
    return rawIri;
  }
}

function checkIri(iri: string) {
  try {
    if (!iri) {
      return false;
    }
    let path = new URL(iri).pathname || '';
    if (path.startsWith('/')) {
      path = path.substring(1, path.length);
    }
    if (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }
    return !path || path.split('/').filter(token => !Boolean(token)).length === 0;
  } catch {
    return false;
  }
}

export default CreateOntology;

const POST_ACTION_QUERY_PARAM_PREFIX = 'urlqueryparam';

/**
 * Extracts user-defined `urlqueryparam-<KEY>` query params from
 * a form configuration to provide them on post action navigation.
 */
function getPostActionUrlQueryParams(props: CreateOntologyProps) {
  const params: { [paramKey: string]: string } = {};

  for (const key in props) {
    if (Object.hasOwnProperty.call(props, key)) {
      if (key.indexOf(POST_ACTION_QUERY_PARAM_PREFIX) === 0) {
        const queryKey = key.substring(POST_ACTION_QUERY_PARAM_PREFIX.length).toLowerCase();
        params[queryKey] = props[key as keyof CreateOntologyProps];
      }
    }
  }

  return params;
}
