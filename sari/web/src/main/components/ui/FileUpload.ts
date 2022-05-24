/*
 * Copyright (C) 2022, © Swiss Art Research Infrastructure, University of Zurich
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
import { CSSProperties, ReactElement, createElement } from 'react';
import * as D from 'react-dom-factories';
import { Component } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorNotification } from 'platform/components/ui/notification';

interface FileUploadConfig {
    className?: string;
    style?: CSSProperties;
}

interface State {
    base64URL?: any;
    file?: string;
    error?: any;
}

export class FileUpload extends Component<FileUploadConfig, State> {
    
    constructor(props: FileUploadConfig, context: any) {
        super(props, context);
        this.state = {};
    }

    getBase64 = (file: any) => {
        return new Promise(resolve => {
            let fileInfo;
            // Make new FileReader
            let reader = new FileReader();

            // Convert the file to base64 text
            reader.readAsDataURL(file);

            // on reader load something...
            reader.onload = () => {
                // Make a fileInfo Object
                console.log("Called", reader);
                let baseURL = reader.result;
                console.log(baseURL);
                resolve(baseURL);
            };
            console.log(fileInfo);
        });
    };

    handleChange = (e: any) => {
        console.log(e.target.files[0]);
        let file = e.target.files[0];

        this.getBase64(file)
            .then(result => {
                file["base64"] = result;
                console.log("File Is", file);
                this.setState({
                    base64URL: result,
                    file
                });
            })
            .catch(err => {
                console.log(err);
            });

        this.setState({
            file: e.target.files[0]
        });
    }

    render(): ReactElement<any> {
        const {file, error} = this.state;
        if (error) {
            return createElement(ErrorNotification, {errorMessage: error});
        }
        return D.input({
            type: 'file',
            onChange: this.handleChange
        });
    }
}

export default FileUpload;