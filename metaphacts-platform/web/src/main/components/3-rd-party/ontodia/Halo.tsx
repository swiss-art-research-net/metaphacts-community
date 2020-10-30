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
import * as React from 'react';
import {
  Halo as OntodiaHalo,
  HaloProps as OntodiaHaloProps,
  HaloTemplateProps,
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

export interface HaloProps extends OntodiaHaloProps {
  template?: string;
}

export interface HaloState {
  template: React.ComponentClass<HaloTemplateProps> | undefined;
}

export class Halo extends Component<HaloProps, HaloState> {
  readonly context: ComponentContext & OntodiaContextWrapper;
  static contextTypes = {
    ...ContextTypes,
    ...OntodiaContextTypes,
    ...WorkspaceContextTypes,
  };
  static defaultProps: Partial<HaloProps> = {
    id: 'halo',
  };
  static attachment = WidgetAttachment.OverElements;

  constructor(props: HaloProps, context: any) {
    super(props, context);
    this.state = {template: undefined};
    this.prepareHaloTemplate(props.template || ONTODIA_HALO_DEFAULT_TEMPLATE);
  }

  private prepareHaloTemplate = (template: string) => {
    const {inAuthoringMode, onShowInfo} = this.context.ontodiaContext;

    return this.appliedTemplateScope.prepare(template).map(compiledTemplate => {
      return class extends Component<HaloTemplateProps, {}> {
        readonly context: ComponentContext & WorkspaceContextWrapper;
        static contextTypes = WorkspaceContextTypes;

        constructor(props: HaloTemplateProps, context: any) {
          super(props, context);
        }

        render() {
          const {elementId} = this.props;
          const {editor, view} = this.context.ontodiaWorkspace;
          const target = editor.model.getElement(elementId);
          const context = {
            target, view, editor, onShowInfo,
          };
          const onlySelected = editor.selection.length === 1 && editor.selection[0] === target;

          if (inAuthoringMode()) {
            return <AuthoredEntity
              elementId={elementId}
              children={(authoredContext: AuthoredEntityContext) => {
                return <TemplateItem
                  template={{
                    source: compiledTemplate,
                    options: {
                      ...this.props,
                      canEdit: authoredContext.canEdit,
                      canDelete: authoredContext.canDelete,
                      onlySelected,
                    }
                  }}
                  componentMapper={component =>
                    mapTemplateComponent(component, context, authoredContext)}/>;
              }}/>;
          } else {
            return <TemplateItem
              template={{
                source: compiledTemplate,
                options: {...this.props, isSelected: onlySelected}
              }}
              componentMapper={component => mapTemplateComponent(component, context)}/>;
          }
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
      return <OntodiaHalo {...this.props}>{
          React.createElement(template)
        }</OntodiaHalo>;
    } else {
      return <Spinner/>;
    }
  }
}

export default Halo;
