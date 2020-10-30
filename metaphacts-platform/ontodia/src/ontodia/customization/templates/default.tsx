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
import { ReactElement } from 'react';

import { TemplateProps } from '../props';

import { getPropertyValues } from './utils';

const CLASS_NAME = 'ontodia-default-template';

export class DefaultElementTemplate extends React.Component<TemplateProps, {}> {
    render() {
        const props = this.props;

        const image = props.imgUrl ? (
            <div className={`${CLASS_NAME}__thumbnail`}>
                <img src={props.imgUrl} />
            </div>
        ) : undefined;

        const expander = props.isExpanded ? (
            <div>
                <div className='ontodia-default-template_body_expander'>
                    <div className='ontodia-default-template_body_expander__iri_label'>
                        IRI:
                    </div>
                    <div className='ontodia-default-template_body_expander_iri'>
                        <a  className='ontodia-default-template_body_expander_iri__link'
                            href={props.iri} title={props.iri}>{props.iri}
                        </a>
                    </div>
                </div>
                <hr className='ontodia-default-template_body_expander__hr'/>
                {this.renderPropertyTable()}
            </div>
        ) : null;

        return (
            <div className='ontodia-default-template' style={{
                backgroundColor: props.color,
                borderColor: props.color,
            }} data-expanded={this.props.isExpanded}>
                <div className='ontodia-default-template_type-line' title={props.label}>
                    <div className='ontodia-default-template_type-line__icon' aria-hidden='true'>
                        <img src={props.iconUrl} />
                    </div>
                    <div title={props.types} className='ontodia-default-template_type-line_text-container'>
                        <div className='ontodia-default-template_type-line_text-container__text'>
                            {props.types}
                        </div>
                    </div>
                </div>
                {image}
                <div className='ontodia-default-template_body' style={{borderColor: props.color}}>
                    <span className='ontodia-default-template_body__label' title={props.label}>
                        {props.label}
                    </span>
                    {expander}
                </div>
            </div>
        );
    }

    renderPropertyTable() {
        const {propsAsList} = this.props;
        if (propsAsList && propsAsList.length > 0) {
            return <div className='ontodia-default-template_body_expander_property-table'>
                {propsAsList.map(prop => {
                    const propertyValues = getPropertyValues(prop.property);
                    const values = propertyValues.map((text, index) => (
                        <div className='ontodia-default-template_body_expander_property-table_row_key_values__value'
                            key={index} title={text}>
                            {text}
                        </div>
                    ));
                    return (
                        <div key={prop.id} className='ontodia-default-template_body_expander_property-table_row'>
                            <div title={prop.name + ' (' + prop.id + ')'}
                                className='ontodia-default-template_body_expander_property-table_row__key'>
                                {prop.name}
                            </div>
                            <div className='ontodia-default-template_body_expander_property-table_row_key_values'>
                                {values}
                            </div>
                        </div>
                    );
                })}
            </div>;
        } else {
            return <div>no properties</div>;
        }
    }
}
