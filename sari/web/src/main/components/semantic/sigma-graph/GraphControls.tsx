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
//@ts-nocheck

import * as React from 'react';

import { Component } from 'platform/api/components';
import {
    AiOutlineZoomIn,
    AiOutlineZoomOut
  } from "react-icons/ai";
import { MdFilterCenterFocus } from "react-icons/md";

import { ControlsContainer, ZoomControl } from "@react-sigma/core";

export class GraphControls extends Component<{position: string}> {

    render() {
        const position = this.props.position || "bottom-right";
        return (
            <ControlsContainer position={ position }>
                <ZoomControl>
                <AiOutlineZoomIn />
                <AiOutlineZoomOut />
                <MdFilterCenterFocus />
                </ZoomControl>
            </ControlsContainer>

        )
    }
}

export default GraphControls