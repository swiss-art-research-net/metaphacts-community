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
import * as SparqlJs from 'sparqljs';
import * as React from 'react';
import { Component, ComponentContext } from 'platform/api/components';
import { navigateToResource, refresh } from 'platform/api/navigation';
import { SparqlClient, SparqlUtil, QueryVisitor } from 'platform/api/sparql';
import { extractParams } from 'platform/api/navigation/NavigationUtils';
import { Rdf } from 'platform/api/rdf';
import { ErrorNotification, ErrorPresenter } from 'platform/components/ui/notification';
import * as UpdateEvents from './SemanticUpdateEvents';
import { trigger } from 'platform/api/events';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import { Cancellation } from 'platform/api/async';
import { isValidChild } from 'platform/components/utils';


interface ConfirmationOptions {
  /**
   * Confirmation question.
   */
  message?: string;

  /**
   * Label for the confirm button.
   */
  confirmLabel?: string;

  /**
   * Label for the cancel button.
   */
  cancelLabel?: string;
}

export interface SemanticUpdateConfig {
  /**
   * SPARQL UPDATE query string.
   */
  query: string;

  /**
   * List of all variables in the query that are not required to be set through a parameter.
   * This is to avoid unintended modification of data caused by missing parameters.
   * An error is shown if a variable is found that is not part of this list.
   */
  variableParams?: ReadonlyArray<string>;

  /**
   * Action to perform after the query was successfully executed.
   * Can be either `none`, `reload`, `event` or any IRI string to which to redirect.
   *
   * @default none
   */
  postAction?: string;

  /**
   * Whether to show a confirmation question before the query is executed.
   */
  showConfirmation?: boolean

  /**
   * Options to customize the confirmation dialog. Applies only if `showConfirmation` is set.
   */
  confirmationOptions?: ConfirmationOptions;

  /**
   * Used as source id for emitted events.
   */
  id?: string;
}

interface State {
  query?: SparqlJs.Update;
  isRunning: boolean;
  error: any;
  queryError: any;

  // for updating state derived on props
  prevQuery?: string;
  prevVariableParams?: ReadonlyArray<string>;
}

const QUERY_PARAM_PREFIX = 'queryparam';
const REDIRECT_PARAM_PREFIX = 'redirect';

export class SemanticUpdate extends Component<SemanticUpdateConfig, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: SemanticUpdateConfig, context: any) {
    super(props, context);
    this.state = {
      isRunning: false,
      error: undefined,
      queryError: undefined,
    };
  }

  static getDerivedStateFromProps(props: SemanticUpdateConfig, state: State): Partial<State> {
    if (
      props.query !== state.prevQuery ||
      props.variableParams !== state.prevVariableParams
    ) {
      return {
        ...getStateForProps(props),
        prevQuery: props.query,
        prevVariableParams: props.variableParams,
      }
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    if (this.props.postAction === 'event' && this.props.id == null) {
      return <ErrorNotification
        errorMessage={'If post-action is set to \'event\', the \'id\' needs to be set as well.'}>
      </ErrorNotification >;
    }
    if (this.state.error) {
      return <ErrorNotification errorMessage={this.state.error}></ErrorNotification>;
    } else if (this.state.query) {
      const child = React.Children.only(this.props.children);
      if (!isValidChild(child)) {
        return <ErrorNotification errorMessage='Component requires a valid child element, e.g. button'></ErrorNotification>;
      }
      const props = { onClick: () => this.onClick(), disabled: this.state.isRunning };
      return <>
        {React.cloneElement(child as React.ReactElement<any>, props)}
        {this.state.queryError ? <ErrorPresenter
          error={this.state.queryError}
          className='update-query-error alert alert-danger'>
        </ErrorPresenter> : null}
      </>;
    } else {
      return null;
    }
  }


  private onClick() {
    const execute = () => this.executeQuery(this.props, this.context);
    if (!this.props.showConfirmation) {
      execute();
    } else {
      this.showConfirmationDialog(this.props.confirmationOptions, execute);
    }
  }

  private showConfirmationDialog(options: ConfirmationOptions, execute: () => void) {
    const dialogRef = 'update-confirm';
    const onHide = () => getOverlaySystem().hide(dialogRef);
    getOverlaySystem().show(
      dialogRef,
      <ConfirmationDialog
        message={options?.message ?? 'Do you really want to run this action?'}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        onHide={onHide}
        onConfirm={confirm => {
          onHide();
          if (confirm) {
            execute();
          }
        }}
      />
    );
  }

  /**
   * Executes the SPARQL Select query and pushes results to state on value.
   */
  private executeQuery(
    props: SemanticUpdateConfig,
    { semanticContext: context }: ComponentContext
  ): void {
    this.setState({ isRunning: true });

    this.cancellation.map(
      SparqlClient.executeSparqlUpdate(this.state.query, { context })
    ).observe({
      value: result => {
        this.setState({
          isRunning: false
        });
        this.performPostAction(props);
      },
      error: error => {
        this.setState({ isRunning: false });
        if (props.postAction === 'event') {
          trigger({
            eventType: UpdateEvents.Error,
            source: props.id,
            data: { error }
          });
        } else {
          this.setState({ queryError: error });
        }
      }
    });
  }

  private performPostAction(props: SemanticUpdateConfig) {
    const { postAction } = props;
    if (postAction === 'reload') {
      refresh();
    } else if (postAction === 'event') {
      trigger({
        eventType: UpdateEvents.Success,
        source: props.id,
        data: {}
      });
    } else if (postAction != null && postAction !== 'none') {
      const redirectParams = extractParams(props, REDIRECT_PARAM_PREFIX);
      navigateToResource(Rdf.iri(this.props.postAction), redirectParams).observe({});
    }
  }
}

function getStateForProps(props: SemanticUpdateConfig): Partial<State> {
  const updateQuery = SparqlUtil.parseQuery(props.query);
  if (updateQuery.type !== 'update') {
    return { error: 'Query is not an UPDATE query' };
  }

  const params = extractParams(props, QUERY_PARAM_PREFIX);
  const stringParams: SparqlClient.Dictionary<Rdf.Literal> = {};
  Object.keys(params).forEach(key => {
    stringParams[key] = Rdf.literal(params[key]);
  });

  const queryWithParams = SparqlClient.setBindings(updateQuery, stringParams);

  const variableParams = props.variableParams ?? [];
  const requiredVariables = getUnboundRequiredVariables(queryWithParams, variableParams);
  if (requiredVariables.size > 0) {
    return {
      error: 'Query contains non-optional variables. ' +
        'If they don\'t need to be provided as parameter, mark them ' +
        'with the variable-params option. Variables: ' +
        Array.from(requiredVariables).join(', ')
    };
  } else {
    return { query: queryWithParams, error: undefined };
  }
}

function getVariables(query: SparqlJs.Update): Set<string> {
  const res = new Set<string>();
  const varVisitor = new class extends QueryVisitor {
    variableTerm(variableTerm: SparqlJs.VariableTerm) {
      res.add(variableTerm.value);
      return super.variableTerm(variableTerm);
    }
  };

  varVisitor.update(query);
  return res;
}

function getUnboundRequiredVariables(
  query: SparqlJs.Update,
  variableParams: ReadonlyArray<string>
): Set<string> {
  const variables = getVariables(query);
  for (const optional of variableParams) {
    variables.delete(optional);
  }
  return variables;
}




export default SemanticUpdate;
