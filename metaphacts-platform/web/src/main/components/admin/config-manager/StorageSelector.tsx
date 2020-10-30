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
import * as classnames from 'classnames';
import * as React from 'react';
import { CSSProperties } from 'react';
import ReactSelect, { Option } from 'react-select';

import { Component } from 'platform/api/components';

import { Alert, AlertType } from 'platform/components/ui/alert';

import * as styles from './StorageSelector.scss';

export interface StorageSelectorProps {
  className?: string;
  allApps: ReadonlyArray<AppStatus>;
  sourceApps: ReadonlyArray<string>;
  targetApp: string;
  onChange: (targetApp: string) => void;
}

export interface AppStatus {
  readonly appId: string;
  readonly writable: boolean;
}

export class StorageSelector extends Component<StorageSelectorProps, {}> {
  render() {
    const {allApps, sourceApps, targetApp, onChange} = this.props;

    const overrideChain: JSX.Element[] = [];
    for (let i = 0; i < sourceApps.length; i++) {
      const isLast = i === sourceApps.length - 1;
      const appId = sourceApps[i];
      overrideChain.push(
        <span key={`app-${i}`}
          className={isLast ? styles.effectiveApp : styles.overriddenApp}>
          {appId}
        </span>
      );
      if (!isLast) {
        overrideChain.push(
          <span key={`arrow-${i}`}
            className={classnames(styles.overrideArrow, 'fa fa-arrow-right')}
          />
        );
      }
    }

    return (
      <div className={classnames(styles.component, this.props.className)}>
        {this.renderWarning()}
        <div className={styles.mainPart}>
          {overrideChain.length === 0 ? null : (
            <div className={styles.labeledControl}>
              <span>App overrides:&nbsp;</span>
              <div className={styles.overrideChain}>{overrideChain}</div>
            </div>
          )}
          <div className={styles.labeledControl}>
            <span>Target App:&nbsp;</span>
            <ReactSelect className={styles.selector}
              clearable={false}
              value={targetApp}
              options={allApps.map((status): Option<string> => ({
                value: status.appId,
                label: status.writable ? status.appId : `${status.appId} (readonly)`,
                disabled: !status.writable,
              }))}
              onChange={newValue => {
                if (Array.isArray(newValue) || typeof newValue.value !== 'string') { return; }
                onChange(newValue.value);
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  private renderWarning() {
    const {allApps, sourceApps, targetApp, onChange} = this.props;
    if (sourceApps.length === 0) {
      return null;
    }
    const overrideOrder = allApps.map(status => status.appId);
    const effectiveApp = sourceApps[sourceApps.length - 1];
    if (overrideOrder.indexOf(targetApp) < overrideOrder.indexOf(effectiveApp)) {
      return (
        <Alert className={styles.warning}
          alert={AlertType.WARNING}
          message={''}>
          Note: data from target app <span className={styles.effectiveApp}>{targetApp}</span> will
          be shadowed by existing data
          from <span className={styles.effectiveApp}>{effectiveApp}</span>.
        </Alert>
      );
    }
  }
}

export function chooseDefaultTargetApp(
  storageStatus: ReadonlyArray<AppStatus>,
  sourceAppId?: string | null
): string | undefined {
  if (storageStatus.length === 0) {
    return undefined;
  }

  const foundApp = sourceAppId
    ? storageStatus.find(s => s.appId === sourceAppId)
    : storageStatus.find(s => s.appId === 'runtime');

  if (foundApp && foundApp.writable) {
    return foundApp.appId;
  }

  const firstWritable = storageStatus.find(s => s.writable);
  return firstWritable ? firstWritable.appId : undefined;
}
