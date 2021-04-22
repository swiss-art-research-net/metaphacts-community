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
import { Rect, Vector, Element, Link, ViewportOptions } from 'ontodia';

import { EventMaker } from 'platform/api/events';

/**
 * @mpSchemaMetadata {"kind": "events"}
 */
export interface OntodiaCanvasEventData {
  /**
   * Perform Force layout.
   */
  'Canvas.ForceLayout': {
    options?: ViewportOptions;
  };
  /**
   * Zoom in diagram.
   */
  'Canvas.ZoomIn': {
    options?: ViewportOptions;
  };
  /**
   * Zoom out diagram.
   */
  'Canvas.ZoomOut': {
    options?: ViewportOptions;
  };
  /**
   * Zoom to fit diagram.
   */
  'Canvas.ZoomToFit': {
    boundingBox?: Rect;
    options?: ViewportOptions;
  };
  /**
   * Center to diagram.
   */
  'Canvas.CenterTo': {
    position: Vector;
    options?: ViewportOptions;
  };
  /**
   * Set zoom level.
   */
  'Canvas.SetZoomLevel': {
    scale: number;
    options?: ViewportOptions;
  };
  /**
   * Zoom by diagram.
   */
  'Canvas.ZoomBy': {
    value: number;
    options?: ViewportOptions;
  };
  /**
   * Export diagram as PNG.
   */
  'Canvas.ExportPng': { fileName: string };
  /**
   * Export diagram as SVG.
   */
  'Canvas.ExportSvg': { fileName: string };
  /**
   * Print diagram;
   */
  'Canvas.Print': {};
}

export interface InternalOntodiaCanvasEventData {
  'CanvasInternal.ZoomToContent': {
    elements: ReadonlyArray<Element>;
    links: ReadonlyArray<Link>;
    options?: ViewportOptions;
  };
  'CanvasInternal.MoveElementToCenter': {
    element: Element;
    position?: Vector;
  };
}

const event: EventMaker<OntodiaCanvasEventData & InternalOntodiaCanvasEventData> = EventMaker;

export const ForceLayout = event('Canvas.ForceLayout');
export const ZoomIn = event('Canvas.ZoomIn');
export const ZoomOut = event('Canvas.ZoomOut');
export const ZoomToFit = event('Canvas.ZoomToFit');
export const CenterTo = event('Canvas.CenterTo');
export const SetZoomLevel = event('Canvas.SetZoomLevel');
export const ZoomBy = event('Canvas.ZoomBy');
export const ExportPng = event('Canvas.ExportPng');
export const ExportSvg = event('Canvas.ExportSvg');
export const Print = event('Canvas.Print');

export const ZoomToContent = event('CanvasInternal.ZoomToContent');
export const MoveElementToCenter = event('CanvasInternal.MoveElementToCenter');
