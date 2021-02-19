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

import { ElementTypeIri } from '../../data/model';
import { DiagramView } from '../../diagram/view';
import { highlightSubstring } from '../listElementView';

import { TreeNode } from './treeModel';

const EXPAND_ICON: string = require('../../../../images/tree/expand-toggle.svg');
const COLLAPSE_ICON: string = require('../../../../images/tree/collapse-toggle.svg');
const DEFAULT_LEAF_ICON: string = require('../../../../images/tree/leaf-default.svg');
const DEFAULT_PARENT_ICON: string = require('../../../../images/tree/leaf-folder.svg');

interface CommonProps {
    view: DiagramView;
    searchText?: string;
    selectedNode?: TreeNode;
    onSelect: (node: TreeNode) => void;
    creatableClasses: ReadonlyMap<ElementTypeIri, boolean>;
    onClickCreate: (node: TreeNode) => void;
    onDragCreate: (node: TreeNode) => void;
    onDragEnd: () => void;
}

export interface LeafProps extends CommonProps {
    node: TreeNode;
}

interface State {
    expanded?: boolean;
}

const LEAF_CLASS = 'ontodia-class-leaf';

export class Leaf extends React.Component<LeafProps, State> {
    constructor(props: LeafProps) {
        super(props);
        this.state = {
            expanded: Boolean(this.props.searchText),
        };
    }

    componentWillReceiveProps(nextProps: LeafProps) {
        if (this.props.searchText !== nextProps.searchText) {
            this.setState({
                expanded: Boolean(nextProps.searchText),
            });
        }
    }

    render() {
        const {node, ...otherProps} = this.props;
        const {view, selectedNode, searchText, creatableClasses} = otherProps;
        const {expanded} = this.state;

        let toggleIcon: string | undefined;
        if (node.derived.length > 0) {
            toggleIcon = expanded ? COLLAPSE_ICON : EXPAND_ICON;
        }

        let {icon} = view.getTypeStyle([node.model.id]);
        if (!icon) {
            icon = node.derived.length === 0 ? DEFAULT_LEAF_ICON : DEFAULT_PARENT_ICON;
        }

        let bodyClass = `${LEAF_CLASS}__body`;
        if (selectedNode && selectedNode.model === node.model) {
            bodyClass += ` ${LEAF_CLASS}__body--selected`;
        }

        const label = highlightSubstring(
            node.label, searchText, {className: `${LEAF_CLASS}__highlighted-term`}
        );

        return (
            <div className={LEAF_CLASS} role='tree-item'>
                <div className={`${LEAF_CLASS}__row`}>
                    <div className={`${LEAF_CLASS}__toggle`} onClick={this.toggle} role='button'>
                        {toggleIcon ? <img className={`${LEAF_CLASS}__toggle-icon`} src={toggleIcon} /> : null}
                    </div>
                    <a className={bodyClass} href={node.model.id} onClick={this.onClick}>
                        <div className={`${LEAF_CLASS}__icon-container`}>
                            <img className={`${LEAF_CLASS}__icon`} src={icon} />
                        </div>
                        <span className={`${LEAF_CLASS}__label`}>{label}</span>
                        {node.model.count ? (
                            <span className={`${LEAF_CLASS}__count ontodia-badge`}>
                                {node.model.count}
                            </span>
                        ) : null}
                    </a>
                    {creatableClasses.get(node.model.id) ? (
                        <div className={`${LEAF_CLASS}__create ontodia-btn-group ontodia-btn-group-xs`}>
                            <button className='ontodia-btn ontodia-btn-secondary'
                                title={'Click or drag to create new entity of this type'}
                                draggable={true}
                                onClick={this.onClickCreate}
                                onDragStart={this.onDragStart}
                                onDragEnd={this.props.onDragEnd}>
                                +
                            </button>
                        </div>
                    ) : null}
                </div>
                {expanded && node.derived.length > 0 ? (
                    <Forest className={`${LEAF_CLASS}__children`}
                        nodes={node.derived}
                        {...otherProps}
                    />
                ) : null}
            </div>
        );
    }

    private onClick = (e: React.MouseEvent<{}>) => {
        e.preventDefault();
        const {node, onSelect} = this.props;
        onSelect(node);
    }

    private toggle = () => {
        this.setState((state): State => ({expanded: !state.expanded}));
    }

    private onClickCreate = () => {
        this.props.onClickCreate(this.props.node);
    }

    private onDragStart = (e: React.DragEvent<any>) => {
        // sets the drag data to support drag-n-drop in Firefox
        // see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations for more details
        // IE supports only 'text' and 'URL' formats, see https://msdn.microsoft.com/en-us/ie/ms536744(v=vs.94)
        e.dataTransfer.setData('text', '');

        this.props.onDragCreate(this.props.node);
    }
}

export interface ForestProps extends CommonProps {
    className?: string;
    nodes: ReadonlyArray<TreeNode>;
}

export class Forest extends React.Component<ForestProps, {}> {
    render() {
        const {nodes, className, ...otherProps} = this.props;
        return (
            <div className={className} role='tree'>
                {nodes.map(node => (
                    <Leaf key={`node-${node.model.id}`} node={node} {...otherProps} />
                ))}
            </div>
        );
    }
}
