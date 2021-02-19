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
import * as Kefir from 'kefir';

import { Controlled as CodeMirror } from 'react-codemirror2';
import * as codemirror from 'codemirror';

import { get, put } from 'platform/api/http';
import { Cancellation } from 'platform/api/async';
import { requestAsProperty } from 'platform/api/async';

import * as styles from './PageViewConfigEditor.scss';
import { addNotification } from 'platform/components/ui/notification';


const RUNTIME_STORAGE = 'runtime';

interface Storage {
    id: string;
    mutableStorage: boolean;
}

class State {
    storages: Storage[];
}

export class PageRenderInfoEditor extends React.Component<{}, State> {
    private readonly cancellation = new Cancellation();

    constructor(props: {}, context: any) {
        super(props, context);
        this.state = {
            storages: [],
        };
    }

    componentDidMount() {
        this.cancellation.map(getStorages()).observe({
            value: storages => this.setState({storages})
        });
    }

    render() {
        return <div className='pageRenderInfoEditor'>

                {[...this.state.storages].reverse().map(storage =>
                    this.renderEditorForStorage(storage.id))}

        </div>;
    }

    private renderEditorForStorage(storage: string) {
        return <PageViewConfigStorageEditor
            key={storage}
            storage={storage}
            editable={this.state.storages.find(s => s.id === storage && s.mutableStorage) != null}
            >
        </PageViewConfigStorageEditor>;
    }


}

class PageViewConfigStorageEditorProps {
    storage: string;
    editable: boolean;
}
class PageViewConfigStorageEditorState {
    editing: boolean;
    source: string;
}

export class PageViewConfigStorageEditor extends React.Component<PageViewConfigStorageEditorProps,
    PageViewConfigStorageEditorState> {

    private readonly cancellation = new Cancellation();

    constructor(props: PageViewConfigStorageEditorProps, context: any) {
        super(props, context);
        this.state = {
            editing: false,
            source: ''
        };
    }

    componentDidMount() {
        this.loadSource();
    }

    private loadSource() {
        this.cancellation.map(
            getRawPageRenderInfo(this.props.storage)
        ).observe({
            value: source => this.setState({source})
        });
    }

    render() {
        return <div className={`${styles.storageSection} ${this.state.editing ? '' : styles.readonly}`}
        >
            <p>
                <span style={{fontWeight: 'bold'}}>{this.props.storage}</span>
                <span style={{fontStyle: 'italic'}}>
                    {this.props.editable ? '' : ' (readonly)'}
                </span>
            </p>
            <div className={styles.editor}>
                {this.renderCodeMirror()}
            </div>

            <div className={styles.controls}>
                {this.props.editable && !this.state.editing ? <button className='btn btn-secondary'
                    onClick={() => this.setState({editing: true})}>

                    Edit
                    </button> : null}
                {this.state.editing ? <div>
                    <button className='btn btn-primary' onClick={() => this.save()}>Save</button>
                    <button className='btn btn-secondary' onClick={() => this.cancel()}>
                        Cancel
                    </button>
                </div> : null}
            </div>
        </div>;
    }

    private renderCodeMirror() {
        return <CodeMirror
            className={styles.configEditor}
            value={this.state.source}
            onBeforeChange={this.onPageContentChange.bind(this)}
            options={{
              mode: {name: 'null'},
              indentWithTabs: false, indentUnit: 2, tabSize: 2,
              viewportMargin: Infinity,
              lineNumbers: true,
              lineWrapping: true,
              readOnly: !this.state.editing,
            }}
          ></CodeMirror>;
    }

    private onPageContentChange(
        editor: codemirror.Editor,
        data: codemirror.EditorChange, value: string) {

        this.setState({source: value});
    }

    private save() {
        this.cancellation.map(
            savePageRenderInfo(this.props.storage, this.state.source)
        ).observe({
            value: () => {
                showNotification('PageRenderInfo successfully saved.');
                this.setState({editing: false})
            },
            error: error => showNotification('Error saving PageRenderInfo', true)
        });
    }

    private cancel() {
        this.setState({editing: false});
        this.loadSource();
    }
}



function getStorages(): Kefir.Property<Storage[]> {
    const request = get('/rest/admin/storages')
        .accept('application/json');
    return requestAsProperty(request).map(res => res.body);
}

function getRawPageRenderInfo(storage: string): Kefir.Property<string> {
    const request = get('/rest/template/pageViewConfig/' + storage)
        .accept('text/plain');
    return requestAsProperty(request).map(res => res.text);
}

function savePageRenderInfo(storage: string, source: string): Kefir.Property<string> {
    const request = put('/rest/template/pageViewConfig/' + storage)
        .send(source)
        .type('text/plain');
    return requestAsProperty(request).map(res => res.text);
}

function showNotification(message: string, isError ?: boolean) {
    addNotification({
        message: message,
        level: isError ? 'error' : 'success',
    });
}


export default PageRenderInfoEditor;
