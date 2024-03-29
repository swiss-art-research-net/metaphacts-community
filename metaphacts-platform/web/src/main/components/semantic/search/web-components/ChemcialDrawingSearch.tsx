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
import * as _ from 'lodash';
import * as Maybe from 'data.maybe';
import * as SparqlJs from 'sparqljs';
import {
  Row, Col, InputGroup, FormGroup, Button, ButtonGroup, FormControl, FormCheck, Alert,
} from 'react-bootstrap';
import { ketcherui, smiles, molfile } from 'ketcher';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

import { Cancellation } from 'platform/api/async';
import { Component, SemanticContext } from 'platform/api/components';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { SmilesCodeDrawer } from 'platform/components/3-rd-party/SmilesCodeDrawer';
import { getOverlaySystem, OverlayDialog} from 'platform/components/ui/overlay';
import { LoadingBackdrop } from 'platform/components/utils';

import { setSearchDomain } from '../commons/Utils';
import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';

/**
 * **Example**:
 * ```
 * <semantic-search>
 *   <semantic-search-query-chemical-drawing
 *     query='SELECT ?compound WHERE { }'
 *     search-queries='{"exact": "SELECT ?compound WHERE { ?compound rdfs:label ?smilesCode }"}'>
 *   </semantic-search-query-chemical-drawing>
 *   <semantic-search-result-holder>
 *     <semantic-search-result>
 *       <semantic-table id="table" query="SELECT ?subject WHERE { }"></semantic-table>
 *     </semantic-search-result>
 *   </semantic-search-result-holder>
 * </semantic-search>
 * ```
 */
interface ChemicalDrawingSearchConfig {
  /**
   * SPARQL SELECT query string, which will be provided to the search framework as base query.
   *
   * The query string will be parameterized through the values as selected by the user from
   * auto-suggestion list, which is generated through the `search-query`. Selected values will be
   * injected using the same binding variable names as specified by the `projection-bindings`
   * attribute i.e. effectively using the same variable name as returned by the `search-query`.
   */
  query: string;

  /**
   * SPARQL SELECT query string which is used to provide a autosuggestion list of resources.
   *
   * Needs to expose result using a projection variable equal to the `resource-binding-name`
   * attribute.
   *
   * **Example**:
   * ```
   * search-queries='{
   *   "exact": "SELECT ?compound ?similarity WHERE {
   *     ?x :smilesCode ?smilesCode .
   *     BIND(100 as ?similarity)
   *   }",
   *   "substructure": "SELECT ?compound ?similarity WHERE {
   *     SERVICE <:Substructure> {
   *       ?x :smilesCode ?smilesCode;
   *         :similarity ?similarity.
   *     }
   *   }",
   *   "similarity": "SELECT ?compound ?similarity WHERE {
   *     SERVICE <:Similarity> {
   *       ?x :smilesCode ?smilesCode;
   *         :similarity ?similarity.
   *     }
   *   }"
   * }'
   * ```
   */
  searchQueries: ChemicalDrawingSearchQueries;

  /**
   * Name of the bind variable used to inject the smiles code.
   *
   * @default "smilesCode"
   */
  smilesBindingName?: string;

  /**
   * Name of the bind variable used to inject the similarity threshold.
   *
   * @default "similarityThreshold"
   */
  similarityThresholdBindingName?: string;

  /**
   * String array of projection variables from the `search-queries` which
   * should be injected as values into the main `query`.
   *
   * @default ["compound", "similarity"]
   */
  projectionBindings?: string[];

  /**
   * Whether the smiles code should be render as canvas next to search panel
   * i.e. when the ketcher drawing modal is not shown.
   *
   * @default true
   */
  renderSmilesCode?: boolean;

  /**
   * Initial smiles code that should be set and
   * rendered when initially rendering the component.
   *
   * @default undefined
   */
  exampleSmilesCode?: string;

  /**
  * Specify search domain category IRI (full IRI enclosed in `<>`).
  * Required, if component is used together with facets.
  */
  domain?: string;
}

interface ChemicalDrawingSearchQueries {
  exact?: string;
  similarity?: string;
  substructure?: string;
}

export type ChemicalDrawingSearchProps = ChemicalDrawingSearchConfig;

export class ChemicalDrawingSearch extends Component<ChemicalDrawingSearchProps, {}> {
  render() {
    const {semanticContext} = this.context;
    return (
      <SemanticSearchContext.Consumer>
        {context => (
          <ChemicalDrawingSearchInner {...this.props}
            context={{...context, semanticContext}}
          />
        )}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends ChemicalDrawingSearchProps {
  context: InitialQueryContext & SemanticContext;
}

enum Modes { SIMILARITY = 'similarity', EXACT = 'exact', SUBSTRUCTURE = 'substructure' }

interface State {
  isLoading?: boolean,
  showModal?: boolean,
  isNoResult?: boolean,
  smilesCode?: string,
  moleString?: string,
  mode?: Modes,
  errorMessage: string,
  similarityThreshold: number
}

class ChemicalDrawingSearchInner extends React.Component<InnerProps, State> {
    private readonly cancellation = new Cancellation();
    private readonly OVERLAY_ID = 'drawing-overlay';

    static defaultProps = {
        query: `
            SELECT * WHERE {
            }
        `,
        smilesBindingName: 'smilesCode',
        similarityThresholdBindingName: 'similarityThreshold',
        renderSmilesCode: true,
        projectionBindings: ['compound', 'similarity'],
    };

    constructor(props: InnerProps) {
        super(props);
        this.state = {
            isLoading: false,
            isNoResult: false,
            showModal: false,
            errorMessage: undefined,
            similarityThreshold: 100,
            mode: Modes.EXACT,
            smilesCode: props.exampleSmilesCode ?  props.exampleSmilesCode : undefined,
        };
    }

    componentDidMount() {
        setSearchDomain(this.props.domain, this.props.context);
    }

    componentWillReceiveProps(props: InnerProps) {
      const {context} = props;
      if (context.searchProfileStore.isJust && context.domain.isNothing) {
        setSearchDomain(props.domain, context);
      }
    }

    renderKetcher = (element: HTMLElement | null) => {
        if (!element) {
            return;
        }
       const ui = ketcherui(element, {});

        if (this.state.moleString) {
            ui.load(this.state.moleString);
        }
    }

    getSmilesCode = (): string => {
        return smiles.stringify(this.getStructureFromKetcher(), {ignoreErrors: true });
    }

    getMoleString =  (): string => {
        return molfile.stringify(this.getStructureFromKetcher(), { ignoreErrors: true });
    }

    getStructureFromKetcher = () => {
        return (window as any)['_ui_editor'].struct();
    }

    getSearchQuery = () => {
        return this.props.searchQueries[this.state.mode];
    }

    onSearch = () => {
        this.setState({isLoading: true, errorMessage: undefined, isNoResult: undefined});
       // console.log(molfile.stringify(window['_ui_editor'].struct(), {ignoreErrors: true }));

       // reset search if selection is emtpy e.g. after removal of initial selections
        if (!this.state.smilesCode)     {
            return this.props.context.setBaseQuery(Maybe.Nothing());
        }

        const parsedQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(
            this.getSearchQuery()
        );

        const {smilesBindingName, similarityThresholdBindingName} = this.props;
        const {smilesCode, similarityThreshold} = this.state;

        const xsd = vocabularies.xsd;
        const query = SparqlClient.setBindings(
            parsedQuery, {
                [smilesBindingName] : Rdf.literal(smilesCode, xsd._string),
                [similarityThresholdBindingName] : Rdf.literal(String(similarityThreshold), xsd.integer),
            }
        );
        // execute the search query, i.e. to find exact, substructure or similar results
        this.cancellation.map(
            SparqlClient.select(query, {context: this.props.context.semanticContext})
          ).observe({
            value: selectResult => this.handleResult(selectResult),
            error: (error: Error & { statusText?: string; responseText?: string }) => {
                this.setState({
                  isLoading: false,
                  errorMessage: error.message || error['statusText'] || error['responseText'],
                  });
            },
          });

    }

    private handleResult = (res: SparqlClient.SparqlSelectResult) => {
        if (SparqlUtil.isSelectResultEmpty(res)) {
            this.setState({isLoading: false, isNoResult: true});
            return;
        }
        const values: SparqlClient.Binding[] = [];
        _.forEach(res.results.bindings, binding => {
            const value: { [bindingName: string]: Rdf.Node } = {};
            this.props.projectionBindings.map(projectionName => {
                if (binding[projectionName]) {
                    value[projectionName] = binding[projectionName];
                }
            });
            values.push(value);
        });
        const parsedMainQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(
            this.props.query
        );
        this.props.context.setBaseQuery(
            Maybe.Just<SparqlJs.SelectQuery>(
                SparqlClient.prepareParsedQuery(values)(parsedMainQuery)
            )
        );
        this.setState({ isLoading: false, isNoResult: false });
    }

    public componentWillUnmount () {
        // cleanup global window var before unmounting
        (window as any)['_ui_editor'] = null;
    }

    componentDidUpdate(prevProps: InnerProps, prevState: State) {
        const {errorMessage, isNoResult} = this.state;
        if (
            (errorMessage !== prevState.errorMessage
            || prevState.isNoResult !== isNoResult)
            && (errorMessage || isNoResult)
        ) {
            this.props.context.setBaseQuery(Maybe.Nothing());
        }
    }

    public render () {
        if (!this.props.query) {
            throw new Error(`The mandatory configuration attribute "query" is not set.`);
        }
        if (!this.props.searchQueries) {
            throw new Error(`The mandatory configuration attribute "search-queries" is not set.`);
        }

        const {
            searchQueries, renderSmilesCode,
        } = this.props;

        const {mode, errorMessage, isNoResult} = this.state;
        const formControlStyle = {padding: '0px', margin: '0px'};
        return (
            <div>
                {this.state.isLoading ? <LoadingBackdrop/> : null}
                <Row style={{'display': 'flex', alignItems: 'center'}}>
                    <Col sm={4} className='text-center'>
                    {   this.state.smilesCode && renderSmilesCode
                            ? <SmilesCodeDrawer
                                smilesCode={this.state.smilesCode}
                                style={{width: '200px', height: '200px'}}/>
                            : null }
                    </Col>
                    <Col sm={8} >
                        <Row>
                            <Col sm={7}>
                                <form>
                                    <FormGroup>
                                        <InputGroup>
                                        <FormControl
                                            style={formControlStyle}
                                            type='text'
                                            value={this.state.smilesCode}
                                            disabled={true}/>
                                        <InputGroup.Append
                                            style={{
                                                borderRadius: '4px',
                                                borderTopLeftRadius: 0,
                                                borderBottomLeftRadius: 0,
                                            }}
                                            onClick={() => this.showModal()}>
                                            <InputGroup.Text>
                                              <i className='fa fa-pencil' title='Draw Structure'>
                                              </i>
                                            </InputGroup.Text>
                                        </InputGroup.Append>

                                        </InputGroup>
                                    </FormGroup>
                                </form>
                            </Col>
                        </Row>
                        <FormGroup>
                            <Row>
                                <Col sm={2}>
                                    <FormCheck type='radio'
                                        name='radioGroup'
                                        onChange={() => this.setState({ mode: Modes.EXACT })}
                                        checked={mode === 'exact' ? true : false}
                                        disabled={searchQueries.exact ? false : true}
                                        label={searchQueries.exact
                                            ? 'Exact'
                                            : this.getDisabledModeLabel('Exact')
                                        }
                                    >
                                    </FormCheck>
                                </Col>
                                <Col sm={2}>
                                    <FormCheck type='radio'
                                        name='radioGroup'
                                        onChange={() => this.setState({ mode: Modes.SUBSTRUCTURE})}
                                        checked={mode === 'substructure' ? true : false}
                                        disabled={searchQueries.substructure ? false : true}
                                        label={searchQueries.substructure
                                            ? 'Substructure'
                                            : this.getDisabledModeLabel('Substructure')
                                        }
                                    >
                                    </FormCheck>
                                </Col>
                                <Col sm={3}>
                                    <FormCheck type='radio'
                                        name='radioGroup'
                                        onChange={() => this.setState({ mode: Modes.SIMILARITY })}
                                        checked={mode === 'similarity' ? true : false}
                                        disabled={searchQueries.similarity ? false : true}
                                        label={searchQueries.similarity
                                            ? 'Similarity  (Threshold: '+ this.state.similarityThreshold+'%)'
                                            : this.getDisabledModeLabel(
                                                'Similarity  (Threshold: '+ this.state.similarityThreshold+'%)'
                                            )
                                        }
                                    >
                                    </FormCheck>
                                </Col>
                                <Col sm={2}>
                                    <Button
                                        variant='primary'
                                        size='sm'
                                        onClick={this.onSearch}>
                                            Search
                                    </Button>
                                </Col>
                            </Row>
                        </FormGroup>
                        <Row>
                                <Col sm={{span: 3, offset: 4}}>
                                    { this.state.mode === 'similarity' ?
                                        <Slider min={0} max={100}
                                            value={this.state.similarityThreshold}
                                            onChange={val => this.setSimilarity(val)}
                                        /> : null
                                    }
                                </Col>
                        </Row>
                        {isNoResult ? <Row>
                            <Col sm={8}>
                                <strong>
                                    Search query did not return any matching compounds for search mode {this.state.mode.toString()}.
                                </strong>
                            </Col>
                        </Row> : null}
                        {errorMessage ? <Row>
                            <Col sm={8}>
                                <Alert variant='warning'>
                                    <strong>Error during execution of the search query:</strong> <br/>
                                        {this.state.errorMessage}
                                </Alert>
                            </Col>
                        </Row> : null}

                </Col>
            </Row>
            </div>);
    }

    setSimilarity = (threshold: number) => {
        this.setState({similarityThreshold: threshold});
    }

    getDisabledModeLabel = (label: string) => {
        return (<span title='Disabled. Query currently not configured.' style={{color: 'grey'}}>
            {label}
        </span>);
    }

    showModal = () => {

        getOverlaySystem().show(
            this.OVERLAY_ID,
            <OverlayDialog
              type='modal'
              bsSize='lg'
              onHide={() => getOverlaySystem().hideAll()}
              show={true}
              title={undefined}
            >
                <style dangerouslySetInnerHTML={{__html: `
                    main[role="application"] {width: 800px!important;  height: 80vh!important; }
                `}} />

                <div className='ketcher-bundle' ref={this.renderKetcher} />
                <ButtonGroup className='pull-right'>
                    <Button size='sm' onClick={() => this.hideModal()}>
                        Cancel
                    </Button>
                    <Button
                        variant='primary' size='sm'
                        onClick={() => this.hideModal(this.getSmilesCode(), this.getMoleString())}>
                        Set As Input
                    </Button>
                </ButtonGroup>
            </OverlayDialog>
        );
    }

    hideModal = (smilesCode?: string, moleString?: string) => {
        if (smilesCode && moleString) {
            this.setState({smilesCode: smilesCode, moleString: moleString, showModal: false},
                () => getOverlaySystem().hideAll());
        } else {
            this.setState({showModal: false},
                () => getOverlaySystem().hideAll());
            }
    }




}

export default ChemicalDrawingSearch;
