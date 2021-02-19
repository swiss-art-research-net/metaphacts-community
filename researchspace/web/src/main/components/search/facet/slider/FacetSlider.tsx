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
/**
 * @author Denis Ostapenko, Razdiakonov Daniil
 */

import * as _ from 'lodash';
import * as moment from 'moment';
import { createFactory, Component } from 'react';
import * as React from 'react';
import { FormControl, Alert } from 'react-bootstrap';
import { Range as Slider } from 'rc-slider';
import 'rc-slider/assets/index.css';

import { DateValue, YearValue } from 'platform/components/semantic/search/data/search/Model';
import { ErrorNotification } from 'platform/components/ui/notification';

import { YearInput } from '../../date/YearInput';
import { GraphEvent, FacetSliderGraph } from './FacetSliderGraph';
import * as styles from './FacetSlider.scss';

interface FacetSliderComponentProps<Point> {
  readonly data: ReadonlyArray<DataRange<Point>>;
  readonly value: Data.Maybe<DataRange<Point>>;
  readonly actions: {
    readonly toggleFacetValue: (term: DataRange<Point>) => void;
  }
}

interface FacetSliderDateProps extends FacetSliderComponentProps<DateValue> {
  kind: 'date-range';
}
interface FacetSliderNumericProps extends FacetSliderComponentProps<number> {
  kind: 'numeric-range';
}

export type SliderRange = {begin: number, end: number};

export interface DataRange<Point> {
  begin: Point
  end: Point
}

export type FacetSliderProps = FacetSliderDateProps | FacetSliderNumericProps;
function isDateProps(props: FacetSliderProps): props is FacetSliderDateProps {
  return props.kind === 'date-range';
}
function isNumericProps(props: FacetSliderProps): props is FacetSliderNumericProps {
  return props.kind === 'numeric-range';
}

const ErrorKinds: {
  OutsideOfRange: 'OutsideOfRange'
  BeginLaterThenEnd: 'BeginLaterThenEnd'
  NoResultsInRange: 'NoResultsInRange'
  BeginIsInvalid: 'BeginIsInvalid'
  EndIsInvalid: 'EndIsInvalid'
} = {
  OutsideOfRange: 'OutsideOfRange',
  BeginLaterThenEnd: 'BeginLaterThenEnd',
  NoResultsInRange: 'NoResultsInRange',
  BeginIsInvalid: 'BeginIsInvalid',
  EndIsInvalid: 'EndIsInvalid',
};
type ErrorKind =
  typeof ErrorKinds.OutsideOfRange |
  typeof ErrorKinds.BeginLaterThenEnd |
  typeof ErrorKinds.NoResultsInRange |
  typeof ErrorKinds.BeginIsInvalid |
  typeof ErrorKinds.EndIsInvalid;

interface FacetSliderState<Point> {
  min?: number;
  max?: number;
  isValidRange?: boolean;
  validationError?: ErrorKind;
  dataRange?: DataRange<Point>;
  lastStableRange?: SliderRange;
  events?: GraphEvent[];
}

interface Converter<Point, PropsPoint> {
  toStringFn(input: number): string;
  toSliderRange(inputRange: DataRange<PropsPoint>): SliderRange;
  fromSliderRange(sliderRange: SliderRange): DataRange<PropsPoint>;
  toInputValue(sliderValue: number): Point;
  fromInputValue(input: Point): number;
  isValueValid(input: Point): boolean;
}

export class DateConverter implements Converter<YearValue, DateValue> {
  private fromNumberFn = (x: number): DateValue => moment({year: x}).startOf('year');
  private dateToYears = (m: DateValue): number => {
    return m === null ? null : m.year() + (m.dayOfYear() - 1) / 366;
  }

  toStringFn = (year: number) => `${Math.abs(year)} ${year >= 0 ? 'AD' : 'BC'}`;
  toSliderRange = (dateRange: DataRange<DateValue>): SliderRange => {
    return {
      begin: this.dateToYears(dateRange.begin),
      end: this.dateToYears(dateRange.end),
    };
  }
  fromSliderRange = (sliderRange: SliderRange): DataRange<DateValue> => {
    return {
      begin: this.fromNumberFn(sliderRange.begin),
      end: this.fromNumberFn(sliderRange.end),
    };
  }
  toInputValue = (sliderValue: number): YearValue => {
    return {
      epoch: sliderValue >= 0 ? 'AD' : 'BC',
      year: Math.abs(sliderValue),
    };
  }
  fromInputValue = (yearValue: YearValue): number => {
    const { epoch, year } = yearValue;
    return year * (epoch === 'AD' ? 1 : -1);
  }
  isValueValid = (yearValue: YearValue) => {
    return yearValue && !isNaN(yearValue.year) && (
      yearValue.epoch === 'AD' || yearValue.epoch === 'BC'
    );
  }
}

export class NumericConverter implements Converter<string, number> {
  toStringFn = (input: number): string => '' + input;
  toSliderRange = (inputRange: DataRange<number>): SliderRange => {
    return {
      begin: inputRange.begin,
      end: inputRange.end
    };
  }
  fromSliderRange = (sliderRange: SliderRange): DataRange<number> => {
    return { begin: sliderRange.begin, end: sliderRange.end };
  }
  toInputValue = (sliderValue: number): string => `${sliderValue}`;
  fromInputValue = (input: string): number => parseFloat(input);
  isValueValid = (input: string) => !isNaN(parseFloat(input));
}

interface CustomHandleProps {
  offset?: number
  value?: number
  toStringFn: (number: number) => string
}
class CustomHandle extends Component<CustomHandleProps, {}> {
  render() {
    return <div className={styles.handle} style={{left: this.props.offset + '%'}}>
      {this.props.toStringFn(this.props.value)}
    </div>;
  }
}

interface RangeInputParameters<Point> {
  isValidRange: boolean;
  rangeValue: DataRange<Point>;
  onBeginChange: (beginValue: Point) => void;
  onEndChange: (endValue: Point) => void;
}

interface SliderProps<Point, PropsPoint> extends FacetSliderComponentProps<PropsPoint> {
  readonly converter?: Converter<Point, PropsPoint>;
  readonly renderRangeInputs: (parameters: RangeInputParameters<Point>) => React.ReactElement;
}

class SliderComponent<Point, PropsPoint> extends
Component<SliderProps<Point, PropsPoint>, FacetSliderState<Point>> {
  constructor(props: SliderProps<Point, PropsPoint>) {
    super(props);
    this.state = {};
    this.onNewValue = _.debounce(this.onNewValue, 500);
  }

  static getDerivedStateFromProps<Point, PropsPoint>(
    props: SliderProps<Point, PropsPoint>,
    {
      lastStableRange: stableRange,
      dataRange: curDataRange
    }: FacetSliderState<Point>
  ) {
    const {converter} = props;
    let events = [];
    for (let entity of props.data) {
      const {begin, end} = converter.toSliderRange(entity);
      const weight = 1.0;
      if (begin && end) {
        events.push(new GraphEvent(begin, end, weight));
      }
    }
    const minValue = Math.floor(_.min(events.map(event => event.begin)));
    const maxValue = Math.ceil(_.max(events.map(event => event.end)));
    const lastStableRange = stableRange ?? (props.value).map(
      data => converter.toSliderRange(data)
    ).getOrElse({begin: minValue, end: maxValue});

    const dataRange = curDataRange ?? getDataRangeFromSliderRange(lastStableRange, converter);
    return {
      min: minValue,
      max: maxValue,
      dataRange,
      events: events,
      lastStableRange,
    };
  }

  onNewValue(newValue: DataRange<Point>) {
    const {converter} = this.props;
    const newRange = this.getRange(newValue);
    if (this.isRangeValid(newRange)) {
      const value = converter.fromSliderRange(newRange);
      this.props.actions.toggleFacetValue(value);
      this.setState({isValidRange: true});
    } else {
      let validationError: ErrorKind;
      if (!converter.isValueValid(newValue.begin)) {
        validationError = ErrorKinds.BeginIsInvalid;
      } else if (!converter.isValueValid(newValue.end)) {
        validationError = ErrorKinds.EndIsInvalid;
      } else if (!this.isValidInterval(newRange)) {
        validationError = ErrorKinds.BeginLaterThenEnd;
      } else if (!this.isInRange(newRange)) {
        validationError = ErrorKinds.OutsideOfRange;
      } else if (!this.hasResultsInRange(newRange)) {
        validationError = ErrorKinds.NoResultsInRange;
      }
      this.setState({
        isValidRange: false,
        validationError: validationError,
      });
    }
  }

  render() {
    const {converter, renderRangeInputs} = this.props;
    const {min, max, isValidRange = true, dataRange} = this.state;
    const range = this.getStableRange();
    const events = this.state.events;
    return <div>
      <div className={styles.slidergraph}>
        <FacetSliderGraph events={events} range={range} min={this.state.min} max={this.state.max} />
        {isValidRange ? null : <Alert variant={'danger'}>
            {this.validationMessage()}
          </Alert>
        }
        <Slider
          allowCross={false} min={min} max={max} className={styles.slider}
          value={[range.begin, range.end]}
          handle={props => <CustomHandle {...props} toStringFn={converter.toStringFn} />}
          onChange={this.onSliderValueChange}
        />
        {renderRangeInputs({
          rangeValue: dataRange,
          onBeginChange: this.onBeginChange,
          onEndChange: this.onEndChange,
          isValidRange,
        })}
      </div>
    </div>;
  }

  private onSliderValueChange = (value: number[]) => {
    const {converter} = this.props;
    const newRange = {begin: value[0], end: value[1]};
    const newValue = getDataRangeFromSliderRange(newRange, converter);
    this.setValue(newValue);
    this.onNewValue(newValue);
  }

  private getRange(
    {begin, end}: DataRange<Point>,
    fallBackRange?: SliderRange
  ): SliderRange  {
    const {converter} = this.props;
    return {
      begin: begin && converter.isValueValid(begin) ?
        converter.fromInputValue(begin) :
        fallBackRange ? fallBackRange.begin : undefined,
      end: end && converter.isValueValid(end) ?
        converter.fromInputValue(end) :
        fallBackRange ? fallBackRange.end : undefined,
    };
  }

  private getStableRange(): SliderRange {
    const {dataRange, lastStableRange} = this.state;
    return this.getRange(dataRange, lastStableRange);
  }

  protected setValue(dataRange: DataRange<Point>) {
    const {lastStableRange} = this.state;
    const {converter} = this.props;
    this.setState({dataRange, lastStableRange: {
      begin: converter.isValueValid(dataRange.begin) ?
        converter.fromInputValue(dataRange.begin) : lastStableRange.begin,
      end: converter.isValueValid(dataRange.end) ?
        converter.fromInputValue(dataRange.end) : lastStableRange.end
    }});
  }

  private onBeginChange = (begin: Point) => {
    const newValue = {...this.state.dataRange, begin};
    this.setValue(newValue);
    this.onNewValue(newValue);
  }

  private onEndChange = (end: Point) => {
    const newValue = {...this.state.dataRange, end};
    this.setValue(newValue);
    this.onNewValue(newValue);
  }

  private isRangeValid = (range: SliderRange): boolean =>
    this.isValidInterval(range) && this.isInRange(range) && this.hasResultsInRange(range)

  private isValidInterval = (range: SliderRange): boolean =>
    range.begin <= range.end

  private isInRange = (range: SliderRange): boolean =>
    range.begin >= this.state.min && range.end <= this.state.max

  private hasResultsInRange = (range: SliderRange): boolean =>
    _.some(this.state.events, event => event.begin <= range.end && event.end >= range.begin)

  private validationMessage = (): string => {
    const {converter} = this.props;
    const {min, max} = this.state;
    switch (this.state.validationError) {
      case ErrorKinds.OutsideOfRange:
        return `Available range is ${converter.toStringFn(min)} - ${converter.toStringFn(max)}`;
      case ErrorKinds.BeginLaterThenEnd:
        return 'Begin should not be later than end';
      case ErrorKinds.NoResultsInRange:
        return 'No results in chosen range';
      case ErrorKinds.BeginIsInvalid:
        return 'The beginning of range is invalid';
      case ErrorKinds.EndIsInvalid:
        return 'The ending of range is invalid';
    }
  }
}

function getDataRangeFromSliderRange<Point, PropsPoint>(
  range: SliderRange,
  converter: Converter<Point, PropsPoint>
): DataRange<Point>  {
  return {
    begin: converter.toInputValue(range.begin),
    end: converter.toInputValue(range.end),
  };
}

export class FacetSliderComponent extends Component<FacetSliderProps> {
  private renderYearRangeInputs = ({
    rangeValue,
    onBeginChange,
    onEndChange,
    isValidRange
  }: RangeInputParameters<YearValue>) => {
    return <div className={styles.range}>
      <YearInput value={rangeValue.begin}
        onChange={onBeginChange}
        isYearValid={isValidRange}
      />
      <span>to</span>
      <YearInput value={rangeValue.end}
        onChange={onEndChange}
        isYearValid={isValidRange}
      />
    </div>;
  }

  private renderStringRangeInputs = ({
    rangeValue,
    onBeginChange,
    onEndChange
  }: RangeInputParameters<string>) => {
    return <div className={styles.range}>
      <FormControl
        type='number'
        value={rangeValue.begin}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.value;
          onBeginChange(newValue);
        }}
      />
      <span>to</span>
      <FormControl
        type='number'
        value={rangeValue.end}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.value;
          onEndChange(newValue);
        }}
      />
    </div>;
  }

  render() {
    if (isDateProps(this.props)) {
      return <SliderComponent
        {...this.props}
        converter={new DateConverter()}
        renderRangeInputs={this.renderYearRangeInputs}>
      </SliderComponent>;
    } else if (isNumericProps(this.props)) {
      return <SliderComponent
        {...this.props}
        converter={new NumericConverter()}
        renderRangeInputs={this.renderStringRangeInputs}>
      </SliderComponent>;
    } else {
      return <ErrorNotification errorMessage={
        'Props should be one of following typesDate: FacetSliderDateProps, FacetSliderNumericProps'
      } />;
    }
  }
}

export const FacetSlider = createFactory(FacetSliderComponent);
export default FacetSlider;
