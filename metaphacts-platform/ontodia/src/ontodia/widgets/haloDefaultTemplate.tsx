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

import { HaloActions, HaloTemplateProps } from './halo';
import { HtmlSpinner } from '../viewUtils/spinner';
import * as styles from './halo.scss';

export type HaloDefaultTemplateProps = HaloActions & HaloTemplateProps;

export class HaloDefaultTemplate extends React.Component<HaloDefaultTemplateProps> {
    constructor(props: HaloDefaultTemplateProps) {
        super(props);
        this.state = {};
    }

    render() {
        const {
            iri, isExpanded, inAuthoringMode,
            onOpenConnectionMenu, onFollowLink,
            onAddToFilter, onExpand,
        } = this.props;
        const {} = this.state;

        return (
            <div className={styles.template}>
                {this.renderRemoveOrDeleteButton()}
                <div className={`${styles.navigate} ` +
                    `${styles.navigateOpen}`}
                    role='button'
                    title='Open a dialog to navigate to connected elements'
                    onClick={onOpenConnectionMenu} />
                <a className={styles.follow}
                    href={iri}
                    role='button'
                    title='Jump to resource'
                    onClick={onFollowLink} />
                <div className={styles.addToFilter}
                    role='button'
                    title='Search for connected elements'
                    onClick={onAddToFilter} />
                <div className={`${styles.expand} ` +
                    `${isExpanded ? styles.expandClosed : styles.expandOpen}`}
                    role='button'
                    title={`Expand an element to reveal additional properties`}
                    onClick={onExpand} />
                {inAuthoringMode ? this.renderEstablishNewLinkButton() : null}
            </div>
        );
    }

    private renderRemoveOrDeleteButton() {
        const {isNewElement, onRemoveSelectedElements} = this.props;

        return (
            <div className={isNewElement ? styles.delete : styles.remove}
                role='button'
                title={isNewElement ? 'Delete new element' : 'Remove an element from the diagram'}
                onClick={() => onRemoveSelectedElements()}>
            </div>
        );
    }

    private renderEstablishNewLinkButton() {
        const {canLink, onEstablishNewLink} = this.props;
        if (canLink === undefined) {
            return (
                <div className={styles.establishConnectionSpinner}>
                    <HtmlSpinner width={20} height={20} />
                </div>
            );
        }
        const title = canLink
            ? 'Establish connection'
            : 'Establishing connection is unavailable for the selected element';
        return (
            <button className={styles.establishConnection} title={title}
                onMouseDown={onEstablishNewLink} disabled={!canLink} />
        );
    }
}
