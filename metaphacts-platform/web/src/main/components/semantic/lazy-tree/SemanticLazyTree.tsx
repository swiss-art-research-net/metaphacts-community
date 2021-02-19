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
import { ErrorPresenter } from 'platform/components/ui/notification';
import { Alert } from 'react-bootstrap';
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import * as SparqlJs from 'sparqljs';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { ModuleRegistry } from 'platform/api/module-loader';
import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, SparqlClient } from 'platform/api/sparql';
import { CompiledTemplate, mergeInContextOverride } from 'platform/api/services/template';

import { ClearableInput, ClearableInputProps } from 'platform/components/ui/inputs';
import { Spinner } from 'platform/components/ui/spinner';

import { KeyedForest, KeyPath, Traversable } from './KeyedForest';
import { TreeSelection } from './TreeSelection';
import { SingleFullSubtree } from './SelectionMode';
import {
  TreeNode, ForestChange, expandPath, loadExistingPathInParallel, queryMoreChildren,
} from './NodeModel';
import {
  Node, TreeQueryPatterns, NodeDataPatterns, SparqlNodeModel, sealLazyExpanding,
} from './SparqlNodeModel';
import { LazyTreeSelector, LazyTreeSelectorProps } from './LazyTreeSelector';

import * as inputStyles from './SemanticTreeInput.scss';
import * as lazyTreeStyles from './SemanticLazyTree.scss';
import { LinkComponent } from 'platform/components/navigation/Link';
import { constructUrlForResourceSync } from 'platform/api/navigation/Navigation';

/**
 * Tree visualization component which provides ability to lazily render and
 * search in large hierarchies by providing set of queries.
 *
 * **Example:**
 * ```
 * <semantic-lazy-tree
 *   roots-query='
 *     SELECT ?item WHERE {
 *       ?item a owl:Class .
 *       FILTER NOT EXISTS { ?item rdfs:subClassOf ?parentClass }
 *     }
 *   '
 *   children-query='
 *     SELECT ?item WHERE {
 *       ?item rdfs:subClassOf ?parent .
 *     }
 *   '
 *   parents-query='
 *     SELECT ?item ?parent WHERE {
 *       ?item rdfs:subClassOf ?parent .
 *     }
 *   '
 *   search-query='
 *     SELECT DISTINCT ?item ?label ?score ?hasChildren WHERE {
 *       ?item a owl:Class .
 *       ?item rdfs:label ?label .
 *       BIND(false AS ?hasChildren)
 *       FILTER REGEX(LCASE(?label), LCASE(?__token__), "i")
 *     } ORDER BY DESC (?score) (?label) LIMIT 200
 *   '
 *   placeholder='Select or search for a class..'>
 * </semantic-lazy-tree>
 * ```
 */
interface SemanticLazyTreeConfig extends TreeQueryPatterns, NodeDataPatterns {
  /**
   * Optional custom class for the tree.
   */
  className?: string;

  /** Empty field placeholder. */
  placeholder?: string;

  /**
   * A flag determining whether any special Lucene syntax will
   * be escaped in the `search-query` pattern. When `false` lucene
   * syntax in the user input is not escaped.
   *
   * Deprecated: escaping will be applied automatically based on SPARQL query.
   *
   * @deprecated Escaping will be applied automatically based on SPARQL query.
   */
  escapeLuceneSyntax?: boolean;

  /**
   * A flag determining whether the user input is tokenized by
   * whitespace into words postfixed by `*` in the `search-query` pattern.
   * E.g. the search for `Hello World` becomes `Hello* World*`.
   *
   * Deprecated: tokenization will be applied automatically based on SPARQL query.
   *
   * @deprecated Tokenization will be applied automatically based on SPARQL query.
   */
  tokenizeLuceneQuery?: boolean;

  /**
   * Template which is used to render every tree node.
   *
   * By default `<semantic-link>` component is used for node visualization.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  nodeTemplate?: string;

  /**
   * Template which is applied when the query returns no results.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  noResultTemplate?: string;

  /**
   * Node IRI that should be opened and focused on by default.
   */
  focusedIri?: string;
}

// Exported for documentation
interface SemanticLazyTreeTemplateData {
  iri: string;
  data: { [bindingName: string]: Rdf.Node | Rdf.Quad };
  label?: string;
  expanded: boolean;
  hasError: boolean;
  highlight?: string;
}

export type SemanticLazyTreeProps = SemanticLazyTreeConfig;

const ITEMS_LIMIT = 200;
const MIN_SEARCH_TERM_LENGTH = 3;
const SEARCH_DELAY_MS = 300;
const MOCK_PARENTS_QUERY = `
  SELECT ?item ?parent WHERE {
    # empty body
  }
`;

interface State {
  compiledTemplates?: CompiledTemplates;
  forest?: KeyedForest<Node>;
  loadingFocusItem?: boolean;
  loadError?: any;
  model?: SparqlNodeModel;
  searchQuery?: SparqlJs.SelectQuery;
  confirmedSelection?: TreeSelection<Node>;
  searchInputFocused?: boolean;
  searchText?: string;
  awaitingForResponse?: boolean;
  searchResult?: SearchResult;
}

interface CompiledTemplates {
  nodeTemplate?: CompiledTemplate;
  noResultTemplate?: CompiledTemplate;
}

interface SearchResult {
  forest?: KeyedForest<Node>;
  error?: any;
  matchedCount?: number;
  matchLimit?: number;
}

export class SemanticLazyTree extends Component<SemanticLazyTreeProps, State> {
  private readonly cancellation = new Cancellation();
  private requestChildrenCancellation = new Cancellation();
  private loadingFocusItemCancellation = Cancellation.cancelled;
  private searchCancellation = Cancellation.cancelled;

  private treeSelector: LazyTreeSelector | undefined;

  constructor(props: SemanticLazyTreeProps, context: any) {
    super(props, context);
    this.state = {
      ...this.createQueryModel(this.props),
      forest: Node.readyToLoadForest,
      confirmedSelection: TreeSelection.empty(Node.emptyForest),
    };
  }

  componentDidMount() {
    const {nodeTemplate, noResultTemplate, focusedIri} = this.props;
    if (nodeTemplate || noResultTemplate) {
      const noTemplate = Kefir.constant<CompiledTemplate | undefined>(undefined);
      this.cancellation.map(Kefir.combine<CompiledTemplates>({
        nodeTemplate: nodeTemplate
          ? this.appliedTemplateScope.prepare(nodeTemplate) : noTemplate,
        noResultTemplate: noResultTemplate
          ? this.appliedTemplateScope.prepare(noResultTemplate) : noTemplate,
      })).observe({
        value: compiledTemplates => this.setState({compiledTemplates}),
        error: loadError => this.setState({loadError}),
      });
    } else {
      // use default rendering
      this.setState({compiledTemplates: {}});
    }
    if (focusedIri) {
      this.focusOnItem(focusedIri);
    }
  }

  componentWillReceiveProps(nextProps: SemanticLazyTreeProps) {
    const props = this.props;
    const sameQueries = (
      props.rootsQuery === nextProps.rootsQuery &&
      props.childrenQuery === nextProps.childrenQuery &&
      props.parentsQuery === nextProps.parentsQuery &&
      props.nodeDataQuery === nextProps.nodeDataQuery &&
      props.searchQuery === nextProps.searchQuery
    );
    if (!sameQueries) {
      this.setState(this.createQueryModel(nextProps));
    }
    if (nextProps.focusedIri !== props.focusedIri) {
      this.focusOnItem(nextProps.focusedIri);
    }
  }

  private createQueryModel(props: SemanticLazyTreeProps): State {
    if (!(props.rootsQuery && props.childrenQuery)) {
      const missedQuery = !props.rootsQuery ? 'roots-query' : 'children-query';
      return {loadError: new Error(
        `You should provide the "${missedQuery}" to work with this component.`
      )};
    }
    if (props.searchQuery && !props.parentsQuery) {
      return {loadError: new Error(`
        The "search-query" is provided, but not the "parents-query".
        You should provide the "parentsQuery" to be able to use keyword-search.
      `)};
    }
    try {
      const model = new SparqlNodeModel({
        rootsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.rootsQuery),
        childrenQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.childrenQuery),
        parentsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(
          props.parentsQuery ? props.parentsQuery : MOCK_PARENTS_QUERY
        ),
        nodeDataQuery: props.nodeDataQuery
          ? SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.nodeDataQuery)
          : undefined,
        limit: ITEMS_LIMIT,
        sparqlOptions: () => ({context: this.context.semanticContext}),
      });
      const searchQuery = props.searchQuery ?
        SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.searchQuery) : undefined;
      return {model, searchQuery, searchResult: undefined};
    } catch (loadError) {
      return {loadError, searchResult: undefined};
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
    this.requestChildrenCancellation.cancelAll();
    this.loadingFocusItemCancellation.cancelAll();
    this.searchCancellation.cancelAll();
  }

  private focusOnItem(focusedIri: string | undefined) {
    this.loadingFocusItemCancellation.cancelAll();
    if (!focusedIri) {
      return;
    }
    const scrollToFocusedIfPossible = () => requestAnimationFrame(
      () => this.scrollToNode(focusedIri)
    );
    this.setState(state => {
      const leaf: Node = {
        iri: Rdf.iri(focusedIri),
        data: {},
      };
      this.loadingFocusItemCancellation.cancelAll();
      this.loadingFocusItemCancellation = new Cancellation();
      this.loadingFocusItemCancellation.map(
        state.model.loadFromLeafs([leaf], {transitiveReduction: false})
          .map(treeRoot => KeyedForest.create(Node.keyOf, treeRoot))
          .flatMap(forest => (
            loadExistingPathInParallel(
              parent => state.model.hasMoreChildren(parent),
              parent => state.model.loadMoreChildren(parent),
              forest,
              forest.getKeyPath(forest.getFirst(focusedIri))
            )
          ))
      ).observe({
        value: forest => {
          this.requestChildrenCancellation.cancelAll();
          this.requestChildrenCancellation = new Cancellation();
          const path = forest.getKeyPath(forest.getFirst(focusedIri));
          this.setState({
            forest: expandPath(forest, path),
            loadingFocusItem: false,
          }, scrollToFocusedIfPossible);
        },
        error: loadError => this.setState({loadingFocusItem: false, loadError}),
      });
      return {loadingFocusItem: true};
    }, scrollToFocusedIfPossible);
  }

  private scrollToNode(iri: string) {
    const {forest} = this.state;
    const nodes = forest.nodes.get(iri);
    if (nodes && nodes.size > 0) {
      const path = forest.getKeyPath(nodes.first());
      this.treeSelector.scrollToPath(path);
    }
  }

  render() {
    const {loadError, searchQuery} = this.state;
    if (loadError) {
      return <Alert variant='danger'>
        <ErrorPresenter error={loadError}></ErrorPresenter>
      </Alert>;
    } else {
      return <div className={lazyTreeStyles.semanticTreeNavigator}>
        <div
          className={`${lazyTreeStyles.holder} ${this.props.className}`}>
          {searchQuery ?
            <div className={inputStyles.inputAndButtons}>
              {this.renderTextField()}
            </div> : null
          }
          {this.renderScrollableContent()}
        </div>
      </div>;
    }
  }

  private renderTextField() {
    const textFieldProps: ClearableInputProps & React.ClassAttributes<ClearableInput> = {
      inputClassName: inputStyles.input,
      value: this.state.searchText || '',
      placeholder: this.props.placeholder,
      onChange: e => this.searchFor(e.currentTarget.value),
      onFocus: () => this.setState({searchInputFocused: true}),
      onBlur: () => this.setState({searchInputFocused: false}),
      onKeyDown: e => {
        // Retry search on enter
        if (e.keyCode === 13 && this.state.searchInputFocused) {
          this.searchFor(this.state.searchText);
        }
      },
      onClear: () => {
        if (this.state.searchText) {
          this.setState(() => {
            const newState: State = {
              awaitingForResponse: false,
              searchText: undefined,
              searchResult: undefined,
            };
            return newState;
          });
        }
      },
    };

    return <ClearableInput {...textFieldProps}></ClearableInput>;
  }

  private searchFor(text: string) {
    const hasEnoughSearchText = text.length >= MIN_SEARCH_TERM_LENGTH;

    if (hasEnoughSearchText) {
      const searchingSameText = this.state.awaitingForResponse && this.state.searchText === text;
      if (!searchingSameText) {
        this.setState({
          searchText: text,
          awaitingForResponse: hasEnoughSearchText,
        });

        this.searchCancellation.cancelAll();
        this.searchCancellation = new Cancellation();
        this.searchCancellation.map(this.performSearch(text)).observe({
          value: searchResult => this.setState({searchResult, awaitingForResponse: false}),
          error: error => this.setState({searchResult: {error}, awaitingForResponse: false}),
        });
      }
    } else {
      this.searchCancellation.cancelAll();
      this.setState({
        searchText: text,
        searchResult: undefined,
      });
    }
  }

  private performSearch(text: string) {
    // tslint:disable-next-line: deprecation
    const {escapeLuceneSyntax, tokenizeLuceneQuery} = this.props;
    const defaults = SparqlUtil.findTokenizationDefaults(this.state.searchQuery.where, '__token__');
    const parametrized = SparqlClient.setBindings(
      this.state.searchQuery, {
        '__token__': SparqlUtil.makeLuceneQuery(
          text,
          escapeLuceneSyntax ?? defaults.escapeLucene,
          tokenizeLuceneQuery ?? defaults.tokenize
        )
      });
    return Kefir.later(SEARCH_DELAY_MS, {})
      .flatMap(() => SparqlClient.selectStar(parametrized))
      .flatMap<SearchResult>(result =>
        this.restoreTreeFromLeafNodes(result.results.bindings)
        .map(forest => ({
          forest,
          matchedCount: result.results.bindings.length,
          matchLimit: parametrized.limit,
        }))
      );
  }

  private renderScrollableContent(): React.ReactNode {
    const {compiledTemplates, searchText, searchResult} = this.state;

    if (!compiledTemplates) {
      return <Spinner />;
    }

    if (searchText) {
      if (this.state.searchText.length < MIN_SEARCH_TERM_LENGTH) {
        return <span className={inputStyles.searchMessage}>
          Minimum length of search term is {MIN_SEARCH_TERM_LENGTH} characters
        </span>;
      } else if (this.state.awaitingForResponse) {
        return <Spinner className={lazyTreeStyles.searchSpinner}></Spinner>;
      }
    }

    let limitMessage: React.ReactElement<any> = null;

    if (searchResult) {
      if (this.state.searchResult.error) {
        return <Alert variant='warning'>
          <ErrorPresenter error={searchResult.error}></ErrorPresenter>
        </Alert>;
      }
      const {matchedCount, matchLimit, forest} = searchResult;
      if (matchLimit && matchedCount === matchLimit) {
        limitMessage = <span className={inputStyles.searchMessage}>
          Only first {matchedCount} matches are shown. Please refine your search.
        </span>;
      } else if (!forest.root.children || forest.root.children.length === 0) {
        if (compiledTemplates.noResultTemplate) {
          const dataContext = mergeInContextOverride(this.appliedDataContext, undefined);
          const nodes = compiledTemplates.noResultTemplate(dataContext);
          return ModuleRegistry.mapHtmlTreeToReact(nodes);
        } else {
          return <span className={inputStyles.searchMessage}>
            No results found.
          </span>;
        }
      }
    }

    return <div className={lazyTreeStyles.contentContainer}>
      {this.renderTree()}
      {limitMessage}
    </div>;
  }

  private renderTree(): React.ReactElement<any> {
    const {searchResult, loadingFocusItem} = this.state;
    const renderedForest = searchResult ?
      searchResult.forest : this.state.forest;
    const searchTerm = (searchResult && this.state.searchText)
      ? this.state.searchText.toLowerCase() : undefined;

    if (loadingFocusItem) {
      return <Spinner />;
    }

    const config: LazyTreeSelectorProps<Node> = {
      forest: renderedForest,
      isLeaf: item => item.children
        ? (item.children.length === 0 && !this.state.model.hasMoreChildren(item)) : undefined,
      childrenOf: item => ({
        children: item.children,
        loading: item.loading,
        hasMoreItems: this.state.model.hasMoreChildren(item),
      }),
      renderItem: node => this.renderItem(node, searchTerm),
      requestMore: node => {
        const path = renderedForest.getKeyPath(node);
        this.requestChildren(path);
      },
      selectionMode: SingleFullSubtree<Node>(),
      hideCheckboxes: true,
      isExpanded: node => node.expanded,
      onExpandedOrCollapsed: (item, expanded) => {
        const path = renderedForest.getKeyPath(item);
        this.updateForest(forest =>
          forest.updateNode(path, node => TreeNode.set(node, {expanded})
        ));
      },
    };
    const traversableConfig = config as unknown as LazyTreeSelectorProps<Traversable<Node>>;
    return <LazyTreeSelector ref={this.onTreeSelectorMount} {...traversableConfig} />;
  }

  private onTreeSelectorMount = (treeSelector: LazyTreeSelector | null) => {
    this.treeSelector = treeSelector ?? undefined;
  }

  private updateForest(
    update: (
      forest: KeyedForest<Node>,
      state: State,
      props: SemanticLazyTreeProps
    ) => KeyedForest<Node>,
    callback?: () => void
  ) {
    this.setState((state: State, props: SemanticLazyTreeProps): State => {
      const {searchResult} = state;
      if (searchResult) {
        const forest = update(searchResult.forest, state, props);
        return {
          searchResult: {...searchResult, forest},
        };
      } else {
        const forest = update(state.forest, state, props);
        return {forest};
      }
    }, callback);
  }

  private renderItem(node: Node, highlightedTerm: string | undefined): React.ReactNode {
    const {compiledTemplates} = this.state;
    if (compiledTemplates.nodeTemplate) {
      const templateData: SemanticLazyTreeTemplateData = {
        iri: node.iri.value,
        data: node.data,
        label: node.label ? node.label.value : undefined,
        expanded: Boolean(node.expanded && node.children && node.children.length > 0),
        hasError: Boolean(node.error || node.dataError),
        highlight: highlightedTerm,
      };
      const dataContext = mergeInContextOverride(this.appliedDataContext, templateData);
      const nodes = compiledTemplates.nodeTemplate(dataContext);
      return ModuleRegistry.mapHtmlTreeToReact(nodes);
    } else {
      return this.defaultRenderItem(node, highlightedTerm);
    }
  }

  private defaultRenderItem(node: Node, highlightedTerm: string) {
    const rawText = node.label ? node.label.value : node.iri.value;

    const resourceUrl = constructUrlForResourceSync(
      node.iri, undefined, this.context.semanticContext.repository
    ).toString();
    let text = <LinkComponent url={resourceUrl}>{rawText}</LinkComponent>;
    if (highlightedTerm) {
      const startIndex = rawText.toLowerCase().indexOf(highlightedTerm);
      if (startIndex >= 0) {
        const endIndex = startIndex + highlightedTerm.length;
        text = <LinkComponent url={resourceUrl}>
          <span>{rawText.substring(0, startIndex)}</span>
          <span className={inputStyles.highlighted}>
            {rawText.substring(startIndex, endIndex)}
          </span>
          <span>{rawText.substring(endIndex)}</span>
        </LinkComponent>;
      }
    }
    return <span
      title={node.iri.value}
      className={(node.error || node.dataError) ? inputStyles.error : undefined}>
      {text}
    </span>;
  }

  private requestChildren(path: KeyPath) {
    let changePromise: ForestChange<Node>;
    this.updateForest((forest, state) => {
      const [loadingForest, forestChange] = queryMoreChildren(
        parent => state.model.loadMoreChildren(parent), forest, path);
      changePromise = forestChange;
      return loadingForest;
    }, () => {
      const {searchResult, searchText} = this.state;
      const cancellation = searchText && !searchResult ?
        this.searchCancellation : this.requestChildrenCancellation;
      cancellation.map(changePromise).observe({
        value: change => {
          this.updateForest(change);
        }
      });
    });
  }

  private restoreTreeFromLeafNodes(
    searchResult: SparqlClient.StarBindings
  ): Kefir.Property<KeyedForest<Node>> {
    const leafs = searchResult.map(
      ({item, score = Rdf.literal('0'), label, hasChildren}): Node => {
        if (!Rdf.isIri(item)) { return undefined; }
        const certainlyLeaf = Rdf.isLiteral(hasChildren) && hasChildren.value === 'false';
        return {
          iri: item,
          data: {},
          label: label && Rdf.isLiteral(label) ? label : undefined,
          score: parseFloat(Rdf.isLiteral(score) ? score.value : ''),
          children: [],
          reachedLimit: certainlyLeaf,
        };
      }).filter(node => node !== undefined);

    return this.state.model.loadFromLeafs(leafs, {transitiveReduction: true})
      .map(treeRoot => KeyedForest.create(Node.keyOf, sealLazyExpanding(treeRoot)));
  }
}

export default SemanticLazyTree;
