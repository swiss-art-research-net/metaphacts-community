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
import { createElement, ReactElement, cloneElement } from 'react';
import * as D from 'react-dom-factories';
import { isEqual } from 'lodash';
import * as classNames from 'classnames';
import * as Maybe from 'data.maybe';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import {
  CompiledTemplate, TemplateScope, mergeInContextOverride,
} from 'platform/api/services/template';
import { ModuleRegistry } from 'platform/api/module-loader';

import { ErrorNotification } from 'platform/components/ui/notification';

export interface TemplateItemProps {
  template: Template;
  componentProps?: {
    [key: string]: any;
  };
  componentMapper?: (component: JSX.Element) => JSX.Element;
}

type Template = {
  source: string | CompiledTemplate;
  options?: {};
};

interface State {
  compiledTemplate?: CompiledTemplate;
  renderedTemplate?: ReactElement<any> | ReactElement<any>[];
  error?: any;
}

/**
 * Helper component that renders parametrized handlebars templates to react elements.
 */
export class TemplateItem extends Component<TemplateItemProps, State> {
  private compilation = Cancellation.cancelled;

  constructor(props: TemplateItemProps, context: any) {
    super(props, context);
    this.state = {
      renderedTemplate: null,
    };
  }

  componentDidMount() {
    this.compileTemplate(this.props);
  }

  componentWillReceiveProps(props: TemplateItemProps) {
    if (!templateEqual(props.template, this.props.template)) {
      const {compiledTemplate} = this.state;
      if (compiledTemplate && templateSourceEqual(props.template, this.props.template)) {
        this.renderTemplate(props, compiledTemplate);
      } else {
        this.compileTemplate(props);
      }
    }
  }

  shouldComponentUpdate(nextProps: TemplateItemProps, nextState: State) {
    return !(
      templateEqual(this.props.template, nextProps.template) &&
      shallowEqual(this.props.componentProps, nextProps.componentProps) &&
      this.props.componentMapper === nextProps.componentMapper &&
      shallowEqual(this.state, nextState)
    );
  }

  componentWillUnmount() {
    this.compilation.cancelAll();
  }

  render() {
    if (this.state.error) {
      return createElement(ErrorNotification, {errorMessage: this.state.error});
    }

    const {componentProps, componentMapper, children} = this.props;
    const {renderedTemplate: parsedTemplate} = this.state;
    const root = tryUnwrapSingleChild(parsedTemplate);

    let component: ReactElement | ReactElement[];
    if (typeof root === 'string') {
      component = D.span({}, root);
    } else if (Array.isArray(root)) {
      component = root;
    } else if (root) {
      component = cloneElement(root, {
        ...componentProps,
        ...root.props,
        className: classNames(
          Maybe.fromNullable(componentProps).map(cp => cp.className).getOrElse(''),
          root.props.className
        ),
        children: root.props.children,
      });
    } else {
      component = null;
    }

    if (component && componentMapper) {
      component = Array.isArray(component)
        ? component.map(componentMapper)
        : componentMapper(component);
    }

    return children ? [component, children] : component;
  }

  private compileTemplate(props: TemplateItemProps) {
    this.compilation.cancelAll();
    const templateSource = props.template.source;
    if (!templateSource) {
      this.renderTemplate(props, TemplateScope.emptyTemplate());
    } else if (typeof templateSource === 'string') {
      this.compilation = new Cancellation();
      this.compilation.map(this.appliedTemplateScope.prepare(templateSource)).observe({
        value: compiledTemplate => this.renderTemplate(props, compiledTemplate),
        error: error => this.setState({compiledTemplate: undefined, error}),
      });
    } else {
      this.renderTemplate(props, templateSource);
    }
  }

  private renderTemplate(props: TemplateItemProps, compiledTemplate: CompiledTemplate) {
    const {templateDataContext} = this.context;
    const dataContext = mergeInContextOverride(templateDataContext, props.template.options);
    try {
      const nodes = compiledTemplate(dataContext);
      const renderedTemplate = ModuleRegistry.mapHtmlTreeToReact(nodes);
      this.setState({compiledTemplate, renderedTemplate, error: undefined});
    } catch (err) {
      this.setState({compiledTemplate, renderedTemplate: undefined, error: err});
    }
  }
}

function templateEqual(a: Template, b: Template) {
  return a === b || (a.source === b.source && isEqual(a.options, b.options));
}

function templateSourceEqual(a: Template, b: Template) {
  return a === b || a.source === b.source;
}

function shallowEqual<T>(a: T, b: T) {
  if (Object.is(a, b)) { return true; }
  if (typeof a !== 'object' || typeof b !== 'object') { return false; }
  for (const key in a) {
    if (!a.hasOwnProperty(key)) { continue; }
    if (!b.hasOwnProperty(key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  for (const key in b) {
    if (!b.hasOwnProperty(key)) { continue; }
    if (!a.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

function tryUnwrapSingleChild(parsed: ReactElement<any> | ReactElement<any>[]) {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return null;
    } else if (parsed.length > 1) {
      return parsed;
    } else {
      return parsed[0];
    }
  } else {
    return parsed;
  }
}
