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
import { responsePanel } from 'platform/components/sparql-editor/SparqlQueryEditor.scss';

interface ImageUploadConfig {
    /**
     * If an image should be captured via the camera, specify the preferred camera.
     * "user" - the user's camera
     * "environment" - the environment's camera
     */
    capture?: string;
    className?: string;
    /**
     * Define the maximum allowed size of the file in MegaBytes (MB).
     */
    maxFileSize?: number;
    /**
     * Define the maximum size of the image in pixels (width or height). The uploaded image will be resized to this dimension
     */
    maxPixels?: number;
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

interface IResizeImageOptions {
    maxPixels: number;
    file: File;
}

export class ImageUpload extends Component<ImageUploadConfig, State> {
    
    constructor(props: ImageUploadConfig, context: any) {
        super(props, context);
        this.state = {};
    }

    componentDidUpdate(prevProps: ImageUploadConfig, prevState: State) {
        if (this.state.file !== prevState.file) {
          console.log('file changed');
        }
      }

    getBase64 = (file: any) => {
        return new Promise(resolve => {
            if (this.props.maxPixels) {
                resizeImage({
                    file: file,
                    maxPixels: this.props.maxPixels
                }).then(function (resizedImage) {
                    resolve(resizedImage)
                }).catch(function (err) {
                    console.log(err);
                });
            } else {
                let reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    let baseURL = reader.result;
                    resolve(baseURL);
                };
            }

            
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
        const {capture, className, style, template, noResultTemplate} = this.props;
        const {file, error} = this.state;
        if (error) {
            return createElement(ErrorNotification, {errorMessage: error});
        }
        const templateString = this.getTemplateString(template);
        const inputField = D.input({
            type: 'file',
            accept: 'image/jpeg, image/jpg, image/png, image/gif',
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
      
        return `<div><p>Image uploaded</p><dl><dt>Name</dt><dd>{{file.name}}</dd><dt>Type</dt><dd>{{file.type}}</dd><dt>Size</dt>{{file.size}}</dl></div>`;
      }
}

const resizeImage = (settings: IResizeImageOptions) => {
    // Code from https://stackoverflow.com/questions/23945494/use-html5-to-resize-an-image-before-upload
    const file = settings.file;
    const maxPixels = settings.maxPixels;
    const reader = new FileReader();
    const image = new Image();
    const canvas = document.createElement('canvas');
    const resize = () => {
        let width = image.width;
        let height = image.height;

        if (width > height) {
            if (width > maxPixels) {
                height *= maxPixels / width;
                width = maxPixels;
            }
        } else {
            if (height > maxPixels) {
                width *= maxPixels / height;
                height = maxPixels;
            }
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg');
        return dataUrl;
    };

    return new Promise((ok, no) => {
        if (!file.type.match(/image.*/)) {
            no(new Error("Not an image"));
            return;
        }

        reader.onload = (readerEvent: any) => {
            image.onload = () => ok(resize());
            image.src = readerEvent.target.result;
        };
        reader.readAsDataURL(file);
    })    
};

export default ImageUpload;