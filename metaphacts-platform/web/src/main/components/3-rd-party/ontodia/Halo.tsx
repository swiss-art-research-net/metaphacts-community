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
import {
  Halo as OntodiaHalo,
  HaloTemplateProps,
  ConnectionsMenuCommands,
  EventSource,
  WorkspaceContextTypes,
  WidgetAttachment,
  AuthoredEntity,
  AuthoredEntityContext,
  WorkspaceContextWrapper,
} from 'ontodia';

import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import Spinner from 'platform/components/ui/spinner/Spinner';

import { OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';
import { subscribeOnConnectionsMenuCommands } from './NavigationMenu';
import { mapTemplateComponent } from './Canvas';
import * as styles from './Halo.scss';

const ONTODIA_HALO_DEFAULT_TEMPLATE = `
  <div style="pointer-events: none">
    <button class="${styles.removeButton}"
      name="removeSelectedElements">
      <i class="fa fa-times" aria-hidden="true"></i>
    </button>
  </div>
`;

/**
 * Allows selecting a node and triggering of actions.
 */
interface OntodiaHaloConfig {
  /**
   * Unique ID to register as Ontodia canvas widget and send events.
   *
   * @default "halo"
   */
  id?: string;
  /** @default true */
  scalable?: boolean;
  /** @default 5 */
  margin?: number;
  /**
   * Client-side template for Halo content.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  template?: string;
}

export type HaloProps = OntodiaHaloConfig;

// mapped from Ontodia.HaloTemplateProps and exported for documentation
interface OntodiaHaloTemplateData extends HaloTemplateProps {
  /**
   * `true` if the element is the only one that's selected
   */
  onlySelected: boolean;

  /**
   * `true` if the properties of the element can be edited
   */
  canEdit: boolean;

  /**
   * `true` if element can be deleted from the data
   */
  canDelete: boolean;
}

interface HaloState {
  template: React.ComponentClass<HaloTemplateProps> | undefined;
}

export class Halo extends Component<HaloProps, HaloState> {
  readonly context: ComponentContext & OntodiaContextWrapper;
  static contextTypes = {
    ...ContextTypes,
    ...OntodiaContextTypes,
    ...WorkspaceContextTypes,
  };

  static defaultProps: Pick<HaloProps, 'id' | 'scalable'> = {
    id: 'halo',
    scalable: true,
  };

  static attachment = WidgetAttachment.OverElements;

  private readonly commands = new EventSource<ConnectionsMenuCommands>();

  constructor(props: HaloProps, context: any) {
    super(props, context);
    this.state = {template: undefined};
  }

  componentDidMount() {
    const {ontodiaId} = this.context.ontodiaContext;
    const {id, template} = this.props;
    this.prepareHaloTemplate(template || ONTODIA_HALO_DEFAULT_TEMPLATE);
    subscribeOnConnectionsMenuCommands(this.commands, {id, ontodiaId});
  }

  private prepareHaloTemplate = (template: string) => {
    const ontodiaContext = this.context.ontodiaContext;

    return this.appliedTemplateScope.prepare(template).map(compiledTemplate => {
      return class extends Component<HaloTemplateProps, {}> {
        readonly context: ComponentContext & WorkspaceContextWrapper;
        static contextTypes = WorkspaceContextTypes;

        constructor(props: HaloTemplateProps, context: any) {
          super(props, context);
        }

        render() {
          const {elementId} = this.props;
          if (ontodiaContext.inAuthoringMode()) {
            return (
              <AuthoredEntity
                elementId={elementId}
                children={(authoredContext: AuthoredEntityContext) => {
                  return this.renderTemplate(authoredContext);
                }}
              />
            );
          } else {
            return this.renderTemplate();
          }
        }

        private renderTemplate(authoredContext?: AuthoredEntityContext) {
          const {elementId} = this.props;
          const workspace = this.context.ontodiaWorkspace;
          const {model, editor} = workspace;
          const target = model.getElement(elementId);
          const onlySelected = editor.selection.length === 1 && editor.selection[0] === target;
          const templateData: OntodiaHaloTemplateData = {
            ...this.props,
            onlySelected,
            inAuthoringMode: Boolean(authoredContext),
            canEdit: authoredContext ? authoredContext.canEdit : false,
            canDelete: authoredContext ? authoredContext.canDelete : false,
          };
          return (
            <TemplateItem
              template={{source: compiledTemplate, options: templateData}}
              componentMapper={component => mapTemplateComponent(component, {
                target,
                ontodiaContext,
                workspace,
                authoredContext,
              })}
            />
          );
        }
      };
    }).observe({
      value: completeTemplate => {
        this.setState({template: completeTemplate});
      }
    });
  }

  render() {
    const {template} = this.state;
    if (template) {
      return (
        <OntodiaHalo commands={this.commands} {...this.props}>
          {React.createElement(template)}
        </OntodiaHalo>
      );
    } else {
      return <Spinner />;
    }
  }
}

export default Halo;
