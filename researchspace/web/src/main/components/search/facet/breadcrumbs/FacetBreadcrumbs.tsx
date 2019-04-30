/*
 * Copyright (C) 2015-2019, © Trustees of the British Museum
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
 * @author Artem Kozlov <ak@metaphacts.com>
 */

import * as React from 'react';
import { Component, ReactElement, createFactory } from 'react';
import * as classNames from 'classnames';
import { List } from 'immutable';

import {
  Ast, FacetRelationConjunct, FacetRelationDisjunct,
} from 'platform/components/semantic/search/data/facet/Model';
import {
  ResourceDisjunct, DateRangeDisjunct, NumericRangeDisjunct, EntityDisjunctKinds,
  TemporalDisjunctKinds, NumericRangeDisjunctKind,
} from 'platform/components/semantic/search/data/search/Model';
import { Category, Relation } from 'platform/components/semantic/search/data/profiles/Model';
import { DateConverter, NumericConverter } from '../slider/FacetSlider';

import * as styles from './FacetBreadcrumbs.scss';


export interface FacetBreadcrumbsProps {
  ast: Ast;
  actions: {
    selectCategory: (category: Category) => void;
    selectRelation: (relation: Relation) => void;
    removeConjunct: (relation: FacetRelationConjunct) => void;
  }
}

export class FacetBreadcrumbsComponent extends Component<FacetBreadcrumbsProps, {}> {

  render() {
    const {conjuncts} = this.props.ast;

    if (conjuncts.length === 0) { return null; }

    return (
      <div className={styles.breadcrumbs}>
        <div className={styles.container}>{conjuncts.map(this.breadcrumb)}</div>
      </div>
    );
  }

  private breadcrumb = (conjunct: FacetRelationConjunct) => {
    const disjuncts = List(conjunct.disjuncts.map(disjunct => {
      const elem = this.disjunct(disjunct);
      return List.of(elem, <span className={styles.or}>or</span>);
    })).flatten().butLast();
    const {relation} = conjunct;

    return (
      <div className={styles.conjunct}>
        <div className={classNames(styles.values, 'btn btn-default')}
          onClick={() => this.selectRelation(relation)}>
          <span className={styles.relation}>{relation.label}</span>
          {disjuncts}
        </div>
        <button className={classNames(styles.cancelButton, 'btn btn-default btn-xs')}
          onClick={() => this.props.actions.removeConjunct(conjunct)}>
          <i/>
        </button>
      </div>
    );
  }

  private selectRelation = (relation: Relation) => {
    const {selectCategory, selectRelation} = this.props.actions;
    selectCategory(relation.hasRange);
    selectRelation(relation);
  }

  private disjunct = (disjunct: FacetRelationDisjunct): ReactElement<any> => {
    let value: string | ReactElement<any> = 'unknown facet term';

    if (disjunct.kind === EntityDisjunctKinds.Resource) {
      value = this.resourceDisjunctValue(disjunct as ResourceDisjunct);
    } else if (disjunct.kind === TemporalDisjunctKinds.DateRange) {
      value = this.dateRangeDisjunctValue(disjunct as DateRangeDisjunct);
    } else if (disjunct.kind === NumericRangeDisjunctKind) {
      value = this.numericRangeDisjunctValue(disjunct as NumericRangeDisjunct);
    }

    return <span className={styles.disjunct}>{value}</span>;
  }

  private resourceDisjunctValue(disjunct: ResourceDisjunct) {
    return disjunct.value.label;
  }

  private dateRangeDisjunctValue(disjunct: DateRangeDisjunct) {
    const {toStringFn} = new DateConverter();
    const begin = toStringFn(disjunct.value.begin.year());
    const end = toStringFn(disjunct.value.end.year());

    return (
      <span>{begin}<span className={styles.or}>to</span>{end}</span>
    );
  }

  private numericRangeDisjunctValue(disjunct: NumericRangeDisjunct) {
    const {toStringFn} = new NumericConverter();
    const begin = toStringFn(disjunct.value.begin);
    const end = toStringFn(disjunct.value.end);

    return (
      <span>{begin}<span className={styles.or}>to</span>{end}</span>
    );
  }
}

export const FacetBreadcrumbs = createFactory(FacetBreadcrumbsComponent);
export default FacetBreadcrumbs;
