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
import * as React from 'react';
import {
  ReactElement, cloneElement, Children, createFactory,
} from 'react';
import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import { refresh, navigateToResource } from 'platform/api/navigation';
import { LoadingBackdrop } from 'platform/components/utils/LoadingBackdrop';

import * as _ from 'lodash';

interface State {
  isLoading: boolean;
}

interface Props {
  /**
   * The GET url that is supposed to return a file (stream).
   */
  downloadUrl: string;
  /**
   * To open the download url with a delay in ms.
   * @default 1000
   **/
  delay: number;
  /**
   * @default 'reload'
   */
  postAction?: 'reload' | string;
}
/**
 * Opens the given downloadUrl in a new window or tab after a delay.
 * @example
 *  <mp-file-download delay='2000' post-action="reload" download-url="/rest/admin/storages/runtime/zip">
 *    <button class="btn btn-primary btn-sm active">OK. Start Download.</button>
 *  </mp-file-download>
 */
export class FileDownload extends Component<Props, State> {
  defaultProps = { delay: 1000, postAction: 'reload' }

  constructor(props: Props, state: State) {
    super(props, state);
    this.state = {
      isLoading: false,
    };
  }

  public render() {
    const Backdrop = createFactory(LoadingBackdrop);
    if (this.state.isLoading) {
      return <Backdrop />
    }
    const child = Children.only(this.props.children) as ReactElement<any>;
    const props = {
      onClick: this.download,
    };
    return cloneElement(child, props);
  }

  download = () => {
    const { downloadUrl, postAction, delay } = this.props;
    this.setState({
      isLoading: true
    });
    setTimeout(() => {
      this.setState({
        isLoading: false
      });
      const response = {
        file: downloadUrl,
      };

      window.open(response.file);

      if (postAction === 'reload') {
        refresh();
      } else {
        navigateToResource(Rdf.iri(postAction)).onValue(v => v);
      }
    }, delay);
  }

}
export default FileDownload;
