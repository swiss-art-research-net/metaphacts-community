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

/*
    This component uses code based on an example by Prashant Chaudhari:
    https://codesandbox.io/s/convert-file-to-base64-in-react-lqi1e?file=/src/App.js:118-641
*/

import { CSSProperties, ReactElement, createElement } from 'react';
import * as D from 'react-dom-factories';
import { Component } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorNotification } from 'platform/components/ui/notification';

interface FileUploadConfig {
    /**
     * List of accepted file types.
     * If not specified, all files are accepted.
     * Comma separated list of file extensions (e.g. 'jpg,png,gif') or mime types (e.g. 'image/jpeg,image/png,image/gif')
     */
    accept?: string;
    /**
     * If an image should be captured via the camera, specify the preferred camera.
     * "user" - the user's camera
     * "environment" - the environment's camera
     */
    capture?: string;
    className?: string;
    style?: CSSProperties;
    /**
     * Template that gets the file object
     * 
     */
    template?: string;
    /**
     * Template which is applied when there is no file uploaded. Receives an object 'file' with the following properties:
     *  - base64: base64 encoded file
     *  - lastModified: last modified date as UNIX timestamp
     *  - lastModifiedDate: last modified date as Date object
     *  - name: file name
     *  - size: file size in bytes
     *  - type: file type
     * 
     */
    noResultTemplate?: string;
}

interface State {
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
                let baseURL = reader.result;
                resolve(baseURL);
            };
        });
    };

    handleChange = (e: any) => {
        let file = e.target.files[0];

        this.getBase64(file)
            .then(result => {
                file["base64"] = result;
                this.setState({
                    file: file
                });
            })
            .catch(err => {
                console.log(err);
            });
    }

    render(): ReactElement<any> {
        const {accept, capture, className, style, template, noResultTemplate} = this.props;
        const {file, error} = this.state;
        if (error) {
            return createElement(ErrorNotification, {errorMessage: error});
        }
        const templateString = this.getTemplateString(template);
        const inputField = D.input({
            type: 'file',
            accept: accept,
            capture: capture,
            onChange: this.handleChange
        });
        let renderedTemplate
        if (file) {
            renderedTemplate = createElement(TemplateItem, {template: {source: templateString, options: {file: file}}, componentProps: {style, className}});
        } else {
            renderedTemplate = createElement(TemplateItem, {template: {source: noResultTemplate}})
        }

        return D.div({className, style}, inputField, renderedTemplate)
    }

    private getTemplateString = (template: string): string => {
        if (template) {
          return template;
        }
      
        return `<div><p>File uploaded</p><dl><dt>Name</dt><dd>{{file.name}}</dd><dt>Type</dt><dd>{{file.type}}</dd><dt>Size</dt>{{file.size}}</dl></div>`;
      }
}

export default FileUpload;