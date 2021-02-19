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
import { ClassAttributes, createFactory, createElement } from 'react';
import * as D from 'react-dom-factories';
import Slider from 'react-slick';
import * as _ from 'lodash';
import * as assign from 'object-assign';

import { BuiltInEvents, trigger } from 'platform/api/events';
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { Component, ComponentContext } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';

const SliderComponent = createFactory(Slider);

import './SemanticCarousel.scss';

export interface SemanticCarouselConfig {
  /**
   * SPARQL SELECT query string
   */
  query: string;

  /**
   * [handlebars.js](http://handlebarsjs.com/) HTML slide template.
   * SPARQL query projection variables are available in the template
   */
  tupleTemplate: string;

  /**
   * Template which is applied when query returns no results
   */
  noResultTemplate?: string;

  /**
   * Additional carousel config options propagated to underlying library [react-slick](https://github.com/akiran/react-slick)
   */
  options?: ReactSlickOptions;

  /**
   * ID for issuing component events.
   */
  id?: string;
}

interface ReactSlickOptions {
  /**
   * Enables tabbing and arrow key navigation
   *
   * @default true
   */
  accessibility?: boolean

  /**
   * Enables adaptive height for single slide horizontal carousels
   *
   * @default false
   */
  adaptiveHeight?: boolean

  /**
   * Show left and right nav arrows
   *
   * @default true
   */
  arrows?: boolean

  /**
   * Enables Autoplay
   *
   * @default false
   */
  autoplay?: boolean

  /**
   * Autoplay Speed in milliseconds
   *
   * @default 3000
   */
  autoplaySpeed?: number

  /**
   * Enables centered view with partial prev/next slides
   *
   * @default false
   */
  centerMode?: boolean

  /**
   * Additional class name for the inner slider div
   */
  className?: string

  /**
   * Show dot indicators
   *
   * @default false
   */
  dots?: boolean

  /**
   * Class for slide indicator dots container
   *
   * @default 'slick-dots'
   */
  dotsClass?: string

  /**
   * Enable mouse dragging
   *
   * @default true
   */
  draggable?: boolean

  /**
   * Enable fade
   *
   * @default false
   */
  fade?: boolean

  /**
   * Go to slide on click
   *
   * @default false
   */
  focusOnSelect?: boolean

  /**
   * Infinite loop sliding
   *
   * @default true
   */
  infinite?: boolean

  /**
   * Slide to start on
   *
   * @default 0
   */
  initialSlide?: number

  /**
   * Loads images or renders components on demands
   *
   * @default false
   */
  lazyLoad?: boolean

  /**
   * Pause Autoplay On Hover
   *
   * @default true
   */
  pauseOnHover?: boolean

  /**
   * Object containing breakpoints and settings objects.
   * Enables settings sets at given screen width.
   * Breakpoints in the array should be ordered from smalles to greatest.
   *
   * @example [ { breakpoint: 768, settings: { slidesToShow: 3 } }, { breakpoint: 1024, settings: { slidesToShow: 5 } }, { breakpoint: 100000, settings: 'unslick' } ]
   */
  responsive?: Array<{
    /**
     * maxWidth so the settings will be applied when resolution is below this value
     */
    breakpoint: number

    /**
     * Set settings to "unslick" instead of an object to disable slick at a given breakpoint.
     */
    settings: 'unslick' | ReactSlickOptions
  }>

  /**
   * Change the slider's direction to become right-to-left
   *
   * @default false
   */
  rtl?: boolean

  /**
   * Number of slides to be visible at a time
   *
   * @default 1
   */
  slidesToShow?: number

  /**
   * Enable/Disable CSS Transitions
   *
   * @default true
   */
  useCSS?: boolean

  /**
   * Vertical slide mode
   *
   * @default false
   */
  vertical?: boolean
}

export type SemanticCarouselProps = SemanticCarouselConfig & ClassAttributes<SemanticCarousel>;

interface SemanticCarouselState {
  isLoading: boolean;
  noResults?: boolean;
  data?: SparqlClient.SparqlStarSelectResult;
}

export class SemanticCarousel extends Component<SemanticCarouselProps, SemanticCarouselState> {

  constructor(props: SemanticCarouselProps, context: ComponentContext) {
    super(props, context);
    this.state = {
      isLoading: true,
      noResults: false,
    };
  }

  public render() {
    return D.div(
      {className: 'semantic-carousel'},
      this.state.isLoading ? createElement(Spinner) :
      !SparqlUtil.isSelectResultEmpty(this.state.data) ?
        this.getSliderComponent(this.state.data) :
        createElement(TemplateItem, {template: {source: this.props.noResultTemplate}})
    );
  }

  public getSliderComponent(data: SparqlClient.SparqlStarSelectResult) {
    const defaultSettings = {
          dots: true,
          infinite: true,
          speed: 500,
          slidesToShow: 1,
          lazyLoad: true,
          slidesToScroll: 1,
        };
    const settings = assign({}, defaultSettings, this.getCarouselOptions());
    const _data = prepareResultData(data);
    const items = _.map(_data, (tuple, i) => {
      // slides needs to be wrapped in div
      // see https://github.com/akiran/react-slick/issues/328
      return D.div(
        {key: i},
        createElement(TemplateItem, {
          template: {
            source: this.getTupleTemplate(),
            options: tuple,
          },
          componentProps: {
            className: 'semantic-carousel-item',
          },
        })
      );
    });
    return SliderComponent(settings, items);
  }

  public componentWillReceiveProps(nextProps: SemanticCarouselProps, nextContext: any) {
    if (nextProps.query !== this.props.query) {
      this.prepareConfigAndExecuteQuery(nextProps, nextContext);
    }
  }

  public componentWillMount() {
    this.prepareConfigAndExecuteQuery(this.props, this.context);
  }

  public shouldComponentUpdate(
    nextProps: SemanticCarouselProps, nextState: SemanticCarouselState
  ) {
    return nextProps.query !== this.props.query || nextState !== this.state;
  }

  private prepareConfigAndExecuteQuery =
    (props: SemanticCarouselProps, context: ComponentContext) => {
      const stream = SparqlClient.selectStar(props.query, {context: context.semanticContext});
      stream.onValue(
        res => this.setState({data: res, isLoading: false})
      ).onEnd(() => {
        if (this.props.id) {
          trigger({eventType: BuiltInEvents.ComponentLoaded, source: this.props.id});
        }
      });

      if (this.props.id) {
        trigger({
          eventType: BuiltInEvents.ComponentLoading,
          source: this.props.id,
          data: stream,
        });
      }
    }

  private getTupleTemplate(): string {
    if (_.has(this.props, 'layout')) {
      console.warn(
        'layout property in semantic-carousel is deprecated, please use flat properties instead'
      );
      return (this.props as any)['layout']['tupleTemplate'];
    }
    return this.props.tupleTemplate;
  }

  private getCarouselOptions(): {} {
    if (_.has(this.props, 'layout')) {
      console.warn(
        'layout property in semantic-carousel is deprecated, please use flat properties instead'
      );
      return (this.props as any)['layout']['options'];
    }
    return this.props.options;
  }
}

/**
 * Transform sparql results to make sure that there are values in the bindings
 * for all projection variables. This simplify handling of results in visualization
 * components.
 */
function prepareResultData(data: SparqlClient.SparqlStarSelectResult) {
  return _.each(
    data.results.bindings,
    binding => _.map(
      data.head.vars, bindingVar => binding[bindingVar] ? binding[bindingVar] : Rdf.literal('')
    )
  );
}

export default SemanticCarousel;
