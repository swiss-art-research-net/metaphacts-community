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

import { TemplateProps } from '../customization/props';

import { setElementExpanded } from '../diagram/commands';
import { Element, ElementEvents } from '../diagram/elements';
import { computeTemplateProps } from '../diagram/elementLayer';
import { boundsOf } from '../diagram/geometry';
import { PaperWidgetProps } from '../diagram/paperArea';
import { WidgetAttachment, assertWidgetComponent, IriClickIntent } from '../diagram/view';

import { AuthoringState } from '../editor/authoringState';
import { EditLayerMode } from '../editor/editLayer';

import { EventObserver, EventTrigger, AnyListener } from '../viewUtils/events';
import { Debouncer, Cancellation, CancellationToken } from '../viewUtils/async';

import { ConnectionsMenuCommands } from '../widgets/connectionsMenu';
import { WorkspaceContextTypes, WorkspaceContextWrapper } from '../workspace/workspaceContext';

import { HaloDefaultTemplate } from './haloDefaultTemplate';
import * as styles from './halo.scss';

export interface HaloProps extends PaperWidgetProps {
    commands: EventTrigger<ConnectionsMenuCommands>;
    id?: string;
    scalable?: boolean;
    margin?: number;
}

export interface HaloTemplateProps extends TemplateProps {
    /**
     * `true` if new links are allowed to be established from this element
     */
    canLink: boolean;

    /**
     * `true` if the element is newly created and `false` if not
     */
    isNewElement?: boolean;

    /**
     * `true` if the ontodia in Authoring mode
     */
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
    static defaultProps: Pick<HaloProps, 'id'> = {
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
        this.listener.listen(editor.events, 'changeMode', () => {
            this.forceUpdate();
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
        const {overlayController} = this.context.ontodiaWorkspace;
        const {commands} = this.props;
        const {target, showConnectionsMenu} = this.state;
        if (target !== prevState.target) {
            this.listenToElement(target);
            this.queryAllowedActions();
        }
        if (showConnectionsMenu !== prevState.showConnectionsMenu) {
            if (showConnectionsMenu) {
                commands.trigger('showConnectionsMenu', {target: target!});
            } else {
                overlayController.hideDialog();
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
                metadataApi.canConnect(target.data, null, null, signal)
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
        const {
            paperArea, renderingState, scalable, paperTransform, margin = 5,
        } = this.props as RequiredProps;
        const {target} = this.state;

        if (!target) {
            return null;
        }
        if (this.props.children && !React.isValidElement(this.props.children)) {
            throw new Error('Halo template is not a valid react element!');
        }

        const bbox = boundsOf(target, renderingState);
        const {x: x0, y: y0} = paperArea.paperToScrollablePaneCoords(bbox.x, bbox.y);

        let style: React.CSSProperties;
        if (scalable) {
            const {scale} = paperTransform;
            style = {
                left: x0 - margin * scale,
                top: y0 - margin * scale,
                width: bbox.width + margin * 2,
                height: bbox.height + margin * 2,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
            };
        } else {
            const {x: x1, y: y1} = paperArea.paperToScrollablePaneCoords(
                bbox.x + bbox.width,
                bbox.y + bbox.height,
            );
            style = {
                left: x0 - margin, top: y0 - margin,
                width: ((x1 - x0) + margin * 2), height: ((y1 - y0) + margin * 2)
            };
        }

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
        const {paperArea, view, commands} = this.props as RequiredProps;
        const {editor, overlayController} = this.context.ontodiaWorkspace;
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
                commands.trigger('showConnectionsMenu', {target});
            },
            onAddToFilter: () => target.addToFilter(),
            onExpand: () => view.model.history.execute(
                setElementExpanded(target, !target.isExpanded)
            ),
            onFollowLink: (e: React.MouseEvent<any>) => {
                view.onIriClick(target.iri, target, IriClickIntent.JumpToEntity, e);
            },
            onRemoveSelectedElements: () => editor.removeSelectedElements(),
            onEstablishNewLink: (e: React.MouseEvent<HTMLElement>) => {
                const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
                overlayController.startEditing({
                    target,
                    mode: EditLayerMode.establishLink,
                    point,
                });
            },
        };
    }
}

assertWidgetComponent(Halo);
