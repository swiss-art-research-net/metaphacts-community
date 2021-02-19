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
import { Col } from 'react-bootstrap';
import * as React from 'react';

// Copied from Col declaration, as they're not exported
declare type NumberAttr = number | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
declare type ColSize = boolean | 'auto' | NumberAttr;

export interface Props {
    xs: ColSize;
    xsOffset: NumberAttr;
    sm: ColSize;
    smOffset: NumberAttr;
    md: ColSize;
    mdOffset: NumberAttr;
    lg: ColSize;
    lgOffset: NumberAttr;
}

/**
 * Compatibility component with Bootstrap 3 interface converting to Bootstrap 4.
 */
export class Bootstrap3ColComponent extends React.Component<Props, {}> {

    render() {
        const {
            xs, xsOffset,
            sm, smOffset,
            md, mdOffset,
            lg, lgOffset,
            ...rest } = this.props;

        return <Col
            xs={this.toColSpec(this.props.xs, this.props.xsOffset)}
            sm={this.toColSpec(this.props.sm, this.props.smOffset)}
            md={this.toColSpec(this.props.md, this.props.mdOffset)}
            lg={this.toColSpec(this.props.lg, this.props.lgOffset)}
            {...rest}>
            {this.props.children}</Col>;
    }

    private toColSpec(span: ColSize, offset: NumberAttr) {
        if (span == null && offset == null) {
            return undefined;
        }
        return {span, offset};
    }
}
export default Bootstrap3ColComponent;
