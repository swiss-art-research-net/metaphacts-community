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
import * as React from 'react';
import {
  Card, FormControl, FormGroup, Col, FormLabel, FormText
} from 'react-bootstrap';

import { SemanticContextProvider, Component } from 'platform/api/components';
import { ResourceLinkComponent } from 'platform/components/navigation';
import { TemplateItem } from 'platform/components/ui/template';

import {
  ArgumentsBelief, ArgumentsBeliefTypeAssertionKind, ArgumentsBeliefTypeFieldKind,
} from '../ArgumentsApi';

import * as styles from './PremiseComponent.scss';

export interface ExistingBeliefViewProps {
  belief: ArgumentsBelief;
  onCancel?: () => void;
  assertionBasedBeliefTemplate?: string;
  fieldBasedBeliefTemplate?: string;
}

/**
 * Renders view for selected Belief(premise in case of "Inference Making"
 * or addopted Belief in case of "Belief Adoption".
 */
export class ExistingBeliefView extends Component<ExistingBeliefViewProps, {}> {
  private renderCustomBeliefTemplate(belief: ArgumentsBelief, template: string) {
    const {onCancel} = this.props;
    return (
      <div className={styles.evidenceCustom}>
        {onCancel ? (
          <div className={styles.evidenceCustomDeleteButton}>
            <i className='fa fa-times' onClick={onCancel} />
          </div>
        ) : null}
        <TemplateItem template={{
          source: template,
          options: {belief},
        }} />
      </div>
    );
  }

  render() {
    const {belief, onCancel, assertionBasedBeliefTemplate, fieldBasedBeliefTemplate} = this.props;
    const close = onCancel ? <i className='fa fa-times pull-right' onClick={onCancel} /> : null;
    if (belief.argumentBeliefType === ArgumentsBeliefTypeAssertionKind) {
      if (assertionBasedBeliefTemplate) {
        return this.renderCustomBeliefTemplate(belief, assertionBasedBeliefTemplate);
      }
      return (
        <Card className={`form-horizontal ${styles.evidence}`}>
          <Card.Header>{<div><span>Assertion based belief</span>{close}</div>}</Card.Header>
          <Card.Body>
            {...ExistingBeliefContentView(belief)}
          </Card.Body>
        </Card>
      );
    }
    if (belief.argumentBeliefType === ArgumentsBeliefTypeFieldKind) {
      if (fieldBasedBeliefTemplate) {
        return this.renderCustomBeliefTemplate(belief, fieldBasedBeliefTemplate);
      }
      return (
        <Card className={`form-horizontal ${styles.evidence}`}>
            <Card.Header>{<div><span>Field based belief</span>{close}</div>}</Card.Header>
            <Card.Body>
              {...ExistingBeliefContentView(belief)}
            </Card.Body>
        </Card>
      );
    }
  }
}

export function ExistingBeliefContentView(belief: ArgumentsBelief) {
  switch (belief.argumentBeliefType) {
    case ArgumentsBeliefTypeAssertionKind:
      return [
        <FormGroup>
          <Col as={FormLabel} sm={3}>Assertion</Col>
          <Col sm={9}>
            <FormText>
              <SemanticContextProvider repository='assets'>
                <ResourceLinkComponent uri={belief.assertion.value} />
              </SemanticContextProvider>
            </FormText>
          </Col>
        </FormGroup>
      ];
      case ArgumentsBeliefTypeFieldKind:
        return [
          <FormGroup>
            <Col as={FormLabel} sm={3}>Record</Col>
            <Col sm={9}>
              <FormText>
                <ResourceLinkComponent uri={belief.target.value} guessRepository={true} />
              </FormText>
            </Col>
          </FormGroup>,
          <FormGroup>
            <Col as={FormLabel} sm={3}>Field</Col>
            <Col sm={9}>
              <FormText>
                {/* fields are always stored in assets repository */}
                <SemanticContextProvider repository='assets'>
                  <ResourceLinkComponent uri={belief.field.iri} />
                </SemanticContextProvider>
              </FormText>
            </Col>
          </FormGroup>,
        ];
  }
}
