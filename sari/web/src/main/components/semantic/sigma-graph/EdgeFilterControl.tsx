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
/* eslint-disable react/prop-types */

import * as React from 'react';
import { FC } from 'react';

export interface EdgeFilterControlProps {
    edgeLabels: {label: string, visible: boolean}[];
    setEdgeLabels: (edgeLabels: {label: string, visible: boolean}[]) => void;
}

export const EdgeFilterControl: FC<EdgeFilterControlProps> = (props) => {

    const onEdgeFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const label = event.target.value;
        const newEdgeLabels = props.edgeLabels.map(d => {
            if (d.label === label) {
                return {...d, visible: event.target.checked};
            } else {
                return d;
            }
        });
        props.setEdgeLabels(newEdgeLabels);
    };

    const onEdgeFilterChangeAll = () => {
        if (allChecked) {
            const newEdgeLabels = props.edgeLabels.map(d => ({...d, visible: false}));
            props.setEdgeLabels(newEdgeLabels);
        } else {
            const newEdgeLabels = props.edgeLabels.map(d => ({...d, visible: true}));
            props.setEdgeLabels(newEdgeLabels);
        }
    };

    const allChecked = props.edgeLabels.every(d => d.visible);

    return <div>
        <ul className="filter edgeLabels">
            <li key="li-all">
                <input onChange={onEdgeFilterChangeAll} type="checkbox" id="edge-filter-all"
                    checked={allChecked}
                />&nbsp;
                <label htmlFor="edge-filter-all">(all)</label>
            </li>
            {props.edgeLabels.map(d => (
                <li key={"li-" + d.label}>
                    <input onChange={onEdgeFilterChange} type="checkbox" id={"edge-filter-" + d.label} value={d.label} 
                        checked={d.visible}
                    />&nbsp;
                    <label htmlFor={"edge-filter-" + d.label}>{d.label}</label>
                </li>
            ))}
        </ul>
    </div>
}

export default EdgeFilterControl