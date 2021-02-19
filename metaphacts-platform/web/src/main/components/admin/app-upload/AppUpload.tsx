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
import { Dropzone } from 'platform/components/ui/dropzone';
import { RestartWrapper } from 'platform/components/admin/RestartWrapper';
import { Button } from 'react-bootstrap';
import * as request from 'platform/api/http';
import { Component } from 'platform/api/components';
import { Cancellation, requestAsProperty } from 'platform/api/async';

import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { ErrorPresenter } from 'platform/components/ui/notification';

interface State {
    messages?: ReadonlyArray<AlertConfig>;
}

export class AppUpload extends Component<{}, State> {
    private readonly cancellation = new Cancellation();

    constructor(props: {}, context: any) {
        super(props, context);
        this.state = {
            messages: [],
        };
    }

    componentWillUnmount() {
        this.cancellation.cancelAll();
    }

    private uploadFile = (file: File): Kefir.Property<string> => {
        const req = request.post('/rest/admin/apps/upload-and-install')
        .attach('file', file as any)

        req.send(file as any);
        return requestAsProperty(req).map(res => res.text);;
    }

    private onDrop = (files: ReadonlyArray<File>) => {
        this.setState({
            messages: [],
        });

        files.map((file: File, fileNumber: number) => {
            const upload = this.uploadFile(file);

            this.cancellation.map(upload).observe({
                value: value => this.appendUploadMessage(value),
                error: error => {
                    this.appendUploadMessage('File: ' + file.name + ' failed.', error);
                },
            });
            return upload;
        });

    }

    private appendUploadMessage(message: string, uploadError?: any) {
        const RestartButton = <RestartWrapper><Button
        variant='primary'>Restart Now</Button></RestartWrapper>;
        this.setState((state: State): State => {
            return {
                messages: [...state.messages, {
                    alert: uploadError ? AlertType.WARNING : AlertType.SUCCESS,
                    message,
                    children: uploadError ? <ErrorPresenter error={uploadError} /> : RestartButton
                }]
            };
        });
    }

    render() {
        const messages = this.state.messages.map((config, index) => <Alert key={index} {...config} />);
        return (
            <div className={'text-center'}>
                <Dropzone
                  multiple={false}
                  onDrop={this.onDrop}
                  style={{margin: 'auto', width: '200px', height: '200px'}}>
                    <span>
                        Please drag&amp;drop your app zip file here OR click into the
                        field to open the browser's standard file selector.
                    </span>
                </Dropzone>
                {messages}
            </div>
        );
    };

}

export default AppUpload;
