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
import { Component, ValidationMap } from 'react';
import * as PropTypes from 'prop-types';

import * as TemplateService from 'platform/api/services/template';

import { SemanticContext, SemanticContextTypes } from './SemanticContext';
import { TemplateContext, TemplateContextTypes } from './TemplateContext';

export type ComponentContext = SemanticContext & TemplateContext;
export const ContextTypes: ValidationMap<any> = {
  ...SemanticContextTypes,
  ...TemplateContextTypes,
};

export type ComponentChildContext = TemplateContext;

export interface ComponentProps {
  /**
   * Scope with templates explicitly specified in the markup.
   *
   * If present then it means the component had been created from markup;
   * otherwise it has been created as part of another component.
   *
   * This property should be used only as implementation detail to template-related
   * components (like `SemanticIf`).
   */
  readonly markupTemplateScope?: TemplateService.TemplateScope;
  readonly markupDataContext?: TemplateService.DataContext;
}

const ComponentPropTypes: { [K in keyof ComponentProps]?: any } = {
  markupTemplateScope: PropTypes.object,
};

/**
 * @author Alexey Morozov
 */
export abstract class PlatformComponent<P, S> extends Component<P, S> {
  static propTypes: any = ComponentPropTypes;

  static childContextTypes: any = TemplateContextTypes;

  static readonly contextTypes: any = ContextTypes;
  readonly context: ComponentContext;

  get appliedTemplateScope(): TemplateService.TemplateScope {
    const {markupTemplateScope} = this.props as ComponentProps;
    if (markupTemplateScope) {
      return markupTemplateScope;
    }
    const inheritedScope = this.context.templateScope;
    return inheritedScope || TemplateService.TemplateScope.empty();
  }

  constructor(props: P, context: any) {
    super(props, context);
  }

  getChildContext(): ComponentChildContext {
    const {markupTemplateScope, markupDataContext} = this.props as ComponentProps;
    // resets template scope to explicitly provided one if
    // component have been created from markup
    return {
      templateScope: markupTemplateScope || this.context.templateScope,
      templateDataContext: markupDataContext || this.context.templateDataContext,
    };
  }
}
