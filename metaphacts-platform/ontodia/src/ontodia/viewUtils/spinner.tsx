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

export interface SpinnerProps {
    size?: number;
    position?: { x: number; y: number };
    maxWidth?: number;
    statusText?: string;
    errorOccurred?: boolean;
}

const CLASS_NAME = 'ontodia-spinner';

export class Spinner extends React.Component<SpinnerProps, {}> {
    render() {
        const {position = {x: 0, y: 0}, size = 50, statusText, errorOccurred} = this.props;

        const textLeftMargin = 5;
        const pathGeometry = 'm3.47,-19.7 a20,20 0 1,1 -6.95,0 m0,0 l-6,5 m6,-5 l-8,-0' +
            (errorOccurred ? 'M-8,-8L8,8M-8,8L8,-8' : '');

        return <g className={CLASS_NAME} data-error={errorOccurred}
            transform={`translate(${position.x},${position.y})`}>
            <g className={`${CLASS_NAME}__arrow`}>
                <path d={pathGeometry} transform={`scale(0.02)scale(${size})`}
                    fill='none' stroke={errorOccurred ? 'red' : 'black'}
                    strokeWidth='3' strokeLinecap='round' />
            </g>
            <text style={{dominantBaseline: 'middle'}} x={size / 2 + textLeftMargin}>{statusText}</text>
        </g>;
    }
}

export class HtmlSpinner extends React.Component<{ width: number; height: number }, {}> {
    render() {
        const {width, height} = this.props;
        const size = Math.min(width, height);
        return (
            <svg width={width} height={height}>
                <Spinner size={size} position={{x: width / 2, y: height / 2}} />
            </svg>
        );
    }
}
