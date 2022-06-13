/*
 * Copyright (C) 2022, © Swiss Art Research Infrastructure, University of Zurich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
import { trigger } from 'platform/api/events';
import * as UploadEvents from './UploadEvents'

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
    id?: string;
    /**
     * Define the maximum allowed size of the file in MegaBytes (MB).
     */
    maxFileSize?: number;
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
    file?: any;
    error?: any;
}

export class FileUpload extends Component<FileUploadConfig, State> {
    
    constructor(props: FileUploadConfig, context: any) {
        super(props, context);
        this.state = {};
    }

    componentDidUpdate(prevProps: FileUploadConfig, prevState: State) {
        if (this.state.file !== prevState.file) {
            trigger({
                eventType: UploadEvents.UploadFileUploaded,
                source: this.props.id,
                data: {file: this.state.file}
              });
        }
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
                if (this.props.maxFileSize && file.size > this.props.maxFileSize * 1024 * 1024) {
                    file.tooBig = true;
                } else {
                    file.tooBig = false;
                }
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
            if (!file.tooBig) {
                renderedTemplate = createElement(TemplateItem, {template: {source: templateString, options: {file: file}}, componentProps: {style, className}});
            } else {
                renderedTemplate = createElement(TemplateItem, {template: {source: `<div><p>File is too big. The maximum file size is ${this.props.maxFileSize} MB.</p></div>`}, componentProps: {style, className}});
            }
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