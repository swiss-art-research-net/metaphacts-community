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
import { Props as ReactProps, Component, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as URI from 'urijs';
import { findDOMNode } from 'react-dom';
import { debounce, findKey } from 'lodash';
import { Overlay } from 'react-bootstrap';

import { Rdf } from 'platform/api/rdf';
import { resolveIris } from 'platform/api/sparql/SparqlUtil';
import { TemplateItem } from 'platform/components/ui/template';
import { TargetedPopover } from 'platform/components/ui/TargetedPopover';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import * as YasqeInstance from '@triply/yasqe';
type Yasqe = typeof import('@triply/yasqe').Yasqe;
const Yasqe = YasqeInstance as unknown as Yasqe;
import '@triply/yasqe/build/yasqe.min.css';

import * as styles from './SparqlEditor.scss';

const DEFAULT_POPOVER_TEMPLATE = `
<div style="white-space: normal">
<strong><mp-label iri="{{iri}}"></mp-label></strong><br/>
<semantic-query query="SELECT ?description WHERE { <{{iri}}> rdfs:comment|<http://schema.org/description> ?description } LIMIT 1"></semantic-query>
</div>
`;

export interface YasqeValue {
  value: string;
  queryType: string;
  queryMode: string;
}

export interface SparqlEditorProps extends ReactProps<SparqlEditor> {
  onChange?: (value: YasqeValue) => void;
  onBlur?: (value: YasqeValue) => void;
  backdrop?: boolean;
  query?: string;
  size?: {h: number; w: number; };
  /**
   * Function returning a string that will be used to identify
   * cached queries / prefixes from the local storage. If null, it will be used
   * Default: null (since otherwise it will spam local storage if used as a input component
   * i.e. in some forms spread over several instances.)
   *
   */
  persistent?: () => string;
  /**
   * Whether syntax erros should be checked and visually indicated.
   * Default: true
   */
  syntaxErrorCheck?: boolean;
  /**
   * Defines the popover content, expects {{iri}} as a context variable.
   */
  popoverTemplate?: string;
  /**
   * Enables autofocus.
   * @default false
   */
  autofocus?: boolean;
}

export interface State {
  resourceIri?: Rdf.Iri;
  targetTop?: number;
  targetLeft?: number;
  enablePopover?: boolean;
}

export class SparqlEditor extends Component<SparqlEditorProps, State> {
  static defaultProps: Partial<SparqlEditorProps> = {
    popoverTemplate: DEFAULT_POPOVER_TEMPLATE,
  };

  private yasqe: InstanceType<Yasqe>;
  private id: string;

  constructor(props: SparqlEditorProps) {
    super(props);
    this.state = {
      targetTop: 0,
      targetLeft: 0,
      enablePopover: true,
    };
    this.id = Math.random().toString(36).slice(2);
  }

  componentDidMount() {
    const {persistent = null, query, autofocus} = this.props;
    this.yasqe = new Yasqe(findDOMNode(this) as HTMLElement, {
      value: query,
      createShareableLink: (yasqe: Yasqe): string => {
        return new URI(window.location.href)
          .removeQuery('query')
          .addQuery({'query': yasqe.getValue()})
          .toString();
      },
      showQueryButton: false,
      resizeable: false,
      autofocus,
      persistenceId: persistent,
      requestConfig : {
        endpoint: document.URL
      },
      pluginButtons: () => createFullscreenButton(this.id)
    });

    /*
      Disabling syntax error check AFTER the node has been initialized.
      Setting 'syntaxErrorCheck' in the constructor may lead to race conditions.
    */
    if (this.props.syntaxErrorCheck === false) {
      this.yasqe.setOption('syntaxErrorCheck', false);
      this.yasqe.clearGutter('gutterErrorBar');
    }

    if (this.props.onChange) {
      this.yasqe.on('change', this.onChange);
    }

    if (this.props.size) {
      this.yasqe.setSize(this.props.size.w, this.props.size.h);
    } else {
      this.yasqe.setSize(null, 400);
    }

    const wrapper = this.yasqe.getWrapperElement();
    if (wrapper) {
      wrapper.addEventListener('click', this.onMouseClick);
    }
  }

  componentWillReceiveProps(nextProps: SparqlEditorProps) {
    this.__componentWillRecieveProps(nextProps);
  }

  private __componentWillRecieveProps =
    debounce(function (this: SparqlEditor, nextProps: SparqlEditorProps) {
      if (normalizeLineEndings(nextProps.query) !== normalizeLineEndings(this.getQuery().value)) {
        this.setValue(nextProps.query);
      }
    });

  componentWillUnmount() {
    const wrapper = this.yasqe.getWrapperElement();
    if (wrapper) {
      wrapper.removeEventListener('click', this.onMouseClick);
    }
  }

  private onMouseClick = (e: MouseEvent) => {
    this.__onMouseClick(e);
  }

  private __onMouseClick = debounce((e: MouseEvent) => {
    const coords = {
      left: e.clientX + document.documentElement.scrollLeft,
      top: e.clientY + document.documentElement.scrollTop,
    };
    const token = this.yasqe.getTokenAt(this.yasqe.coordsChar(coords));
    const resourceIri = getResourceIriFromToken(token);
    this.setState({resourceIri, targetTop: coords.top, targetLeft: coords.left});
  }, 300);

  private renderPopover() {
    const {popoverTemplate} = this.props;
    const {resourceIri, targetTop, targetLeft, enablePopover} = this.state;
    if (!resourceIri || !enablePopover) { return null; }
    const content = (
      createElement(TemplateItem, {
        template: {source: popoverTemplate, options: {'iri': resourceIri.value}},
      })
    );
    return (
      createElement(
        Overlay,
        {show: true},
        createElement(
          TargetedPopover,
          {
            id: 'sparql-editor-popover',
            targetTop,
            targetLeft,
            popoverSide: 'bottom',
            arrowAlignment: 'center',
          },
          content
        )
      )
    );
  }

  render() {
    return D.div({id: this.id, className: styles.sparqlEditor},
      this.renderPopover()
    );
  }

  getQuery(): YasqeValue {
    return {
      value: this.yasqe.getValue(),
      queryType: this.yasqe.getQueryType(),
      queryMode: this.yasqe.getQueryMode(),
    };
  }

  private setValue = (query: string) => {
    if (typeof query === 'string') {
      this.yasqe.setValue(query);
    }
  }

  private onChange = () => {
    this.props.onChange(this.getQuery());
  }
}

/**
 * We need this function to make sure that we have consistent line endings,
 * independently from OS defaults.
 */
function normalizeLineEndings(str: string) {
  if (!str) { return str; }
  return str.replace(/\r\n|\r/g, '\n');
}

interface SparqlToken {
  type: string;
  string: string;
  state: {
    prefixes: { [prefixKey: string]: string };
  };
}

function getResourceIriFromToken(token: SparqlToken): Rdf.Iri | undefined {
  const {prefixes} = token.state;
  if (token.type === 'string-2') {
    const [prefixKey, resource] = token.string.split(':');
    if (resource) {
      const prefix = prefixes[prefixKey];
      if (prefix) {
        return Rdf.iri(`${prefix}${resource}`);
      }
      try {
        return resolveIris([token.string])[0];
      } catch {
        return undefined;
      }
    }
  } else if (token.type === 'variable-3') {
    const resourceIri = Rdf.fullIri(token.string);
    if (!resourceIri.value.length) {
      return undefined;
    }
    const prefixKey = findKey(prefixes, prefix => prefix === resourceIri.value);
    return prefixKey ? undefined : resourceIri;
  }
  return undefined;
}

// set persistenceId to explicitly return null to prevent caching prefixes
Yasqe.Autocompleters['prefixes'].persistenceId = () => null;
Yasqe.Autocompleters['prefixes'].get = () => {
  return Object.keys(SparqlUtil.RegisteredPrefixes).map(key => {
    return `${key}: <${SparqlUtil.RegisteredPrefixes[key]}>`;
  });
};
Yasqe.Autocompleters['property'].get = (yasqe, token) => {
  return SparqlClient.select(`SELECT ?property WHERE {
  { ?property a owl:DatatypeProperty }
  UNION
  { ?property a owl:ObjectProperty }
  FILTER(REGEX(STR(?property), "${token.autocompletionString}.*", "i"))
} LIMIT 10`).map(res =>
    res.results.bindings.map(item => item['property'].value)
  ).toPromise();
}
Yasqe.Autocompleters['class'].get = (yasqe, token) => {
  return SparqlClient.select(`SELECT ?class WHERE {
  { ?class a rdfs:Class }
  UNION
  { ?class a owl:Class }
  FILTER(REGEX(STR(?class), "${token.autocompletionString}.*", "i"))
} LIMIT 10`).map(res =>
    res.results.bindings.map(item => item['class'].value)
  ).toPromise();
}

function createFullscreenButton(id: string) {
  const button = document.createElement('button');
  button.id = 'fullScreenButton';
  button.className = styles.fullScreenOpenButton;
  let isFullScreen = false;
  button.onclick = (e) => {
    const sparqlEditorArea = document.getElementById(id);
    const codeMirrorElements = document.getElementsByClassName('CodeMirror');
    const codeMirrorElement = codeMirrorElements.item(0);
    const doc = document.querySelector('html');
    if (isFullScreen) {
      sparqlEditorArea.classList.remove(styles.fullScreen);
      codeMirrorElement.classList.remove(styles.sparqlCodeMirrorFullScreen);
      button.className = styles.fullScreenOpenButton;
      doc.style.overflowY = 'auto';
      isFullScreen = false;
    } else {
      sparqlEditorArea.classList.add(styles.fullScreen);
      codeMirrorElement.classList.add(styles.sparqlCodeMirrorFullScreen);
      button.className = styles.fullScreenCloseButton;
      doc.style.overflowY = 'hidden';
      isFullScreen = true;
    }
  };
  return button;
}


