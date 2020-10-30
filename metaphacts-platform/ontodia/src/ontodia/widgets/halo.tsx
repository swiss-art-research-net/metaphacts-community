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

import { Element, ElementEvents } from '../diagram/elements';
import { boundsOf } from '../diagram/geometry';
import { PaperWidgetProps } from '../diagram/paperArea';
import { WidgetAttachment, assertWidgetComponent, IriClickIntent } from '../diagram/view';

import { WorkspaceContextTypes, WorkspaceContextWrapper } from '../workspace/workspaceContext';
import { HaloDefaultTemplate } from './haloDefaultTemplate';
import { EventObserver, AnyListener } from '../viewUtils/events';
import { Debouncer, Cancellation, CancellationToken } from '../viewUtils/async';
import { TemplateProps } from '../customization/props';
import { computeTemplateProps } from '../diagram/elementLayer';
import { EditLayerMode } from '../editor/editLayer';
import { setElementExpanded } from '../diagram/commands';
import { AuthoringState } from '../editor/authoringState';
import * as styles from './halo.scss';

export interface HaloProps extends PaperWidgetProps {
    id?: string;
}

export interface HaloTemplateProps extends TemplateProps {
    canLink: boolean;
    isNewElement?: boolean;
    inAuthoringMode?: boolean;
}

export interface HaloActions {
    onOpenConnectionMenu: () => void;
    onAddToFilter: () => void;
    onExpand: () => void;
    onFollowLink: (e: React.MouseEvent<any>) => void;
    onRemoveSelectedElements: () => void;
    onEstablishNewLink: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface State {
    target?: Element;
    canLink?: boolean;
    showConnectionsMenu?: boolean;
}

type RequiredProps = HaloProps & Required<PaperWidgetProps>;

export class Halo extends React.Component<HaloProps, State> {
    static defaultProps: Partial<HaloProps> = {
        id: 'halo',
    };

    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    static attachment = WidgetAttachment.OverElements;

    private readonly listener = new EventObserver();
    private targetListener = new EventObserver();
    private queryDebouncer = new Debouncer();
    private queryCancellation = new Cancellation();

    constructor(props: HaloProps) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        const {editor} = this.context.ontodiaWorkspace;
        const {renderingState} = this.props as RequiredProps;
        this.listener.listen(renderingState.events, 'changeElementSize', ({source}) => {
            if (source === this.state.target) {
                this.forceUpdate();
            }
        });
        this.listener.listen(editor.events, 'changeAuthoringState', () => {
            this.queryAllowedActions();
        });
        this.listener.listen(editor.events, 'changeSelection', () => {
            const selection = editor.selection.length === 1 ? editor.selection[0] : undefined;
            this.setState({
                target: selection instanceof Element ? selection : undefined,
                showConnectionsMenu: false,
            });
        });
    }

    componentDidUpdate(prevProps: HaloProps, prevState: State) {
        const {editor} = this.context.ontodiaWorkspace;
        const {target, showConnectionsMenu} = this.state;
        if (target !== prevState.target) {
            this.listenToElement(target);
            this.queryAllowedActions();
        }
        if (showConnectionsMenu !== prevState.showConnectionsMenu) {
            if (showConnectionsMenu) {
                editor.showConnectionsMenu(target!);
            } else {
                editor.hideDialog();
            }
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.listenToElement(undefined);
        this.queryDebouncer.dispose();
        this.queryCancellation.abort();
    }

    listenToElement(element: Element | undefined) {
        this.targetListener.stopListening();
        if (element) {
            this.targetListener.listenAny(element.events, this.onElementEvent);
        }
    }

    private queryAllowedActions() {
        this.queryDebouncer.call(() => {
            this.queryCancellation.abort();
            this.queryCancellation = new Cancellation();
            this.canLink(this.state.target);
        });
    }

    private canLink(target: Element | undefined) {
        if (!target) { return; }

        const {editor} = this.context.ontodiaWorkspace;
        const metadataApi = editor.metadataApi;
        if (!metadataApi) {
            this.setState({canLink: false});
            return;
        }
        const event = editor.authoringState.elements.get(target.iri);
        if (event && event.deleted) {
            this.setState({canLink: false});
        } else {
            this.setState({canLink: undefined});
            const signal = this.queryCancellation.signal;
            CancellationToken.mapCancelledToNull(
                signal,
                metadataApi.canLinkElement(target.data, signal)
            ).then(canLink => {
                if (canLink === null) { return; }
                if (this.state.target?.iri === target.iri) {
                    this.setState({canLink});
                }
            });
        }
    }

    private onElementEvent: AnyListener<ElementEvents> = data => {
        if (data.changePosition || data.changeExpanded) {
            this.forceUpdate();
        }
        if (data.changeData) {
            this.queryAllowedActions();
        }
    }

    render() {
        const {paperArea, renderingState, view} = this.props as RequiredProps;
        const {target} = this.state;

        if (!target) {
            return null;
        }
        if (this.props.children && !React.isValidElement(this.props.children)) {
            throw new Error('Halo template is not a valid react element!');
        }

        const bbox = boundsOf(target, renderingState);
        const {x: x0, y: y0} = paperArea.paperToScrollablePaneCoords(bbox.x, bbox.y);
        const {x: x1, y: y1} = paperArea.paperToScrollablePaneCoords(
            bbox.x + bbox.width,
            bbox.y + bbox.height,
        );
        const MARGIN = 5;
        const style: React.CSSProperties = {left: x0 - MARGIN, top: y0 - MARGIN,
            width: ((x1 - x0) + MARGIN * 2), height: ((y1 - y0) + MARGIN * 2)};

        const templateProps = this.prepareTemplateProps();
        return (
            <div className={styles.halo} style={style}>
                {this.renderChildren(this.props.children, templateProps)}
            </div>
        );
    }

    private renderChildren(
        children: React.ReactNode | undefined,
        templateProps: HaloTemplateProps & HaloActions,
    ) {
        if (!children) {
            return <HaloDefaultTemplate {...templateProps}></HaloDefaultTemplate>;
        } else if (React.isValidElement(children!)) {
            return React.cloneElement(children, {...templateProps});
        } else {
            throw new Error('Halo template is not a valid react element!');
        }
    }

    private prepareTemplateProps(): HaloTemplateProps & HaloActions {
        const {paperArea, view} = this.props as RequiredProps;
        const {editor} = this.context.ontodiaWorkspace;
        const {target, canLink} = this.state;
        if (!target) { throw new Error('Target is undefined.'); }
        return {
            ...computeTemplateProps(target, view),
            isNewElement: AuthoringState.isNewElement(editor.authoringState, target.iri),
            // Even if it is another dialog we treat it as a connection menu,
            // because opening a new dialog will hide any other dialogs anyway.
            canLink: Boolean(canLink),
            inAuthoringMode: editor.inAuthoringMode,
            onOpenConnectionMenu: () => {
                editor.showConnectionsMenu(target);
            },
            onAddToFilter: () => target.addToFilter(),
            onExpand: () => view.model.history.execute(
                setElementExpanded(target, target.isExpanded)
            ),
            onFollowLink: (e: React.MouseEvent<any>) => {
                view.onIriClick(target.iri, target, IriClickIntent.JumpToEntity, e);
            },
            onRemoveSelectedElements: () => editor.removeSelectedElements(),
            onEstablishNewLink: (e: React.MouseEvent<HTMLElement>) => {
                const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
                editor.startEditing({
                    target,
                    mode: EditLayerMode.establishLink,
                    point,
                });
            },
        };
    }
}

assertWidgetComponent(Halo);
