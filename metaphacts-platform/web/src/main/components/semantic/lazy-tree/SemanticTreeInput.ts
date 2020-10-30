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
import {
  ReactElement, createElement, ReactNode, Children, ClassAttributes,
} from 'react';
import * as D from 'react-dom-factories';
import { findDOMNode } from 'react-dom';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import { Overlay, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import * as SparqlJs from 'sparqljs';
import * as classnames from 'classnames';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, SparqlClient } from 'platform/api/sparql';
import * as LabelsService from 'platform/api/services/resource-label';
import { Component } from 'platform/api/components';
import { ErrorNotification } from 'platform/components/ui/notification';
import { ClearableInput, ClearableInputProps, RemovableBadge } from 'platform/components/ui/inputs';
import { Spinner } from 'platform/components/ui/spinner';
import { Droppable } from 'platform/components/dnd';

import { KeyedForest, KeyPath, Traversable } from './KeyedForest';
import { TreeSelection, SelectionNode } from './TreeSelection';
import { SingleFullSubtree, MultipleFullSubtrees } from './SelectionMode';
import { TreeNode, ForestChange, queryMoreChildren } from './NodeModel';
import { Node, SparqlNodeModel, TreeQueryPatterns, sealLazyExpanding } from './SparqlNodeModel';
import { LazyTreeSelector, LazyTreeSelectorProps } from './LazyTreeSelector';

import * as styles from './SemanticTreeInput.scss';

export interface ComplexTreePatterns extends TreeQueryPatterns {
  /**
   * A flag determining whether any special Lucene syntax will be escaped.
   * When `false` lucene syntax in the user input is not escaped.
   *
   * Deprecated: escaping will be applied automatically based on SPARQL query.
   *
   * @deprecated Escaping will be applied automatically based on SPARQL query.
   */
   escapeLuceneSyntax?: boolean;

  /**
   * A flag determining whether the user input is tokenized by whitespace into words postfixed
   * by `*`. E.g. the search for `Hello World` becomes `Hello* World*`.
   *
   * Deprecated: tokenization will be applied automatically based on SPARQL query.
   *
   * @deprecated Tokenization will be applied automatically based on SPARQL query.
   */
   tokenizeLuceneQuery?: boolean;
}

export interface SemanticTreeInputProps extends ComplexTreePatterns {
  /**
   * Optional custom class for the tree.
   */
  className?: string;

  /**
   * This component is an uncontrolled component, but this property can be used to specify
   * array of nodes that should be initially selected.
   */
  initialSelection?: ReadonlyArray<Rdf.Iri>;

  /** Allows to drop entity if it satisfies ASK-query */
  droppable?: {
    query: string
    styles?: {
      enabled: any
      disabled: any
    }
    components?: {
      disabledHover?: any
    }
  }
  /** Allows to select multiple items at the same time. */
  multipleSelection?: boolean;
  /** Empty field placeholder. */
  placeholder?: string;
  /** Callback invoked when tree selection changes. */
  onSelectionChanged?: (selection: TreeSelection<Node>) => void;
  /** Callback invoked when user clicks on selected item badge. */
  onSelectionClick?: (selection: TreeSelection<Node>, node: SelectionNode<Node>) => void;
  /** Automatically open/close dropdown in full mode when input focused/blurred. */
  openDropdownOnFocus?: boolean;
  /** Allow forced search with query less than MIN_SEARCH_TERM_LENGTH by pressing Enter **/
  allowForceSuggestion?: boolean;
}

const ITEMS_LIMIT = 200;
const MIN_SEARCH_TERM_LENGTH = 3;
const SEARCH_DELAY_MS = 300;

interface State {
  forest?: KeyedForest<Node>;

  loadError?: any;
  model?: SparqlNodeModel;
  searchQuery?: SparqlJs.SelectQuery;

  confirmedSelection?: TreeSelection<Node>;

  searchInputFocused?: boolean;
  searchText?: string;
  searchForce?: boolean;
  searching?: boolean;
  searchResult?: SearchResult;

  mode?: DropdownMode;
}

type DropdownMode = {type: 'collapsed'} | ExpandedMode;
type ExpandedMode = {
  type: 'full' | 'search';
  selection: TreeSelection<Node>;
};

interface SearchResult {
  forest?: KeyedForest<Node>;
  error?: any;
  matchedCount?: number;
  matchLimit?: number;
}

/**
 * Tree selector component that allows the user to navigate the tree
 * along a broader/narrower relationship (e.g. parent/child).
 *
 * @example
 *
 * <semantic-tree-input placeholder='Select or search for a place...'
 *
 * roots-query='
 *   prefix skos: <http://www.w3.org/2004/02/skos/core#>
 *   select distinct ?item ?label ?hasChildren where {
 *     {
 *       ?item a <http://www.cidoc-crm.org/cidoc-crm/E53_Place>
 *       MINUS { ?item skos:broader ?parent }
 *       OPTIONAL { ?item skos:prefLabel ?label }
 *     }
 *     OPTIONAL {
 *       ?child skos:broader ?item .
 *       ?child a <http://www.cidoc-crm.org/cidoc-crm/E53_Place>
 *     }
 *     BIND(bound(?child) as ?hasChildren)
 *   } order by ?label
 * '
 *
 * children-query='
 *   prefix skos: <http://www.w3.org/2004/02/skos/core#>
 *   select distinct ?item ?label ?hasChildren where {
 *     {
 *       ?item a <http://www.cidoc-crm.org/cidoc-crm/E53_Place> .
 *       ?item skos:broader ?parent
 *       OPTIONAL { ?item skos:prefLabel ?label }
 *     }
 *     OPTIONAL {
 *       ?child skos:broader ?item .
 *       ?child a <http://www.cidoc-crm.org/cidoc-crm/E53_Place>
 *     }
 *     BIND(bound(?child) as ?hasChildren)
 *   } order by ?label
 * '
 *
 * parents-query='
 *   prefix skos: <http://www.w3.org/2004/02/skos/core#>
 *   select distinct ?item ?parent ?parentLabel where {
 *     ?item skos:broader ?parent .
 *     OPTIONAL { ?parent skos:prefLabel ?parentLabel }
 *   }
 * '
 *
 * search-query='
 *   prefix skos: <http://www.w3.org/2004/02/skos/core#>
 *   select distinct ?item ?score ?label ?hasChildren where {
 *     ?item a <http://www.cidoc-crm.org/cidoc-crm/E53_Place> .
 *     ?item skos:prefLabel ?label .
 *     FILTER(REGEX(STR(?label), ?__token__, \"i\"))
 *     OPTIONAL {
 *       ?child skos:broader ?item .
 *       ?child a <http://www.cidoc-crm.org/cidoc-crm/E53_Place>
 *     }
 *     BIND(bound(?child) as ?hasChildren)
 *   } order by ?label limit 100
 * '></semantic-tree-input>
 */
export class SemanticTreeInput extends Component<SemanticTreeInputProps, State> {
  private readonly cancellation = new Cancellation();
  private search = new Cancellation();

  private overlayHolder: HTMLElement;
  private textInput: ClearableInput;

  constructor(props: SemanticTreeInputProps, context: any) {
    super(props, context);
    this.state = {
      ...this.createQueryModel(this.props),
      mode: {type: 'collapsed'},
      forest: Node.readyToLoadForest,
      confirmedSelection: TreeSelection.empty(Node.emptyForest),
    };
  }

  componentDidMount() {
    this.setInitialSelection();
  }

  componentWillReceiveProps(nextProps: SemanticTreeInputProps) {
    const props = this.props;
    const sameQueries = (
      props.rootsQuery === nextProps.rootsQuery &&
      props.childrenQuery === nextProps.childrenQuery &&
      props.parentsQuery === nextProps.parentsQuery &&
      props.searchQuery === nextProps.searchQuery
    );
    if (!sameQueries) {
      this.setState(this.createQueryModel(nextProps));
    }
  }

  private createQueryModel(props: SemanticTreeInputProps): State {
    try {
      const model = new SparqlNodeModel({
        rootsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.rootsQuery),
        childrenQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.childrenQuery),
        parentsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.parentsQuery),
        limit: ITEMS_LIMIT,
        sparqlOptions: () => ({context: this.context.semanticContext}),
      });
      const searchQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.searchQuery);
      return {model, searchQuery};
    } catch (loadError) {
      return {loadError};
    }
  }

  /**
   * To set initial selection we first need to restore the full path from the
   * selected items to the root, we use the same mechanism as we use in search.
   * But in addition to that we also need to fetch labels for selected items using LabelsService.
   */
  private setInitialSelection = () => {
    const {initialSelection} = this.props;
    if (!initialSelection || initialSelection.length === 0) {
      return;
    }
    this.cancellation.map(
      LabelsService.getLabels(initialSelection)
    ).flatMap(labels => {
      const bindings = initialSelection.map(iri => ({
        item: iri,
        label: labels.has(iri) ? Rdf.literal(labels.get(iri)) : undefined,
        hasChildren: Rdf.literal(true),
      }));
      return this.restoreTreeFromLeafNodes(bindings);
    }).observe({
      value: forest => {
        const confirmedSelection = TreeSelection.fromForest(forest);
        this.setState({confirmedSelection});
      },
      error: error => console.error('Failed to restore initial tree selection', error),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
    this.search.cancelAll();
  }

  render() {
    if (this.state.loadError) {
      return D.div({className: classnames(styles.holder, this.props.className)},
        createElement(ErrorNotification, {errorMessage: this.state.loadError})
      );
    } else {
      const result = D.div(
        {
          ref: holder => this.overlayHolder = holder,
          className: classnames(styles.holder, this.props.className),
        },
        D.div({className: styles.inputAndButtons},
          this.renderTextField(),
          this.renderBrowseButton()
        ),
        this.renderOverlay()
      );
      if (this.props.droppable) {
        return createElement(Droppable,
          {
            query: this.props.droppable.query,
            dropStyles: this.props.droppable.styles,
            dropComponents: {
              ...this.props.droppable.components,
            },
            onDrop: (drop: Rdf.Iri) => {
              this.setValue(drop);
            },
          },
          result
        );
      } else {
        return result;
      }
    }
  }

  private setValue(iri: Rdf.Iri) {
    this.cancellation.map(this.state.model.loadNode(iri)).onValue(node => {
      const newSelection = TreeSelection.setToSingleTerminal(
        TreeSelection.empty(this.state.forest),
        node
      );
      this.setState({
        mode: {type: 'collapsed'},
        searchText: undefined,
        searching: false,
        searchResult: undefined,
        confirmedSelection: newSelection,
      }, () => {
        if (this.props.onSelectionChanged) {
          this.props.onSelectionChanged(this.state.confirmedSelection);
        }
      });
    });
  }

  private renderTextField() {
    const textFieldProps: ClearableInputProps & ClassAttributes<ClearableInput> = {
      ref: input => this.textInput = input,
      className: styles.textInput,
      inputClassName: styles.input,
      value: this.state.searchText || '',
      placeholder: this.props.placeholder,
      onFocus: () => this.setState({
        searchInputFocused: true,
        mode: (this.state.mode.type === 'collapsed' && this.props.openDropdownOnFocus)
          ? {type: 'full', selection: this.state.confirmedSelection} : this.state.mode,
      }),
      onBlur: () => {
        this.setState({searchInputFocused: false});
        if (!this.state.searchText && this.props.openDropdownOnFocus) {
          this.closeDropdown({saveSelection: false});
        }
      },
      onChange: e => this.searchFor(e.currentTarget.value, false),
      onKeyDown: e => {
        if (e.keyCode === 13 && this.state.searchInputFocused) { // enter
          this.searchFor(this.state.searchText, true);
        }
      },
      onClear: () => {
        if (this.state.searchInputFocused || this.state.searchText) {
          this.closeDropdown({saveSelection: false});
        }
      },
    };

    const selection = this.state.confirmedSelection;
    const selectedItems = TreeSelection.leafs(selection).sortBy(item => item.label.value);

    const {onSelectionClick} = this.props;
    return createElement(ClearableInput, textFieldProps, selectedItems.map(item =>
      createElement(RemovableBadge, {
        key: item.iri.value,
        onClick: onSelectionClick ? () => onSelectionClick(selection, item) : undefined,
        onRemove: () => {
          const previous = this.state.confirmedSelection;
          const newSelection = TreeSelection.unselect(previous, previous.keyOf(item));
          this.setState({confirmedSelection: newSelection}, () => {
            if (this.props.onSelectionChanged) {
              this.props.onSelectionChanged(newSelection);
            }
          });
        },
      }, item.label.value)
    ).toArray());
  }

  private searchFor(text: string, force: boolean) {
    const doForceSearch = this.props.allowForceSuggestion && force;
    const hasEnoughSearchText = doForceSearch || text.length >= MIN_SEARCH_TERM_LENGTH;

    if (hasEnoughSearchText) {
      const searchingSameText = this.state.searching && this.state.searchText === text;
      if (!searchingSameText) {
        this.setState({
          searchText: text,
          searchForce: force,
          searching: hasEnoughSearchText,
          mode: {type: 'search', selection: this.state.confirmedSelection},
        });

        this.search.cancelAll();
        this.search = new Cancellation();
        this.search.map(this.performSearch(text)).observe({
          value: searchResult => this.setState({searchResult, searching: false}),
          error: error => this.setState({searchResult: {error}, searching: false}),
        });
      }
    } else {
      this.search.cancelAll();

      let mode = this.state.mode;
      if (text.length === 0 && !this.props.openDropdownOnFocus) {
        mode = {type: 'collapsed'};
      } else if (text.length > 0) {
        mode = {type: 'search', selection: this.state.confirmedSelection};
      }
      this.setState({
        mode,
        searchText: text,
        searchForce: force,
      });
    }
  }

  private performSearch(text: string) {
    // tslint:disable-next-line: deprecation
    const {escapeLuceneSyntax, tokenizeLuceneQuery} = this.props;
    const defaults = SparqlUtil.findTokenizationDefaults(this.state.searchQuery.where, '__token__');
    const parametrized = SparqlClient.setBindings(this.state.searchQuery, {
      '__token__': SparqlUtil.makeLuceneQuery(
        text,
        escapeLuceneSyntax ?? defaults.escapeLucene,
        tokenizeLuceneQuery ?? defaults.tokenize
      ),
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

  renderBrowseButton() {
    return createElement(
      OverlayTrigger,
      {
        placement: 'bottom',
        overlay: createElement(Tooltip, {
          id: 'SemanticTreeInput__tooltip',
        }, 'Browse full hierarchy'),
      },
      createElement(Button,
        {
          className: styles.browseButton,
          active: this.state.mode.type === 'full',
          onClick: () => {
            const modeType = this.state.mode.type;
            if (modeType === 'collapsed' || modeType === 'search') {
              this.search.cancelAll();
              this.setState({
                searchText: undefined,
                searching: false,
                searchResult: undefined,
                mode: {type: 'full', selection: this.state.confirmedSelection},
              });
            } else if (modeType === 'full') {
              this.closeDropdown({saveSelection: false});
            }
          },
        },
        D.span({
          className: 'fa fa-sitemap fa-lg',
          ['aria-hidden' as any]: true,
        })
      )
    );
  }

  private closeDropdown(options: {saveSelection: boolean}) {
    this.search.cancelAll();
    this.setState((state: State, props: SemanticTreeInputProps): State => {
      const mode = state.mode;
      const newState: State = {
        mode: {type: 'collapsed'},
        searchText: undefined,
        searching: false,
        searchResult: undefined,
      };
      if (mode.type !== 'collapsed' && options.saveSelection) {
        newState.confirmedSelection = mode.selection;
        if (props.onSelectionChanged) {
          props.onSelectionChanged(mode.selection);
        }
      }
      return newState;
    });
  }

  private renderOverlay() {
    const mode = this.state.mode;
    return createElement(Overlay,
      {
        show: mode.type !== 'collapsed',
        placement: 'bottom',
        container: this.overlayHolder,
        target: () => findDOMNode(this.textInput),
      },
      // use proxy component for overlay content to avoid warnings
      // about unknown props provided by React.Bootstrap
      createElement(OverlayProxy, {},
        mode.type === 'collapsed'
        ? D.div({})
        : D.div(
          {className: styles.dropdown},
          this.renderDropdownContent(mode),
          this.renderDropdownFooter(mode)
        )
      )
    );
  }

  private updateForest(
    displayingSearch: boolean,
    update: (
      forest: KeyedForest<Node>,
      state: State,
      props: SemanticTreeInputProps
    ) => KeyedForest<Node>,
    callback?: () => void
  ) {
    this.setState((state: State, props: SemanticTreeInputProps): State => {
      if (displayingSearch) {
        return {searchResult: _.assign({}, state.searchResult, {
          forest: update(state.searchResult.forest, state, props),
        })};
      } else {
        return {forest: update(state.forest, state, props)};
      }
    }, callback);
  }

  private renderDropdownContent(mode: ExpandedMode): ReactElement<any> {
    if (mode.type === 'search') {
      if (this.state.searchText.length < MIN_SEARCH_TERM_LENGTH &&
        (!this.state.searchForce || !this.props.allowForceSuggestion)
      ) {
        return D.span({className: styles.searchMessage},
          `Minimum length of search term is ${MIN_SEARCH_TERM_LENGTH} characters.`);
      } else if (this.state.searching) {
        return createElement(Spinner, {className: styles.searchSpinner});
      } else if (this.state.searchResult.error) {
        return createElement(ErrorNotification, {errorMessage: this.state.searchResult.error});
      }
    }
    return this.renderScrollableDropdownContent(mode);
  }

  private renderScrollableDropdownContent(mode: ExpandedMode): ReactElement<any> {
    let limitMessage: ReactElement<any> = null;
    let noResultsMessage: ReactElement<any> = null;

    if (mode.type === 'search') {
      const {matchedCount, matchLimit, forest} = this.state.searchResult;
      if (matchLimit && matchedCount === matchLimit) {
        limitMessage = D.span(
          {className: styles.searchMessage},
          `Only first ${matchedCount} matches are shown. Please refine your search.`
        );
      } else if (!forest.root.children || forest.root.children.length === 0) {
        return D.span({className: styles.searchMessage}, `No results found.`);
      }
    }

    return D.div(
      {className: styles.tree},
      this.renderTree(mode),
      limitMessage
    );
  }

  private renderDropdownFooter(mode: ExpandedMode) {
    const enableSelectionSave = mode.selection !== this.state.confirmedSelection;

    return D.div({className: styles.dropdownFooter},
      createElement(Button, {
        className: styles.dropdownButton,
        bsStyle: 'danger',
        onClick: () => this.closeDropdown({saveSelection: false}),
      }, 'Cancel'),
      createElement(Button, {
        className: styles.dropdownButton,
        bsStyle: 'success',
        disabled: !enableSelectionSave,
        onClick: () => this.closeDropdown({saveSelection: true}),
      }, 'Select')
    );
  }

  private renderTree(mode: ExpandedMode): ReactElement<any> {
    const inSearchMode = mode.type === 'search';
    const renderedForest = inSearchMode ? this.state.searchResult.forest : this.state.forest;
    const searchTerm = (inSearchMode && this.state.searchText)
      ? this.state.searchText.toLowerCase() : undefined;

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
        this.requestChildren(path, inSearchMode);
      },
      selectionMode: this.props.multipleSelection
        ? MultipleFullSubtrees<Node>() : SingleFullSubtree<Node>(),
      selection: mode.selection,
      onSelectionChanged: selection => {
        this.setState((state: State): State => {
          if (state.mode.type === 'collapsed') { return {}; }
          return {mode: {type: state.mode.type, selection}};
        });
      },
      isExpanded: node => node.expanded,
      onExpandedOrCollapsed: (item, expanded) => {
        const path = renderedForest.getKeyPath(item);
        this.updateForest(inSearchMode, forest =>
          forest.updateNode(path, node => TreeNode.set(node, {expanded})
        ));
      },
    };
    return createElement(
      LazyTreeSelector,
      config as unknown as LazyTreeSelectorProps<Traversable<Node>>
    );
  }

  private renderItem(node: Node, highlightedTerm: string) {
    const text = node.label ? node.label.value : node.iri.value;

    let parts: ReactNode[] = [text];
    if (highlightedTerm) {
      const startIndex = text.toLowerCase().indexOf(highlightedTerm);
      if (startIndex >= 0) {
        const endIndex = startIndex + highlightedTerm.length;
        parts = [
          text.substring(0, startIndex),
          D.span(
            {className: styles.highlighted},
            text.substring(startIndex, endIndex)),
          text.substring(endIndex),
        ];
      }
    }

    return D.span({
      title: node.iri.value,
      className: (node.error || node.dataError) ? styles.error : undefined,
    }, ...parts);
  }

  private requestChildren(path: KeyPath, isSearching: boolean) {
    let changePromise: ForestChange<Node>;
    this.updateForest(isSearching, (forest, state) => {
      const [loadingForest, forestChange] = queryMoreChildren(
        parent => state.model.loadMoreChildren(parent), forest, path);
      changePromise = forestChange;
      return loadingForest;
    }, () => {
      const cancellation = isSearching ? this.search : this.cancellation;
      cancellation.map(changePromise)
        .onValue(change => this.updateForest(isSearching, change));
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

class OverlayProxy extends Component<{}, {}> {
  render() { return Children.only(this.props.children); }
}

export default SemanticTreeInput;
