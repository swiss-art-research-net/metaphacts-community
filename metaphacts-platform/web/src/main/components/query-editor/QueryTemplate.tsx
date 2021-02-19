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
import { createFactory, createElement, FormEvent, ReactElement } from 'react';
import * as D from 'react-dom-factories';
import { Component } from 'platform/api/components';
import * as ReactBootstrap from 'react-bootstrap';
import { Just, Nothing, fromNullable } from 'data.maybe';
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import { Rdf, vocabularies } from 'platform/api/rdf';

const { spin } = vocabularies;

import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { ResourceLink } from 'platform/components/navigation/ResourceLink';
import { refresh } from 'platform/api/navigation';
import { getLabels } from 'platform/api/services/resource-label';
import { slugFromName } from 'platform/api/services/ldp';
import {
  Query, OperationType, QueryService, QueryServiceClass,
} from 'platform/api/services/ldp-query';
import {
  QueryTemplateService, QueryTemplateServiceClass,
} from 'platform/api/services/ldp-query-template';
import { addNotification, ErrorPresenter } from 'platform/components/ui/notification';
import { AutoCompletionInput } from 'platform/components/ui/inputs';

import { Template, Argument, Value, CheckedArgument } from './QueryTemplateTypes';
import { QueryValidatorComponent } from './QueryValidatorComponent';
import { QueryTemplateArgumentsComponent } from './QueryTemplateArgumentsComponent';

const Card = createFactory(ReactBootstrap.Card);
const FormGroup = createFactory(ReactBootstrap.FormGroup);
const FormControl = createFactory(ReactBootstrap.FormControl);
const FormLabel = createFactory(ReactBootstrap.FormLabel as React.FunctionComponent);
const FormText = createFactory(ReactBootstrap.FormText);
const Button = createFactory(ReactBootstrap.Button);
const FormCheck = createFactory(ReactBootstrap.FormCheck);

const QueryValidator = createFactory(QueryValidatorComponent);

const QUERY_OPTIONS: Array<{value: EditMode, label: string}> = [
  {value: 'create', label: 'Create new query'},
  {value: 'update', label: 'Update query'},
  {value: 'reference', label: 'Reference existing query'},
];

const SELECT_TEMPLATE_COUNT_QUERY = `PREFIX spin: <http://spinrdf.org/spin#>
SELECT (COUNT(?template) as ?templateCount) WHERE {
  ?template spin:body ?query
}`;

interface QueryTemplateConfig {
  /** IRI of an existing template to edit. */
  iri?: string;
  /** Initial value for query body when creating a new template. */
  defaultQuery?: string;
  /** Namespace prefix for generated IRIs of templates, queries and arguments. */
  namespace?: string;
  /** Autosuggestion query to choose template categories, e.g from a skos list of terms. */
  categorySuggestionQuery?: string;
  /** Default query to choose template categories, e.g from a skos list of terms. */
  categoryDefaultQuery?: string;
}

export type QueryTemplateProps = QueryTemplateConfig;

type EditMode = 'create' | 'update' | 'reference';

interface State {
  identifier?: Data.Maybe<Value>;
  label?: Data.Maybe<Value>;
  description?: Data.Maybe<Value>;
  /**
   * Category bindings:
   *   'iri' - category IRI
   */
  categories?: ReadonlyArray<SparqlClient.Binding>;
  selectQuery?: EditMode;
  query?: Query;
  variables?: string[];
  args?: ReadonlyArray<CheckedArgument>;
  queryIri?: string;
  existingQueryIri?: string;
  templateCount?: number;
  template?: Data.Maybe<Template>;
  inProgress?: boolean;
}

type DefaultProps = Required<Pick<QueryTemplateProps,
  'categorySuggestionQuery' | 'categoryDefaultQuery'
>>;

export class QueryTemplate extends Component<QueryTemplateProps, State> {
  static readonly defaultProps: DefaultProps = {
    categorySuggestionQuery: `
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      SELECT DISTINCT ?iri ?label WHERE {
        ?iri a skos:Concept ;
          rdfs:label ?label .
        FILTER(REGEX(STR(?label), $__token__, \"i\")) .
      }
    `,
    categoryDefaultQuery: `
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      SELECT DISTINCT ?iri ?label WHERE {
        ?iri a skos:Concept ;
          rdfs:label ?label .
      } LIMIT 10
    `,
  };

  private identifier = Kefir.pool<string>();
  private label = Kefir.pool<string>();
  private description = Kefir.pool<string>();
  private args = Kefir.pool<ReadonlyArray<CheckedArgument>>();
  private query = Kefir.pool<Query>();

  private queryTemplateService: QueryTemplateServiceClass;
  private queryService: QueryServiceClass;

  constructor(props: QueryTemplateProps, context: any) {
    super(props, context);
    const semanticContext = this.context.semanticContext;
    this.queryTemplateService = QueryTemplateService(semanticContext);
    this.queryService = QueryService(semanticContext);
    this.state = {
      identifier: Nothing<Value>(),
      label: Nothing<Value>(),
      description: Nothing<Value>(),
      categories: [],
      selectQuery: 'create',
      query: undefined,
      variables: [],
      args: [],
      template: Nothing<Template>(),
      inProgress: false,
    };
  }

  componentWillMount() {
    this.initPool();
  }

  componentDidMount() {
    if (this.isUpdateMode()) {
      this.fetchTemplate(this.props.iri);
    } else if (this.props.defaultQuery) {
      SparqlUtil.parseQueryAsync(this.props.defaultQuery).onValue(q => {
        const queryType: OperationType = (q.type === 'update') ? 'UPDATE' : q.queryType;
        this.query.plug(Kefir.constant({
          value: this.props.defaultQuery,
          type: q.type,
          queryType: queryType,
          label: '',
        }));
      });
    }
  }

  private fetchTemplate = (iri: string) => {
    this.queryTemplateService
      .getQueryTemplate(Rdf.iri(iri))
      .flatMap(this.getQueryTemplateCount)
      .onValue(({template, queryIri, templateCount}) => {
        const {identifier, label, description, args} = template;
        // TODO
        // fetch labels for existing category IRIs
        getLabels(template.categories).map(
          labels => labels.map((categoryLabel, categoryIri): SparqlClient.Dictionary<Rdf.Node> => (
            {iri: categoryIri, label: Rdf.literal(categoryLabel)}
          )).toArray()
        ).onValue(categories =>
          this.setState({queryIri, templateCount, categories, selectQuery: 'update'}, () => {
            this.identifier.plug(Kefir.constant(identifier));
            this.label.plug(Kefir.constant(label));
            this.description.plug(Kefir.constant(description));
            args.forEach((arg, index) => {
              this.setArgument({argument: arg, valid: true}, index);
            });
          })
        );
      });
  }

  private getQueryTemplateCount = (
    {template, queryIri}: { template: Template, queryIri: string }
  ): Kefir.Property<{ template: Template; queryIri: string; templateCount: number; }> => {
    const query = SparqlClient.setBindings(
      SparqlUtil.parseQuery(SELECT_TEMPLATE_COUNT_QUERY),
      {'query': Rdf.iri(queryIri)}
    );
    const context = this.context.semanticContext;
    return SparqlClient.select(query, {context: context}).map(res => {
      return {
        template: template,
        queryIri: queryIri,
        templateCount: parseInt(res.results.bindings[0]['templateCount'].value),
      };
    });
  }

  private isUpdateMode = (): boolean => {
    return !!this.props.iri;
  }

  private getTemplateTypeForQuery = (q: Query): Rdf.Iri => {
      if (q.type === 'update') {
          return spin.UpdateTemplate;
      } else {
          switch (q.queryType) {
          case 'SELECT':
              return spin.SelectTemplate;
          case 'CONSTRUCT':
              return spin.ConstructTemplate;
          case 'ASK':
              return spin.AskTemplate;
          default:
              return spin.SelectTemplate;
          }
      }
  }

  private initPool = () => {
    const identifierMapped = this.identifier.flatMap<Value>(this.validateInputField);
    identifierMapped.onValue(
      v => this.setState({identifier: Just(v)})
    ).onError(
      v => this.setState({identifier: Just(v), template: Nothing<Template>()})
    );

    const labelMapped = this.label.flatMap<Value>(this.validateInputField);
    labelMapped.onValue(
      v => this.setState({label: Just(v)})
    ).onError(
      v => this.setState({label: Just(v), template: Nothing<Template>()})
    );

    const descriptionMapped = this.description.flatMap<Value>(this.validateInputField);
    descriptionMapped.onValue(
      v => this.setState({description: Just(v)})
    ).onError(
      v => this.setState({description: Just(v), template: Nothing<Template>()})
    );

    const argsMapped = this.args.flatMap<ReadonlyArray<CheckedArgument>>(this.validateArguments);
    argsMapped.onError(
      v => this.setState({template: Nothing<Template>()})
    );

    const queryMapped = this.query;
    queryMapped.onValue(
      v => this.setState({query: v})
    ).onError(
      v => this.setState({query: v, template: Nothing<Template>()})
    );

    Kefir.combine(
      {
        identifier: identifierMapped.map(v => v.value).toProperty(
          () => {
            if (this.state.identifier.isJust) {
              return this.state.identifier.get().value;
            }
          }
        ),
        label: labelMapped.map(v => v.value).toProperty(
          () => {
            if (this.state.label.isJust) {
              return this.state.label.get().value;
            }
          }
        ),
        description: descriptionMapped.map(v => v.value).toProperty(
          () => {
            if (this.state.description.isJust) {
              return this.state.description.get().value;
            }
          }
        ),
        args: argsMapped.toProperty(
          () => this.state.args
        ),
        query: queryMapped.toProperty(
          () => this.state.query
        ),
      }, ({identifier, label, description, args, query}) => {
        if (!identifier || !label || !description || !query) {
          return;
        }

        const categories = this.state.categories.map(({iri}) => {
          if (!Rdf.isIri(iri)) {
            throw new Error('Query template category is expected to be an IRI');
          }
          return iri;
        });

        const templateType = this.getTemplateTypeForQuery(query);

        const template = {
          templateType,
          identifier,
          label,
          description,
          categories,
          args: args.map(arg => {
            return arg.argument;
          }),
        };

        this.setState({template: Just(template)});

        return {};
      }
    ).onValue(o => o);
  }

  private validateInputField = (v: string): Kefir.Property<Value> => {
    if (v.length < 1) {
      return Kefir.constantError<Value>({
        value: v,
        error: new Error('Please fill out this field.'),
      });
    }
    return Kefir.constant<Value>({value: v});
  }

  private validateArguments = (
    v: ReadonlyArray<CheckedArgument>
  ): Kefir.Property<ReadonlyArray<CheckedArgument>> => {
    const errorArgs = v.filter(arg => {
      return !arg.valid;
    });

    if (errorArgs.length) {
      return Kefir.constantError<ReadonlyArray<CheckedArgument>>(v);
    }
    return Kefir.constant<ReadonlyArray<CheckedArgument>>(v);
  }

  private addArgument = (arg: CheckedArgument) => {
    this.setState(prevState => {
      const args = prevState.args.slice();
      args.push(arg);
      return {args};
    }, () => this.args.plug(Kefir.constant(this.state.args)));
  }

  private deleteArgument = (index: number) => {
    this.setState(prevState => {
      const args = prevState.args.slice();
      args.splice(index, 1);
      return {args};
    }, () => this.args.plug(Kefir.constant(this.state.args)));
  }

  private setArgument = (arg: CheckedArgument, index: number) => {
    this.setState(prevState => {
      const args = prevState.args.slice();
      args.splice(index, 1, arg);
      return {args};
    }, () => this.args.plug(Kefir.constant(this.state.args)));
  }

  private createQuery = (): Kefir.Property<string> => {
    return  this.queryService.addItem(this.state.query).map(iri => iri.value);
  }

  private updateQuery = (): Kefir.Property<{}> => {
    const iri = Rdf.iri(this.state.queryIri);
    return this.queryService.updateItem(iri, this.state.query);
  }

  private onSaveError = (er: Error) => {
    this.setState({inProgress: false});
    addNotification({
      title: 'Error!',
      children: (
        <div>
        An error has occurred while template saving.
          <ErrorPresenter error={er} />
        </div>
      ),
      level: 'error',
    }, er);
  }

  private onUpdateSuccess = () => {
    this.setState({inProgress: false});
    addNotification({
      title: 'Success!',
      message: 'Template updated successfully',
      level: 'success',
    });
    refresh();
  }

  private onUpdateError = (er: Error) => {
    this.setState({inProgress: false});
    addNotification({
      title: 'Error!',
      children: (
        <div>
        An error has occurred while template updating.
          <ErrorPresenter error={er} />
        </div>
      ),
      level: 'error',
    }, er);
  }

  private createTemplate = () => {
    const {namespace} = this.props;
    const {selectQuery, existingQueryIri, template} = this.state;

    this.setState({inProgress: true});

    if (selectQuery === 'create') {
      this.createQuery()
        .flatMap(iri => this.queryTemplateService.addItem(template.get(), iri, namespace))
        .onValue(() => {
          refresh();
        })
        .onError(this.onSaveError);
    } else if (selectQuery === 'reference') {
      this.queryTemplateService
        .addItem(template.get(), existingQueryIri, namespace)
        .onValue(() => {
          refresh();
        })
        .onError(this.onSaveError);
    }
  }

  private updateTemplate = () => {
    const {namespace} = this.props;
    const {selectQuery, queryIri, existingQueryIri, template} = this.state;

    const iri = Rdf.iri(this.props.iri);

    this.setState({inProgress: true});

    if (selectQuery === 'create') {
      this.createQuery()
        .flatMap(qIri => {
          return this.queryTemplateService.updateItem(iri, template.get(), qIri, namespace);
        })
        .onValue(this.onUpdateSuccess)
        .onError(this.onUpdateError);
    } else if (selectQuery === 'update') {
      this.updateQuery()
        .flatMap(() => {
          return this.queryTemplateService.updateItem(iri, template.get(), queryIri, namespace);
        })
        .onValue(this.onUpdateSuccess)
        .onError(this.onUpdateError);
    } else if (selectQuery === 'reference') {
      this.queryTemplateService
        .updateItem(iri, template.get(), existingQueryIri, namespace)
        .onValue(this.onUpdateSuccess)
        .onError(this.onUpdateError);
    }
  }

  private onChangeQuery = (query: Query, isValid: boolean) => {
    if (isValid) {
      this.query.plug(Kefir.constant(query));
    } else {
      this.query.plug(Kefir.constantError(query));
    }
  }

  private isInvalid = (value: Data.Maybe<Value>): boolean => {
    return Boolean(value.isJust && value.get().error);
  }

  private getQuerySection = (): ReactElement<any> => {
    const {selectQuery, queryIri, existingQueryIri, templateCount} = this.state;
    if (selectQuery === 'create') {
      return QueryValidator({
        query: this.state.query,
        onChange: this.onChangeQuery,
        onChangeVariables: v => this.setState({variables: v}),
      });
    } else if (selectQuery === 'update') {
      return D.div({},
        templateCount > 1
          ? FormText({muted: true},
            `* This query is used in ${templateCount}
             templates and inline editing is disabled. Click `,
            createElement(ResourceLink, {
              resource: Rdf.iri('http://www.metaphacts.com/resource/admin/EditBaseQuery'),
              params: {'queryiri': queryIri},
            }, 'here'),
            ' to edit the query.'
          )
          : null,
        QueryValidator({
          iri: queryIri,
          viewOnly: templateCount > 1,
          onChange: this.onChangeQuery,
          onChangeVariables: v => this.setState({variables: v}),
        })
      );
    } else if (selectQuery === 'reference') {
      const autoComplete = createElement(AutoCompletionInput, {
            query:
              `PREFIX bds: <http://www.bigdata.com/rdf/search#>
               PREFIX prov: <http://www.w3.org/ns/prov#>
                SELECT ?iri ?label ?text ?modified WHERE {
                  ?iri a sp:Query ;
                    sp:text ?text;
                    prov:generatedAtTime ?modified;
                    rdfs:label ?label;
                    prov:wasAttributedTo ?user.
                  FILTER(
                    ?user in (<http://www.metaphacts.com/resource/user/querycatalog>,?__useruri__)
                  )
                  FILTER(REGEX(STR(?label), ?__token__, \"i\"))
                } LIMIT 20
                `,
            defaultQuery:
              `PREFIX prov: <http://www.w3.org/ns/prov#>
              SELECT ?iri ?label ?text ?modified WHERE {
                  ?iri a sp:Query;
                    sp:text ?text;
                    prov:generatedAtTime ?modified;
                    prov:wasAttributedTo ?user.
                  FILTER(
                    ?user in (<http://www.metaphacts.com/resource/user/querycatalog>,?__useruri__)
                  )
                  OPTIONAL {?iri rdfs:label ?label}
                } ORDER BY DESC(?modified) LIMIT 10`,
            placeholder: 'Select query...',
            templates: {
              suggestion: `<mp-popover title="{{iri.value}}">
                  <mp-popover-trigger placement="top"trigger='["hover","focus"]'>
                    <span>{{label.value}} ({{dateTimeFormat modified.value "LLL"}})</span>
                  </mp-popover-trigger>
                  <mp-popover-content style="background:white;">
                      <div>{{text.value}}</div>
                  </mp-popover-content>
              </mp-popover>`,
            },
            actions: {
              onSelected: (res: SparqlClient.Binding) => {
                if (res) {
                  this.setState({existingQueryIri: res['iri'].value});
                } else {
                  this.setState({existingQueryIri: undefined, variables: []}, () => {
                    const query = {
                      label: '',
                      value: '',
                      type: '',
                      queryType: '',
                    } as Query;
                    this.query.plug(Kefir.constantError(query));
                  });
                }
              },
            },
          });
      return D.div({},
        FormGroup({},
          D.div({}, autoComplete)
        ),
        (existingQueryIri
          ? QueryValidator({
            iri: existingQueryIri,
            viewOnly: true,
            onChange: this.onChangeQuery,
            onChangeVariables: v => this.setState({variables: v}),
          })
          : null)
      );
    } else {
      return null;
    }
  }

  public render() {
    const {
      identifier,
      label,
      description,
      selectQuery,
      query,
      args,
      variables,
      existingQueryIri,
      template,
      inProgress,
    } = this.state;

    // TODO
    // we keep this invisible in edit mode
    // until we have clean-up the identifiers
    const identifierField =
      this.isUpdateMode()
      ? null
      : FormGroup({},
          FormLabel({}, 'Preferred Identifier*'),
          FormControl({
            type: 'text',
            value: identifier.isJust ? identifier.get().value : '',
            onChange: e => this.identifier.plug((e.currentTarget as any).value),
            disabled: this.isUpdateMode(),
            isInvalid: this.isInvalid(identifier),
          }),
          this.isInvalid(identifier)
            ? FormText({muted: true}, identifier.get().error.message)
            : null
        );

    const labelField = FormGroup({},
      FormLabel({}, 'Label*'),
      FormControl({
        type: 'text',
        value: label.isJust ? label.get().value : '',
        onChange: this.onLabelChanged,
        isInvalid: this.isInvalid(label),
      }),
      this.isInvalid(label)
        ? FormText({muted: true}, label.get().error.message)
        : null
    );

    const descriptionField = FormGroup({},
      FormLabel({}, 'Description*'),
      FormControl({
        as: 'textarea',
        style: {resize: 'vertical'},
        value: description.isJust ? description.get().value : '',
        onChange: this.onDescriptionChanged,
        isInvalid: this.isInvalid(description),
      } as ReactBootstrap.FormControlProps),
      this.isInvalid(description)
        ? FormText({muted: true}, description.get().error.message)
        : null
    );

    const selectQueryOptions = this.isUpdateMode()
      ? QUERY_OPTIONS
      : QUERY_OPTIONS.filter(item => {
        return item.value !== 'update';
      });

    const selectQueryField = FormGroup({},
      selectQueryOptions.map(
        opt => FormCheck({
          key: opt.value,
          id: 'selectQuery-' + opt.value,
          type: 'radio',
          value: opt.value,
          name: 'selectQuery',
          inline: true,
          label: opt.label,
          checked: opt.value === selectQuery,
          onClick: (e: React.ChangeEvent<HTMLInputElement>) => {
            const target = e.target;
            if (selectQuery !== target.value) {
              this.setState({selectQuery: target.value as EditMode, variables: []}, () => {
                const query = {
                  label: '',
                  value: '',
                  type: '',
                  queryType: '',
                } as Query ;
                this.query.plug(Kefir.constantError(query));
              });
            }
          },
        } as ReactBootstrap.FormCheckProps)
      )
    );

    const querySection = this.getQuerySection();

    const disableSave =
      template.isNothing
      || inProgress
      || (( existingQueryIri === undefined )
        && ((query === undefined) || (query.value === undefined)));

    return D.div({},
      labelField,
      identifierField,
      descriptionField,
      this.renderCategoriesField(),
      FormLabel({}, 'Query*'),
      Card({body: true, bg: 'light'}, selectQueryField, querySection),
      React.createElement(QueryTemplateArgumentsComponent, {
        args,
        variables,
        onAdd: this.addArgument,
        onDelete: this.deleteArgument,
        onChange: this.setArgument,
      }),
      Button(
        {
          variant: 'success',
          disabled: disableSave,
          onClick: this.isUpdateMode() ? this.updateTemplate : this.createTemplate,
        },
        this.isUpdateMode() ? 'Update' : 'Save'
      )
    );
  }

  private renderCategoriesField() {
    if (!this.props.categorySuggestionQuery) { return null; }

    return FormGroup({},
      FormLabel({}, 'Categories'),
      createElement(AutoCompletionInput, {
        query: this.props.categorySuggestionQuery,
        defaultQuery: this.props.categoryDefaultQuery,
        placeholder: 'Select categories',
        multi: true,
        value: this.state.categories,
        actions: {
          onSelected: (bindings: SparqlClient.Binding[]) => {
            const categories: ReadonlyArray<SparqlClient.Binding> = bindings;
            this.setState({categories}, () => {
              // FIXME: get rid of all pools
              // This is a hack to trigger template generation
              if (this.state.label.isJust) {
                this.label.plug(Kefir.constant(this.state.label.get().value));
              }
            });
          },
        },
      })
    );
  }

  private onLabelChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldSource = this.state.label.map(old => old.value);
    const newSource = (e.currentTarget as any).value;

    const newIdentifier = mapIfCorresponds({
      oldSource, newSource,
      oldTarget: this.state.identifier.map(({value}) => value),
      mapping: slugFromName,
    });
    const newDescription = mapIfCorresponds({
      oldSource, newSource,
      oldTarget: this.state.description.map(({value}) => value),
    });
    const newQueryLabel = mapIfCorresponds({
      oldSource, newSource,
      oldTarget: fromNullable(this.state.query).map(query => query.label),
    });

    this.label.plug(Kefir.constant(newSource));
    if (newIdentifier.isJust) {
      // autofill identifier based on template label
      this.identifier.plug(Kefir.constant(newIdentifier.get()));
    }
    if (newDescription.isJust) {
      // autofill template description based on template label
      this.description.plug(Kefir.constant(newDescription.get()));
    }
    if (newQueryLabel.isJust) {
      // autofill query description based on template label
      this.query.plug(Kefir.constant({
        ...this.state.query,
        label: newQueryLabel.get(),
      }));
    }
  }

  private onDescriptionChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const oldSource = this.state.description.map(old => old.value);
    const newSource = (e.currentTarget as any).value;

    const newQueryLabel = mapIfCorresponds({
      oldSource, newSource,
      oldTarget: fromNullable(this.state.query).map(query => query.label),
    });

    this.description.plug(Kefir.constant(newSource));
    if (newQueryLabel.isJust) {
      // autofill query description based on template description
      this.query.plug(Kefir.constant({
        ...this.state.query,
        label: newQueryLabel.get(),
      }));
    }
  }
}

function mapIfCorresponds(params: {
  oldSource: Data.Maybe<string>,
  oldTarget: Data.Maybe<string>,
  newSource: string,
  mapping?: (source: string) => string,
}): Data.Maybe<string> {
  const {oldSource, newSource, mapping = ((v: string) => v)} = params;
  const oldTarget = params.oldTarget.getOrElse(undefined);
  const generateTarget = !oldTarget || params.oldSource
    .map(mapping)
    .map(mapped => oldTarget === mapped)
    .getOrElse(false);
  return generateTarget ? Just(mapping(newSource)) : Nothing<string>();
}

export default QueryTemplate;
