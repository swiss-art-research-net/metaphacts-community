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
import * as React from 'react';
import { find, map } from 'lodash';
import { NavDropdown, Dropdown } from 'react-bootstrap';

import { Component } from 'platform/api/components';
import { refresh } from 'platform/api/navigation';
import { ConfigHolder, UIConfig } from 'platform/api/services/config-holder';
import {
  getPreferredUserLanguage, setPreferredUserLanguage
} from 'platform/api/services/language';

/**
 * Dropdown with language tags where the user can choose from.
 * Selecting a language will set the user's preferred language
 * in the browsers local store.
 *
 * **Example**:
 * ```
 * <!-- Use languages from platform-wide UI configuration -->
 * <mp-user-language-switch></mp-user-language-switch>
 *
 * <!-- Use languages specified in the attribute -->
 * <mp-user-language-switch languages='["de","en","en-gb"]'></mp-user-language-switch>
 * ```
 */
interface UserLanguageSwitchConfig {
  /**
   * Language tags that the user is able to choose from
   */
  languages?: ReadonlyArray<string>;
}

export type UserLanguageSwitchProps = UserLanguageSwitchConfig;

interface State {
  readonly language?: string;
}

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
export class UserLanguageSwitch extends Component<UserLanguageSwitchProps, State> {
  constructor(props: UserLanguageSwitchProps, context: any) {
    super(props, context);
    this.state = {language: getPreferredUserLanguage()};
  }

  private getLanguages(config: UIConfig) {
    if (this.props.languages) {
      return this.props.languages;
    }
    return config.preferredLanguages;
  }

  render() {
    const uiConfig = ConfigHolder.getUIConfig();

    const options = this.getLanguages(uiConfig).map(lang => {
      return {key: lang, label: lang};
    });

    const language = this.state.language;

    let selectedOption = find(options, option => option.key === language);
    if (!selectedOption) {
      selectedOption = {key: language, label: language};
      options.unshift(selectedOption);
    }

    if (options.length <= 1) {
      return null;
    }

    return (
      <NavDropdown id='language-selection'
        title={selectedOption.label} onSelect={(e: unknown) => this.onLanguageChanged(e as string)}>
        {map(options, option => (
          <Dropdown.Item key={option.key} eventKey={option.key}>{option.label}</Dropdown.Item>
        ))}
      </NavDropdown>
    );
  }

  private onLanguageChanged(language: string): void {
    setPreferredUserLanguage(language);
    this.setState({language: language});
    refresh();
  }
}

export default UserLanguageSwitch;
