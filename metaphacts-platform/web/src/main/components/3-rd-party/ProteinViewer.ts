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
import { Component, HTMLProps, createFactory, createElement } from 'react';
import * as D from 'react-dom-factories';
import { findDOMNode } from 'react-dom';
import * as pv from 'bio-pv';
import * as request from 'platform/api/http';
import * as Kefir from 'kefir';
import * as maybe from 'data.maybe';
import * as ReactBootstrap from 'react-bootstrap';
import * as _ from 'lodash';
import * as assign from 'object-assign';

import { Spinner } from 'platform/components/ui/spinner';

const Button = createFactory(ReactBootstrap.Button);

interface ProteinViewerConfig extends HTMLProps<ProteinViewerComponent> {
    url: string
}

interface ProteinViewerState {
  structure?: Data.Maybe<any>;
  error?: Data.Maybe<string>;
}

const REF = 'mp-protein-viewer';

enum MODE {
  PRESET, CARTOON, TUBE, LINE, LINETRACE, SMOOTHLINETRACE, TRACE,
}

const modes: {[index: string]: MODE} = {
  'Preset' : MODE.PRESET,
  'Cartoon' : MODE.CARTOON,
  'Tube' : MODE.TUBE,
  'Lines' : MODE.LINE,
  'Line Trace' : MODE.LINETRACE,
  'Smooth Line Trace' : MODE.SMOOTHLINETRACE,
  'Trace' : MODE.TRACE,
};

export class ProteinViewerComponent extends Component<ProteinViewerConfig, ProteinViewerState> {
  private viewer: pv.Viewer;
  constructor(props: ProteinViewerConfig, context: any) {
    super(props, context);
    this.state = {
      structure: maybe.Nothing<any>(),
      error: maybe.Nothing<any>(),
    };
  }




  componentDidMount() {

      this.viewer = pv.Viewer(findDOMNode(this.refs[REF]) as Element,
                             { quality : 'medium',
                              width: 'auto',
                              height : 'auto',
                               antialias : true, outline : true}
                             );
     const req = request
         .get(this.props.url)
         .type('application/x-pdb');

     Kefir.fromNodeCallback<string>(
       (cb) => req.end((err, res) => {
         cb(err, res ? res.text : null);
       })
     )
     .onValue(x => this.renderProtein(x))
     .onError(e => this.setState({
       error: maybe.Just<string>(
         'Failed to retrieve pdb data for pdb id:' + this.props.url
       ),
     }));

      window.onresize = () => {
        this.viewer.fitParent();
      };
  }

  renderProtein = (responseText: string) => {
    const structure = pv.io.pdb(responseText);
    this.preset(structure);
    this.viewer.centerOn(structure);

    this.setState({structure: maybe.Just(structure)});
  }

  preset = (structure: pv.Structure) => {
      this.viewer.clear();
      const ligand = structure.select({rnames : ['RVP', 'SAH']});
      this.viewer.ballsAndSticks('ligand', ligand);
      this.viewer.cartoon('protein', structure);
  }

  getMenue = () => {
    if (this.state.structure.isNothing) {
      return createElement(Spinner, {}, 'Loading pdb data.');
    }

    const items = _.map(modes, (mode: MODE, label: string) =>
      Button({onClick: () => this.changeMode(mode), className: 'btn btn-link btn-xs'}, label)
    );
    return D.div({style: {position: 'absolute', bottom: -20}}, items);
  }



  changeMode = (mode: MODE) => {
    if (this.state.structure.isNothing) {
      return ;
    }

    const structure = this.state.structure.get();
    this.viewer.clear();
    switch (mode) {
      case MODE.PRESET:
        this.preset(structure);
        break;
      case MODE.CARTOON:
        this.viewer.cartoon('structure', structure, { color: pv.color.ssSuccession() });
        break;
      case MODE.TUBE:
        this.viewer.tube('structure', structure);
        break;
      case MODE.LINE:
        this.viewer.lines('structure', structure);
        break;
      case MODE.LINETRACE:
        this.viewer.lineTrace('structure', structure);
        break;
      case MODE.SMOOTHLINETRACE:
      this.viewer.sline('structure', structure);
        break;
      case MODE.TRACE:
        this.viewer.trace('structure', structure);
        break;
      default:
         this.preset(structure);
    }
  }

  componentDidUpdate() {
    if (this.viewer) {
      this.viewer.fitParent();
    }
  }


  render() {
    const props = assign(
      {},
      {style: {'position': 'relative', 'height': '500px', 'width': '500px' }},
      this.props,
      {ref: REF}
    );
    return this.state.error.isJust
      ? D.span({}, this.state.error.get())
      : D.div(props,
        this.getMenue()
      );
  }
}

export default ProteinViewerComponent;
