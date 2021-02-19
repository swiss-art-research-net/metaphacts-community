/*
 * Copyright (C) 2015-2020, © Trustees of the British Museum
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
import { createFactory, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as Kefir from 'kefir';
import * as Immutable from 'immutable';
import * as classNames from 'classnames';

import { Rdf } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { CreateResourceDialog } from 'platform/components/ldp';

// TODO: remove KefirComponent and replace it by utilizing Cancellation object
import { KefirComponentBase } from 'platform/components/utils/KefirComponent';

import {
  queryIIIFImageOrRegion, ImageOrRegionInfo,
} from '../../data/iiif/ImageAnnotationService';
import LdpOverlayImageService from '../../data/iiif/LDPOverlayImageService';

import { OpenSeadragonOverlay } from './OpenSeadragonOverlay';

import '../../scss/image-overlay.scss';
import * as block from 'bem-cn';

const b = block('overlay-comparison');

export interface OverlayComparisonConfig {
  /**
   * Images IRIs to be compared.
   */
  selection: Array<string>;
  /**
   * Pattern to generate image ID from image IRI.
   */
  imageIdPattern: string;
  /**
   * IIIF server URL.
   */
  iiifServerUrl: string;
  /**
   * Repositories to query the image.
   */
  repositories?: Array<string>;
}

export type Props = OverlayComparisonConfig;

interface State {
  loading?: boolean;
  creatingImage?: boolean;
  error?: any;
  firstImageWeight?: number;
}

interface LoadedState {
  metadata?: Immutable.List<ImageOrRegionInfo>;
}

/**
 * Provides images comparison by overlaying them on top of
 * each other with variable opacity.
 *
 * @example
 * <div style='width: 50%; height: 600px;'>
 *   <rs-iiif-overlay
 *     selection='["http://example.com/bar/image1", "http://example.com/bar/image2"]'
 *     image-id-pattern='BIND(REPLACE(?imageIRI, "^http://example.com/(.*)$", "$1") as ?imageID)'
 *     iiif-server-url='<iiif-server>'>
 *   </rs-iiif-overlay>
 * </div>
 */
export class OverlayComparison extends KefirComponentBase<Props, State, LoadedState> {
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = this.updateState({firstImageWeight: 0.5});
  }

  static defaultProps = {
    repositories: ['default'],
  };

  loadState(props: Props) {
    const tasks = props.selection
      .map(iri => queryIIIFImageOrRegion(Rdf.iri(iri), props.imageIdPattern, props.repositories));
    return Kefir.zip(tasks).map(metadata => ({
      metadata: Immutable.List(metadata),
    }));
  }

  render() {
    const rendered = super.render();
    return D.div(
      {
        className: b('').toString(),
      },
      D.div(
        {
          className: b('controls').toString(),
        },
        D.span({className: b('image-label').toString() }, 'First image'),
        D.input({
          className: b('slider').toString(),
          readOnly: this.state.loading,
          type: 'range',
          min: 0, max: 1, step: 0.01,
          value: this.state.firstImageWeight as any,
          onChange: event => {
            const input = event.target as HTMLInputElement;
            const opacity = parseFloat(input.value);
            const capped = isNaN(opacity)
              ? 0.5 : Math.min(1, Math.max(0, opacity));
            this.setState(this.updateState({firstImageWeight: capped}));
          },
        }),
        D.span({className: b('image-label').toString() }, 'Second image'),
        D.button({
          type: 'button',
          className: classNames('btn', 'btn-secondary', b('submit').toString()),
          disabled: this.state.loading || this.state.creatingImage,
          onClick: () => {
            const dialogRef = 'create-overlay-image';
            getOverlaySystem().show(
              dialogRef,
              createElement(CreateResourceDialog, {
                onSave: this.createOverlayImage,
                onHide: () => getOverlaySystem().hide(dialogRef),
                show: true,
                title: 'Create overlay image',
                placeholder: 'Enter image title',
              })
            );
          },
        }, 'Create overlayed image')
      ),
      D.div(
        {className: b('image-container').toString() },
        rendered ? rendered : createElement(OpenSeadragonOverlay, {
          metadata: this.state.metadata,
          iiifServerUrl: this.props.iiifServerUrl,
          firstImageWeight: this.state.firstImageWeight,
        })
      )
    );
  }

  private createOverlayImage = (name: string): Kefir.Property<any> => {
    if (!this.state.metadata || this.state.metadata.size < 2) { return; }

    this.setState(this.updateState({creatingImage: true}));

    return LdpOverlayImageService.createOverlayImage(
      name,
      this.state.metadata.get(0).iri, this.state.firstImageWeight,
      this.state.metadata.get(1).iri, 1 - this.state.firstImageWeight
    ).flatMap(
      res => {
        this.setState(this.updateState({creatingImage: false}));
        return navigateToResource(res, {}, 'assets');
      }
    ).toProperty();
  }
}

export type c = OverlayComparison;
export const c = OverlayComparison;
export const f = createFactory(c);
export default c;
