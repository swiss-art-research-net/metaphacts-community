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

import { DiagramView } from '../diagram/view';
import { ElementModel, PropertyTypeIri, Property, ElementIri } from '../data/model';
import { Rdf } from '../data/rdf';

const CLASS_NAME = 'ontodia-edit-form';

export interface EditEntityFormProps {
    view: DiagramView;
    entity: ElementModel;
    onApply: (entity: ElementModel) => void;
    onCancel: () => void;
}

interface State {
    elementModel: ElementModel;
}

export class EditEntityForm extends React.Component<EditEntityFormProps, State> {
    constructor(props: EditEntityFormProps) {
        super(props);

        this.state = {elementModel: props.entity};
    }

    componentWillReceiveProps(nextProps: EditEntityFormProps) {
        if (this.props.entity !== nextProps.entity) {
            this.setState({elementModel: nextProps.entity});
        }
    }

    private renderProperty = (key: PropertyTypeIri, property: Property) => {
        const {view} = this.props;
        const richProperty = view.model.getProperty(key);
        const label = view.formatLabel(richProperty ? richProperty.label : [], key);

        const values = property.values.map(({value}) => value);
        return (
            <div key={key} className={`${CLASS_NAME}__form-row`}>
                <label>
                    {label}
                    {
                        values.map((value, index) => (
                            <input key={index} className='ontodia-form-control' defaultValue={value} />
                        ))
                    }
                </label>
            </div>
        );
    }

    private renderProperties() {
        const {properties} = this.props.entity;
        const propertyIris = Object.keys(properties) as PropertyTypeIri[];
        return (
            <div>
                {propertyIris.map(iri => {
                    return this.renderProperty(iri, properties[iri]!);
                })}
            </div>
        );
    }

    private renderType() {
        const {view} = this.props;
        const {elementModel} = this.state;
        const label = view.getElementTypeString(elementModel);
        return (
            <label>
                Type
                <input className='ontodia-form-control' value={label} disabled={true} />
            </label>
        );
    }

    private onChangeIri = (e: React.FormEvent<HTMLInputElement>) => {
        const target = (e.target as HTMLInputElement);
        const iri = target.value as ElementIri;
        this.setState(prevState => {
            return {
                elementModel: {
                    ...prevState.elementModel,
                    id: iri,
                }
            };
        });
    }

    private renderIri() {
        const {elementModel} = this.state;
        return (
            <label>
                IRI
                <input
                    className='ontodia-form-control'
                    defaultValue={elementModel.id}
                    onChange={this.onChangeIri}
                />
            </label>
        );
    }

    private onChangeLabel = (e: React.FormEvent<HTMLInputElement>) => {
        const {factory} = this.props.view.model;
        const target = (e.target as HTMLInputElement);

        const labels = target.value.length > 0 ? [factory.literal(target.value)] : [];

        this.setState({elementModel: {
            ...this.state.elementModel,
            label: {values: labels},
        }});
    }

    private renderLabel() {
        const {view} = this.props;
        const label = view.selectLabel(this.state.elementModel.label.values);
        const text = label ? label.value : '';
        return (
            <label>
                Label
                <input className='ontodia-form-control' value={text} onChange={this.onChangeLabel} />
            </label>
        );
    }

    render() {
        return (
            <div className={CLASS_NAME}>
                <div className={`${CLASS_NAME}__body`}>
                    <div className={`${CLASS_NAME}__form-row`}>
                        {this.renderIri()}
                    </div>
                    <div className={`${CLASS_NAME}__form-row`}>
                        {this.renderType()}
                    </div>
                    <div className={`${CLASS_NAME}__form-row`}>
                        {this.renderLabel()}
                    </div>
                    {this.renderProperties()}
                </div>
                <div className={`${CLASS_NAME}__controls`}>
                    <button className={`ontodia-btn ontodia-btn-success ${CLASS_NAME}__apply-button`}
                        onClick={() => this.props.onApply(this.state.elementModel)}>
                        Apply
                    </button>
                    <button className='ontodia-btn ontodia-btn-danger'
                        onClick={this.props.onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }
}
