/*
 * Copyright (C) 2022, © Swiss Art Research Infrastructure, University of Zurich
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
  createElement, CSSProperties, ReactElement, ReactNode, ComponentClass, Children,
} from 'react';
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { Component, } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { getThumbnail } from 'platform/api/services/resource-thumbnail';

import { NoResourceThumbnail } from './NoResourceThumbnail';

/**
 * Queries for and displays thumbnail image for specified resource IRI
 * with template support for custom formatting.
 *
 * **Example**:
 * ```
 * <sari-resource-thumbnail iri='http://example.com'
 *   style='max-width: 400px; max-height: 100px;'>
 * </sari-resource-thumbnail>
 * ```
 *
 * **Example**:
 * ```
 * <sari-resource-thumbnail iri='http://example.com'
 *   template='<img src="{{thumbnail}}'>">
 * </sari-resource-thumbnail>
 * ```
 */
interface ResourceThumbnailConfig {
  /** IRI of resource to fetch thumbnail for. */
  iri: string;
  /** URI of image to display when resource has no thumbnail. */
  noImageUri?: string;
  /** Additional class names for component root element. */
  className?: string;
  /** Additional styles for thumbnail element. */
  style?: CSSProperties;
  /** Optional text to append to URI title value */
  title?: string;
  /**
   * Template that gets the thumbnail as a parameter. Can be used with `{{thumbnail}}`.
   */
  template?: string;
  /**
   * Template which is applied when there is no thumbnail.
   */
  noResultTemplate?: string;
}

export type ResourceThumbnailProps = ResourceThumbnailConfig;

interface State {
  imageUri?: string | null;
  error?: any;
}

export class ResourceThumbnailExtended extends Component<ResourceThumbnailProps, State> {
  private subscription: Kefir.Subscription;

  constructor(props: ResourceThumbnailProps, context: any) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.fetchThumbnailUrl(Rdf.iri(this.props.iri));
  }

  componentWillReceiveProps(nextProps: ResourceThumbnailProps) {
    const {iri} = this.props;
    if (nextProps.iri !== iri) {
      this.setState({imageUri: undefined});
      this.subscription.unsubscribe();
      this.fetchThumbnailUrl(Rdf.iri(nextProps.iri));
    }
  }

  componentWillUnmount() {
    this.subscription.unsubscribe();
  }

  private fetchThumbnailUrl(resourceIri: Rdf.Iri) {
    this.subscription =
      getThumbnail(resourceIri)
      .observe({
        value: imageUri => this.setState({imageUri}),
        error: error => this.setState({imageUri: undefined, error}),
      });
  }

  render() {
    const {className, style, template, noResultTemplate} = this.props;
    const {imageUri, error} = this.state;

    if (error) {
      return createElement(ErrorNotification, {className, errorMessage: error});
    } else if (imageUri === undefined) {
      return createElement(Spinner, {className});
    } else if (imageUri === null) {
      if (noResultTemplate) {
        return createElement(TemplateItem, {template: { source: noResultTemplate}})
      } else {
        return null;
      }
    } else {
      const imageSrc = typeof this.state.imageUri === 'string'
        ? this.state.imageUri : this.props.noImageUri;
      if (typeof imageSrc !== 'string') {
        // use fallback component only if neither imageUri or noImageUri present
        const fallbackComponent = this.findComponent(
          Children.toArray(this.props.children), NoResourceThumbnail);
        if (fallbackComponent) {
          return fallbackComponent;
        }
        return null;
      }

      const templateString = this.getTemplateString(template);
      return createElement(TemplateItem, {template: {source: templateString, options: {thumbnail: imageUri}}, componentProps: {style, className}});
    }

  }
  /**
     * Returns a handlebars template for displaying the thumbnail. If the user
     * provided a custom template, that one is returned. Otherwise a default template
     * is used, which shows the description and takes the inlineHtml setting into account.
     *
     * @param template Custom template
     * @param description Description to show inside the tempalte
     * @returns {string}
     */
 private getTemplateString = (template: string): string => {
  if (template) {
    return template;
  }

  const thumbnailBinding = '{{thumbnail}}';
  return `<img src="${thumbnailBinding}" >`;
}
  
  private onError = (error: any) => {
    console.error(error);
    this.setState({
      imageUri: undefined,
      error: `Image is not accessible, probably invalid URL, CORS or mixed content error (loading HTTP resource from HTTPS context)!`
    });
  }

  private findComponent =
    (children: Array<ReactNode>, component: ComponentClass<any>): ReactElement<any> => {
      const element =
        _.find(
          children, child => (child as React.ReactElement<any>).type === component
        ) as ReactElement<any>;
      return element;
    }
}
export default ResourceThumbnailExtended;
