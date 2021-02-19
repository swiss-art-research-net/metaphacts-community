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
import { hcl } from 'd3-color';

import { ElementModel } from '../data/model';
import { DiagramView } from '../diagram/view';

export interface ListElementViewProps {
    className?: string;
    view: DiagramView;
    model: ElementModel;
    highlightText?: string;
    disabled?: boolean;
    selected?: boolean;
    onClick?: (event: React.MouseEvent<any>, model: ElementModel) => void;
    onDragStart?: React.HTMLProps<HTMLElement>['onDragStart'];
}

const CLASS_NAME = 'ontodia-list-element-view';

export class ListElementView extends React.Component<ListElementViewProps, {}> {
    render() {
        const {className, view, model, highlightText, disabled, selected, onDragStart, children} = this.props;

        const {h, c, l} = view.getElementStyle(model).color;
        const backgroundColor = (selected && !disabled) ? hcl(h, c * 0.3, l * 1.3) : hcl('white');

        let classNames = `${CLASS_NAME}`;
        classNames += children ? ` ${CLASS_NAME}--has-content` : '';
        classNames += disabled ? ` ${CLASS_NAME}--disabled` : '';
        classNames += className ? ` ${className}` : '';
        const localizedText = view.formatLabel(model.label.values, model.id);
        const classesString = model.types.length > 0 ? `\nClasses: ${view.getElementTypeString(model)}` : '';

        return <li className={classNames}
            draggable={!disabled && Boolean(onDragStart)}
            title={`${localizedText} ${view.formatIri(model.id)}${classesString}`}
            onClick={this.onClick}
            onDragStart={onDragStart}
            style={{backgroundColor, color: hcl(h, c, l)}}>
            <div className={`${CLASS_NAME}__label`}>
                {highlightSubstring(localizedText, highlightText)}
            </div>
            {children ? (
                <div className={`${CLASS_NAME}__content`}>{children}</div>
            ) : null}
        </li>;
    }

    private onClick = (event: React.MouseEvent<any>) => {
        const {disabled, model, onClick} = this.props;
        if (!disabled && onClick) {
            event.persist();
            onClick(event, model);
        }
    }
}

export function startDragElements(e: React.DragEvent<{}>, iris: ReadonlyArray<string>) {
    try {
        e.dataTransfer.setData('application/x-ontodia-elements', JSON.stringify(iris));
    } catch (ex) { // IE fix
        e.dataTransfer.setData('text', JSON.stringify(iris));
    }
    return false;
}

const DEFAULT_HIGHLIGHT_PROPS: React.HTMLProps<HTMLSpanElement> = {
    className: `ontodia-text-highlight`
};

export function highlightSubstring(
    text: string,
    substring: string | undefined,
    highlightProps = DEFAULT_HIGHLIGHT_PROPS,
) {
    if (!substring) {
        return <span>{text}</span>;
    }

    const start = text.toLowerCase().indexOf(substring.toLowerCase());
    if (start < 0) {
        return <span>{text}</span>;
    }

    const end = start + substring.length;
    const before = text.substring(0, start);
    const highlighted = text.substring(start, end);
    const after = text.substring(end);

    return <span>{before}<span {...highlightProps}>{highlighted}</span>{after}</span>;
}
