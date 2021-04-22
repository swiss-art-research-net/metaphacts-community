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
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import * as React from 'react';
import { ReactElement, Component } from 'react';
import { Button, ButtonToolbar } from 'react-bootstrap';
import * as uri from 'urijs';
import * as moment from 'moment';

import { navigateToResource, navigateToUrl } from 'platform/api/navigation';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';
import {
  PageService, TemplateContent, TemplateStorageStatus, RevisionInfo
} from 'platform/api/services/page';
import {
  ResourceLink, ResourceLinkAction, navigationConfirmation
} from 'platform/components/navigation';

import * as monaco from 'platform/components/3-rd-party/monaco/MonacoBundle';
import {
  MonacoEditor, tryExpandTemplateInclude,
} from 'platform/components/3-rd-party/monaco/MonacoEditor';
import {
  MonacoWorkerManager, trackModelChanges,
} from 'platform/components/3-rd-party/monaco/MonacoWorkerManager';
import {
  loadBundledTemplateLanguageData, getTemplateLanguageOptions, updateTemplateLanguageOptions,
} from 'platform/components/3-rd-party/monaco/TemplateLanguageDefinition';
import {
  TEMPLATE_INCLUDE_SCHEMA,
} from 'platform/components/3-rd-party/monaco/TemplateLanguageWorkerCommon';
import {
  TemplateLinkProviderAdapter,
} from 'platform/components/3-rd-party/monaco/TemplateLanguageWorkerAdapters';

import { StorageSelector, chooseDefaultTargetApp } from 'platform/components/admin/config-manager';
import { getOverlaySystem, OverlayDialog } from 'platform/components/ui/overlay';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import { ErrorPresenter, addNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

import {
  WorkspaceLayout, WorkspaceRow, WorkspaceColumn, WorkspaceItem,
} from 'platform/components/3-rd-party/ontodia/workspace';

import '../../scss/page-editor.scss';

interface PageEditorProps {
  iri: Rdf.Iri;
}

interface PageEditorState {
  pageSource?: TemplateContent;
  includes?: ReadonlyArray<Rdf.Iri>;
  loadingIncludes?: boolean;
  storageStatus?: ReadonlyArray<TemplateStorageStatus>;
  targetApp?: string;
  enableDiagnostics?: boolean;
  saving?: boolean;
  loading?: boolean;
}

const CLASS_NAME = 'page-editor';

class PageEditorComponent extends Component<PageEditorProps, PageEditorState> {
  private editor: monaco.editor.IStandaloneCodeEditor | undefined;

  private providerLoading = new monaco.CancellationTokenSource();
  private providerRegistration: monaco.IDisposable | undefined;
  private linkProvider: monaco.languages.LinkProvider | undefined;

  private navigationListenerUnsubscribe?: () => void;
  private pageInfo: RevisionInfo[];

  constructor(props: PageEditorProps, context: any) {
    super(props, context);
    const languageOptions = getTemplateLanguageOptions();
    this.state = {
      pageSource: {
        appId: undefined,
        revision: undefined,
        date: undefined,
        author: undefined,
        source: '',
        definedByApps: [],
        applicableTemplates: [],
        appliedTemplate: undefined,
        appliedKnowledgePanelTemplate: undefined,
      },
      includes: [],
      loadingIncludes: true,
      storageStatus: [],
      enableDiagnostics: languageOptions.diagnostics,
      saving: false,
      loading: false,
    };
  }

  public componentWillUnmount() {
    this.onWindowResize.cancel();
    this.onLayoutResize.cancel();
    window.addEventListener('resize', this.onWindowResize);
    this.providerLoading.cancel();
    this.removeNavigationConfirmation();
    if (this.providerRegistration) {
      this.providerRegistration.dispose();
    }
  }

  public componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
    this.loadPageSource(this.props.iri.value);
  }

  public componentWillReceiveProps(props: PageEditorProps) {
    this.loadPageSource(props.iri.value);
  }

  /**
   * We want to trigger react reconciliation only when we load new page to view or
   * switching between highlight modes.
   */
  public shouldComponentUpdate(nextProps: PageEditorProps, nextState: PageEditorState) {
    if (!_.isEqual(this.props, nextProps)) {
      return true;
    } else {
      return !(
        nextProps.iri.value === this.props.iri.value &&
        nextState.pageSource === this.state.pageSource &&
        nextState.includes === this.state.includes &&
        nextState.storageStatus === this.state.storageStatus &&
        nextState.enableDiagnostics === this.state.enableDiagnostics &&
        nextState.saving === this.state.saving &&
        nextState.loading === this.state.loading &&
        nextState.targetApp === this.state.targetApp
      );
    }
  }

  public render() {
    return <div className={`page--fullheight ${CLASS_NAME}`}>
      <style>{'body { overflow: hidden; }'}</style>
      {/* render spacer to reserve height if breadcrumbs bar is missing */}
      <div className='page-editor__breadcrumbs-spacer' />
      <div className='page-editor__body'>
        <WorkspaceLayout key={this.props.iri.value} _onResize={this.onLayoutResize}>
          <WorkspaceRow>
            <WorkspaceItem id='page-editor-main-part' undocked={true}>
              <div className='page-editor__main-part'>
                <div className='page-editor__header'>
                  {this.renderEditorSettings()}
                  {this.renderRevisionInfo()}
                </div>
                <MonacoEditor ref={this.onEditorDidMount}
                  className='template-editor'
                  language='mp-template'
                  automaticLayout={true}
                  fixedOverflowWidgets={true}
                />
                {this.renderAppSelector()}
                <ButtonToolbar className='page-editor__button-toolbar'>
                  <Button variant='danger'
                    disabled={this.isDeleteBtnDisabled()}
                    onClick={this.onClickDeleteBtn}>
                    Delete Page
                  </Button>
                  <div className='page-editor__button-spacer' />
                  <Button variant='default'
                    disabled={this.state.saving}
                    style={{backgroundColor: 'lightGrey'}}
                    onClick={this.onCancel}>
                    Cancel
                  </Button>
                  <Button variant='primary'
                    onClick={() => this.onSave({navigateToPage: true})}
                    disabled={this.state.saving}
                    title='Save and view the page (Ctrl/⌘+S)'>
                    {this.state.saving
                      ? <span>Saving
                          <i className='fa fa-cog fa-spin' style={{marginLeft: '5px'}} />
                        </span>
                      : <span>Save &amp; View</span>
                    }
                  </Button>
                  <Button variant='default'
                    onClick={() => this.onSave()}
                    disabled={this.state.saving}
                    title='Save the page and keep editor open (Ctrl/⌘+Shift+S)'>
                    Save
                  </Button>
                </ButtonToolbar>
              </div>
            </WorkspaceItem>
            <WorkspaceColumn defaultSize={400} >
              <WorkspaceItem id='page-editor-includes' heading='Template includes'>
                {this.renderIncludes()}
              </WorkspaceItem>
              <WorkspaceItem id='page-editor-templates' heading='Applicable templates'>
                {this.renderAppliedTemplates()}
              </WorkspaceItem>
              <WorkspaceItem id='page-editor-panel-templates' heading='Knowledge Panel templates'>
                {this.renderKnowledgePanelTemplates()}
              </WorkspaceItem>
            </WorkspaceColumn>
          </WorkspaceRow>
        </WorkspaceLayout>
      </div>
    </div>;
  }

  private isDeleteBtnDisabled = () => {
    const {saving, storageStatus, pageSource} = this.state;
    // Disabled if the page doesn't exist or the storage is readonly
    // i.e the appID is either null or undefined.
    return (
      saving ||
      !pageSource.appId ||
      !storageStatus.some(status => status.appId === pageSource.appId && status.writable)
    );
  }

  private onEditorDidMount = (editor: MonacoEditor | null) => {
    if (this.providerRegistration) {
      this.providerRegistration.dispose();
      this.providerRegistration = undefined;
    }
    if (editor) {
      this.editor = editor.getEditor();
      const {pageSource, loading} = this.state;
      this.editor.updateOptions({
        wordWrap: 'on',
        wrappingIndent: 'same',
        tabSize: 2,
        detectIndentation: false,
      });
      this.editor.setValue(loading ? 'Loading...' : pageSource.source);
      this.removeNavigationConfirmation();
      if (loading) {
        this.editor.updateOptions({readOnly: true});
      }
      this.editor.onDidChangeModelContent(this.onPageContentChange);
      this.editor.addAction({
        id: 'save-page',
        label: 'Save page',
        keybindings: [
          // tslint:disable-next-line: no-bitwise
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KEY_S,
        ],
        run: () => this.onSave(),
      });
      this.editor.addAction({
        id: 'save-and-view-page',
        label: 'Save & View',
        keybindings: [
          // tslint:disable-next-line: no-bitwise
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S,
        ],
        run: () => this.onSave({navigateToPage: true}),
      });
      this.registerLanguageProviders();
    }
  }

  private onWindowResize = _.debounce(() => {
    this.recalculateEditorLayout();
  }, 250);

  private onLayoutResize = _.debounce(() => {
    this.recalculateEditorLayout();
  }, 250);

  private recalculateEditorLayout() {
    if (this.editor) {
      this.editor.layout({width: 1, height: 1});
      this.editor.layout();
    }
  }

  private registerLanguageProviders() {
    this.providerLoading.cancel();
    this.providerLoading = new monaco.CancellationTokenSource();
    const loadingCancellationToken = this.providerLoading.token;
    loadBundledTemplateLanguageData().then(languageData => {
      if (loadingCancellationToken.isCancellationRequested) {
        return;
      }
      const workerManager = new MonacoWorkerManager<any>({
        moduleId: 'vs/language/html/htmlWorker',
        label: 'mp-template',
        createData: {
          languageId: 'mp-template',
          languageSettings: languageData,
        },
      });
      this.linkProvider = new TemplateLinkProviderAdapter(
        (...uris) => workerManager.getWorker(...uris)
      );
      let cancelSource = new monaco.CancellationTokenSource();
      const modelListener = trackModelChanges({
        editor: this.editor,
        debounceInterval: 1000,
        onAddOrChange: async model => {
          cancelSource.cancel();
          cancelSource = new monaco.CancellationTokenSource();
          const cancelToken = cancelSource.token;
          const linkList = await this.linkProvider.provideLinks(model, cancelToken);

          if (cancelToken.isCancellationRequested) { return; }

          const includes: Rdf.Iri[] = [];
          const includeSet = new Set<string>();
          for (const link of linkList.links) {
            const url = link.url.toString();
            if (url.startsWith(TEMPLATE_INCLUDE_SCHEMA)) {
              const rawInclude = url.substring(TEMPLATE_INCLUDE_SCHEMA.length);
              const resource = tryExpandTemplateInclude(rawInclude);
              if (!includeSet.has(resource.value)) {
                includeSet.add(resource.value);
                includes.push(resource);
              }
            }
          }
          this.setState({includes, loadingIncludes: false});
        }
      });
      this.providerRegistration = {
        dispose: () => {
          cancelSource.cancel();
          workerManager.dispose();
          modelListener.dispose();
        }
      };
    });
  }

  private onClickDeleteBtn = () => {
    this.pageInfo = [{
      appId: this.state.pageSource.appId,
      iri: this.props.iri.value,
      revision: this.state.pageSource.revision
    }];
    const dialogRef = 'deletion-confirmation';
    const onHide = () => getOverlaySystem().hide(dialogRef);
    getOverlaySystem().show(
      dialogRef,
      <ConfirmationDialog
        message='Do you really want to delete this template?'
        onHide={onHide}
        onConfirm={(confirm: boolean) => {
          onHide();
          if (confirm) {
            this.removeNavigationConfirmation();
            this.deletePage();
          }
        }}
      />
    );
  }

  private deletePage = () => {
    PageService.deleteTemplateRevisions(this.pageInfo).observe({
      value: success => {
        if (success) {
          navigateToUrl(uri('/')).observe({/**/});
        }
      },
      error: err => {
        this.setState({
          loading: true,
        });
        const dialogRef = `page-saving-error`;

        getOverlaySystem().show(
          dialogRef,
          <OverlayDialog
            onHide={() => {
              getOverlaySystem().hide(dialogRef);
              this.setState({ saving: false });
            }}
            type='modal'
            title='Error while deleting the page'
            show={true}>
            <div />
            <div><ErrorPresenter error={err} /></div>
            <Button variant='success'
              className='pull-right'
              onClick={() => {
                getOverlaySystem().hide(dialogRef);
                this.setState({ saving: false });
              }}>
              Ok
            </Button>
          </OverlayDialog>
        );
      },
    });
  }

  private isTemplateApplied(iri: Rdf.Iri, pageSource: TemplateContent) {
    return (
      // current resource is no template
      !iri.value.startsWith('Template:') &&
      // checks that the applied Template is not within the list of applicable templates
      // which is only the case if it is the default template
      pageSource.applicableTemplates.indexOf(pageSource.appliedTemplate) < 0 &&
      // TODO currently this is hardcoded also in backend
      // should be compare with config
      pageSource.appliedTemplate === 'Template:' + vocabularies.rdfs.Resource.value
    );
  }

  private loadPageSource = (pageIri: string) => {
    this.setState({loading: true});

    const pageSourceTask = PageService.loadTemplateSource(pageIri);
    pageSourceTask.onError(errorCode => {
      if (errorCode === 403) {
        window.location.href = '/login';
      }
    });

    Kefir.combine({
      pageSource: pageSourceTask,
      storageStatus: PageService.getStorageStatus(),
    }).observe({
      value: ({pageSource, storageStatus}) => {
        const targetApp = chooseDefaultTargetApp(storageStatus, pageSource.appId);
        this.setState({pageSource, storageStatus, targetApp, saving: false, loading: false}, () => {
          this.editor.focus();
          if (pageSource.source !== this.editor.getValue()) {
            this.editor.setValue(pageSource.source);
          }
          this.editor.updateOptions({readOnly: false});
          this.recalculateEditorLayout();
          this.removeNavigationConfirmation();
        });
      }
    });
  }

  private onPageContentChange = (e: monaco.editor.IModelContentChangedEvent) => {
    this.setupNavigationConfirmation();
    const source = this.editor.getValue();
    this.setState(state => {
      return {pageSource: {...state.pageSource, source}, saving: false};
    });
  }

  private setupNavigationConfirmation() {
    if (!this.navigationListenerUnsubscribe) {
      this.navigationListenerUnsubscribe = navigationConfirmation(
        'Changes you made to the page will not be saved.'
      );
    }
  }

  private removeNavigationConfirmation() {
    if (this.navigationListenerUnsubscribe) {
      this.navigationListenerUnsubscribe();
      this.navigationListenerUnsubscribe = undefined;
    }
  }

  private onSave(params: { navigateToPage?: boolean } = {}) {
    if (this.navigationListenerUnsubscribe) {
      this.navigationListenerUnsubscribe();
    }

    const {pageSource, targetApp} = this.state;
    this.setState({saving: true}, () => {
      this.editor.updateOptions({readOnly: true});
    });

    PageService.save({
      iri: this.props.iri.value,
      targetAppId: targetApp,
      sourceAppId: typeof pageSource.appId === 'string' ? pageSource.appId : undefined,
      sourceRevision: typeof pageSource.revision === 'string' ? pageSource.revision : undefined,
      rawContent: pageSource.source,
    }).onValue(v => {
      this.setState({saving: false}, () => {
        if (params.navigateToPage) {
          navigateToResource(this.props.iri).observe({});
        } else {
          addNotification({level: 'success', message: 'Page successfully saved.'});
          this.loadPageSource(this.props.iri.value);
        }
      });
    }).onError(error => {
      const dialogRef = `page-saving-error`;
      getOverlaySystem().show(
        dialogRef,
        <OverlayDialog show={true}
          type='modal'
          title='Error while saving the page'
          onHide={() => {
            getOverlaySystem().hide(dialogRef);
            this.setState({saving: false});
          }}>
          <div />
          <div><ErrorPresenter error={error} /></div>
          <Button variant='success'
            className='pull-right'
            onClick={() => {
              getOverlaySystem().hide(dialogRef);
              this.setState({saving: false});
            }}>
            Ok
          </Button>
        </OverlayDialog>
      );
    });
  }

  private onCancel = () => {
    navigateToResource(this.props.iri).onValue(x => x);
  }

  private renderAppSelector() {
    const {storageStatus, pageSource, targetApp} = this.state;
    return <StorageSelector
      className={`${CLASS_NAME}__app-selector`}
      allApps={storageStatus}
      sourceApps={pageSource.definedByApps}
      targetApp={targetApp}
      onChange={newTargetApp => {
        this.setState({targetApp: newTargetApp}, () => {
          // re-layout editor because storage selector may change
          // its height when displaying a note
          this.recalculateEditorLayout();
        });
      }}
    />;
  }

  private renderAppliedTemplates() {
    // show templates only if current page is empty
    const hasDirectPage = Boolean(
      this.state.pageSource.source && this.state.pageSource.source.length > 0
    );
    return (
      <div className='page-editor__applicable-templates'>
        {hasDirectPage ? (
          <div>
            Applicable Templates: This resource does already have a direct
            corresponding page and as such no templates will be applied.
          </div>
        ) : (
          this.applicableTemplateLinks(
            this.state.pageSource.applicableTemplates,
            this.state.pageSource.appliedTemplate
          )
        )}
        {/* show message if system-wide default template is applied */}
        {this.isTemplateApplied(this.props.iri, this.state.pageSource) ? (
          <div>
            None of the computed templates is used. The system's default template&nbsp;
            <ResourceLink key='def'
              resource={Rdf.iri('Template:' + vocabularies.rdfs.Resource.value)}
              action={ResourceLinkAction.edit}
              style={{backgroundColor: '#FFC857'}}>
              Template:rdfs:Resource
            </ResourceLink>
            &nbsp;has been applied.
          </div>
        ) : null
        }
      </div>
    );
  }

  private applicableTemplateLinks = (
    templates: string[],
    appliedTemplate: string
  ): ReactElement<any> => {
    if (templates.length === 0) {
      return <span />;
    }

    return (
      <div>
        <div>Applicable Templates:</div>
        <ul>
          {templates.map(res => {
            const props = (appliedTemplate === res)
              ? this.getAppliedTemplateProps()
              : {};
            return <li key={res} {...props}>
              <ResourceLink resource={Rdf.iri(res)}
                action={ResourceLinkAction.edit}>
                {res}
              </ResourceLink>
            </li>;
          })}
        </ul>
      </div>
    );
  }

  private getAppliedTemplateProps() {
    return {
      style: { backgroundColor: '#FFC857' },
      title: 'This template will currently be applied.',
    } as const;
  }

  private renderKnowledgePanelTemplates() {
    const { applicableTemplates, appliedKnowledgePanelTemplate } = this.state.pageSource;
    return (
      <div className='page-editor__applicable-templates'>
        {this.applicableKnowledgePanelLinks(applicableTemplates, appliedKnowledgePanelTemplate)}
      </div>
    );
  }

  private applicableKnowledgePanelLinks = (
    templates: string[],
    appliedTemplate: string
  ): ReactElement<any> => {

    const panelTemplates = templates.map(template => 'Panel' + template)
      .filter(template => template !== appliedTemplate);

    return (
      <div>
        <div>Applicable Knowledge Panels:</div>
        <ul>
          <li {...this.getAppliedTemplateProps()}>
            {appliedTemplate ? <ResourceLink resource={Rdf.iri(appliedTemplate)}
              action={ResourceLinkAction.edit}>
              {appliedTemplate}
            </ResourceLink> : null}
          </li>
          {panelTemplates.map(res => {
            return <li key={res}>
              <ResourceLink resource={Rdf.iri(res)}
                action={ResourceLinkAction.edit}>
                {res}
              </ResourceLink>
            </li>;
          })}
        </ul>
      </div>
    );
  }

  private renderIncludes() {
    const {includes, loadingIncludes} = this.state;
    if (loadingIncludes) {
      return (
        <Spinner className='page-editor__included-templates-spinner'
          spinnerDelay={0}
        />
      );
    }
    return (
      <div className='page-editor__included-templates'>
        {includes.length === 0 ? (
          <span>This page does not include any other template.</span>
        ) : null}
        {includes.map(resource => (
          <ResourceLink key={resource.value}
            resource={resource}
            action={ResourceLinkAction.edit}>
            {SparqlUtil.tryCompactIriUsingPrefix(resource) ?? resource.value}
          </ResourceLink>
        ))}
      </div>
    );
  }

  private renderEditorSettings() {
    const {iri} = this.props;
    return (
      <div className='page-editor__editor-settings'>
        <span>Resource:&nbsp;{iri.value}</span>
        <label>
          <input type='checkbox'
            checked={this.state.enableDiagnostics}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              this.setState({enableDiagnostics: e.currentTarget.checked}, () => {
                updateTemplateLanguageOptions({diagnostics: this.state.enableDiagnostics});
              });
            }}
          />&nbsp;Show warnings (experimental)
        </label>
        <ResourceLink target='_blank'
          resource={Rdf.iri('http://help.metaphacts.com/resource/PageEditor')}>
          <span className='fa fa-question-circle' title='Open page editor documentation' />
        </ResourceLink>
      </div>
    );
  }

  private renderRevisionInfo() {
    const { date, author } = this.state.pageSource;
    if (!date) {
      return null;
    }

    const parsedDate = moment(date);
    const monthAgo = moment().subtract(1, 'month');
    const showRelativeTime = parsedDate.isAfter(monthAgo);

    const changedAgo = parsedDate.fromNow();
    const changedDate = parsedDate.format('LLL');

    return <div className='page-editor__revision-info'>
      Last changed {showRelativeTime ? <span title={changedDate} className='page-editor__change-date'>
        {changedAgo}
      </span> : <>on {changedDate}</>}
      {author ? ` by ${author}` : null}</div>;
  }
}

export default PageEditorComponent;
