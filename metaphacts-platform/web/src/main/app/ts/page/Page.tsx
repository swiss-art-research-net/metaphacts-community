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
  getCurrentResource,
  getCurrentUrl,
  getCurrentRepository,
  getCurrentView,
  PageView
} from 'platform/api/navigation';
import { BaseSemanticContextProvider } from 'platform/api/components';
import { ComponentsLoader } from 'platform/api/module-loader';
import {
  RepositoryConfigInitializer
} from 'platform/components/admin/repositories/RepositoryConfigInitializer';
import { DefaultRepositoryInfo } from 'platform/api/services/repository';
import { Cancellation } from 'platform/api/async';
import { listen as listenNav } from 'platform/api/navigation';
import * as PageService from 'platform/api/services/page';
import { Rdf } from 'platform/api/rdf';

import { PageToolbar } from './PageToolbar';
import { PageViewer } from './PageViewer';
import { KnowledgeGraphBar } from './KnowledgeGraphBar';

class State {
  // The currently shown page view
  pageView?: PageView;
  pageViewConfig?: PageService.PageViewConfig;
  /* view explicitly selected by the user */
  selectedView?: PageView;
  /* View names of the views that have been loaded. The views are loaded
   * lazily, so the are not rerendered when switching views. (e.g. page, graph)
   */
  loadedPageViews: Set<PageView>;
  knowledgeGraphBarShown: boolean;
  knowledgeGraphBarExpanded: boolean;

  /* currently shown resource */
  currentResource: Rdf.Iri;
  isEdit: boolean;
}

const DEFAULT_STATE = {
  loadedPageViews: new Set<PageView>([]),
  knowledgeGraphBarShown: false,
  knowledgeGraphBarExpanded: true,
};

export class PageComponent extends React.Component<{}, State> {
  // component lifetime
  private readonly componentCancellation = new Cancellation();
  // resource / navigatino lifetime
  private navigationCancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);

    this.state = {
      ...DEFAULT_STATE,
      currentResource: getCurrentResource(),
      isEdit: this.isEditUrl(getCurrentUrl()),
    };
  }

  render() {
    const currentResource = this.state.currentResource;

    // Params for PageViewers - exclude view param to avoid rerender on view change
    const paramsWithoutView = getCurrentUrl().search(true);
    delete paramsWithoutView.view;

    const props = {iri: currentResource, params: paramsWithoutView};
    const { pageViewConfig, isEdit } = this.state;

    const isBarOptional = pageViewConfig &&
    pageViewConfig.showKnowledgeGraphBarToggle &&
      !pageViewConfig.showKnowledgeGraphBar &&
      !isEdit;

    const barShown = (this.state.knowledgeGraphBarShown && !isEdit) || isBarOptional;
    const barExpanded = (barShown && this.state.knowledgeGraphBarExpanded);
    const hasBreadcrumbs = pageViewConfig && pageViewConfig.breadcrumbsTemplateIri;
    const barClasses = `
      ${barShown ? 'page--knowledgeGraphBarShown' : 'page--knowledgeGraphBarHidden'}
      ${barExpanded ? 'page--knowledgeGraphBarExpanded' : 'page--knowledgeGraphBarCollapsed'}
      ${hasBreadcrumbs ? 'page--hasBreadcrumbs' : 'page--noBreadcrumbs'}
      `;

    return <BaseSemanticContextProvider repository={getCurrentRepository()}>
      <div className={`page-holder page--${this.state.pageView}Active ${barClasses} ${isBarOptional ? 'isOptional' : ''}`}>

        { (pageViewConfig && pageViewConfig.breadcrumbsTemplateIri) ?
            <div className='mp-breadcrumbs-container'>
              <PageViewer iri={Rdf.iri(pageViewConfig.breadcrumbsTemplateIri)}
                context={currentResource}
                params={paramsWithoutView}
              ></PageViewer>
            </div>
             : null}

        <PageToolbar {...props}>
        </PageToolbar>

        { !pageViewConfig || isEdit ? null : <KnowledgeGraphBar
          iri={Rdf.iri(this.state.pageViewConfig.knowledgeGraphBarTemplateIri)}
          context={currentResource}
          params={props.params}
          show={barShown}
          isOptional={isBarOptional}
          onToggle={expanded => this.setState({knowledgeGraphBarExpanded: expanded})}
          />}

        {pageViewConfig ? this.renderPageComponent(currentResource, isEdit, props) : null}
      </div>
    </BaseSemanticContextProvider>;
  }

  private isEditUrl(uri: uri.URI) {
    return uri.hasQuery('action', 'edit');
  }

  toggleKnowledgeGraphBar() {
    this.setState({ knowledgeGraphBarShown: !this.state.knowledgeGraphBarShown });
  }

  private renderPageComponent(resource: Rdf.Iri, isEdit: boolean, props: any): React.ReactNode {
    if (DefaultRepositoryInfo.isValidDefault()) {
      if (isEdit) {
        return ComponentsLoader.factory({
          componentTagName: 'mp-internal-page-editor', componentProps: props,
        });
      } else {
        return this.renderPageViews(resource, props.params);
      }
    } else {
      return <RepositoryConfigInitializer />;
    }
  }

  private updatePageViewConfig(iri: Rdf.Iri) {
    // cancel navigation requests
    this.navigationCancellation.cancelAll();
    this.navigationCancellation = new Cancellation();

    this.navigationCancellation.map(
      PageService.PageService.getPageViewConfig(iri, getCurrentRepository())
    ).observe({
      value: pageViewConfig => {
        this.setState({
          currentResource: iri,
          pageViewConfig,
          isEdit: this.isEditUrl(getCurrentUrl()),
          knowledgeGraphBarShown: pageViewConfig.showKnowledgeGraphBar
        });
        this.updateView(pageViewConfig);
      },
      error: error => console.error('Error reading PageViewConfig', error)
    });
  }

  private updateView(pageViewConfig: PageService.PageViewConfig) {
    const urlView = getCurrentView();
    if (this.canUseViewFromUrl(pageViewConfig) && urlView) {
      this.setState({
        pageView: urlView,
        loadedPageViews: new Set<PageView>([urlView]),
      });

    } else if (this.state.selectedView && pageViewConfig.showKnowledgeGraphBar) {
      // user explicitly selected a view -> stay on view for new resource
      this.setState({
        pageView: this.state.selectedView,
        loadedPageViews: new Set<PageView>([this.state.selectedView])
      });
    } else {
        const pv = pageViewConfig.defaultView as PageView;
        this.setState({
          pageView: pv,
          loadedPageViews: new Set<PageView>([pv]),
          selectedView: null
        });
    }
  }

  /**
   * Renders page views. This returns at least one view (the currently active one). If multiple
   * views have been loaded for the current resource, all of them are returned.
   *
   * @param currentResource
   * @param params
   */
  private renderPageViews(currentResource: Rdf.Iri, params: any): React.ReactNode[] {


    // Page view. There is only one visible at the time, but potentially
    // multiple ones rendered, when changing between them.
    return Array.from(this.state.loadedPageViews.values(), loadedView =>
      <div
        key={loadedView}
        className={loadedView !== this.state.pageView ? 'hidden' : null}>

        <PageViewer
          iri={this.templateForView(currentResource, loadedView)}
          context={currentResource}
          params={params} />
      </div>
    );
  }

  private templateForView(currentResource: Rdf.Iri, view: PageView) {
    if (view === 'page') {
      return Rdf.iri(this.state.pageViewConfig.pageViewTemplateIri);
    }

    if (view === 'statements') {
      return Rdf.iri(this.state.pageViewConfig.statementsViewTemplateIri);
    }

    if (view === 'graph') {
      return  Rdf.iri(this.state.pageViewConfig.graphViewTemplateIri);
    }

    return currentResource;
  }

  private viewsWithNewView(view: PageView) {
    let loadedPageViews = this.state.loadedPageViews;
    if (!loadedPageViews.has(view)) {
      loadedPageViews = new Set(loadedPageViews).add(view);
    }
    return loadedPageViews;
  }

  /**
   * Returns whether the view from the URL can be taken into account
   * for the provided PageViewConfig.
   *
   * @param pageViewConfig
   */
  private canUseViewFromUrl(pageViewConfig: PageService.PageViewConfig) {
    // Don't use view from URL if there's no (at least optional) knowledge graph bar,
    // as it would allow users without permissions to get there and have no way to switch back.
    return pageViewConfig && (
      pageViewConfig.showKnowledgeGraphBar || pageViewConfig.showKnowledgeGraphBarToggle
    );
  }

  componentDidMount() {
    this.updatePageViewConfig(getCurrentResource());

    const unsubscribeNav = listenNav({
      eventType: 'NAVIGATED',
      callback: event => {
        const newResource = getCurrentResource();
        const newView = event.url.search(true)['view'];
        const isEdit = this.isEditUrl(event.url);

        if (this.state.currentResource.equals(newResource)) {
          // same resource -> navigation on view
          if (this.canUseViewFromUrl(this.state.pageViewConfig) && newView) {
            const loadedPageViews = this.viewsWithNewView(newView);
            this.setState({loadedPageViews, pageView: newView, selectedView: newView, isEdit});
          } else if (isEdit !== this.state.isEdit) {
            this.setState({isEdit});
            // the pageViewTemplateIri may change in the edit, so pageRenderInfo needs to be updated
            // going back to the page view happens implicitly through the pageRenderInfo
            if (!isEdit) {
              this.updatePageViewConfig(newResource);
            }
          }
        } else {
          this.updatePageViewConfig(newResource);
        }
      },
    });
    this.componentCancellation.onCancel(unsubscribeNav);
  }

  shouldComponentUpdate(nextProps: {}, nextState: State) {
    const currentResource = getCurrentResource();
    if (currentResource != null && !currentResource.equals(nextState.currentResource)) {
      // Inconsistent state, where the URL is updated, but the state of the resource is not yet.
      // This happens when props are updated from the outside. Avoid render in this state, as
      // render will happen once the navigation event listener updates the state.
      return false;
    }

    return true;
  }

  componentWillUnmount() {
    this.navigationCancellation.cancelAll();
    this.componentCancellation.cancelAll();
  }
}

export default PageComponent;
