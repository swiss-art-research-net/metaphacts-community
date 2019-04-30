/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import { BrowserPersistence } from 'platform/api/persistence';

import { ConfigHolder } from 'platform/api/services/config-holder';

const LS_LANGUAGE_PREFERENCES_KEY = 'preferredLanguage';
const DEFAULT_LANGUAGE = 'en';

const LanguagePreferences = BrowserPersistence.adapter<{
  userLanguageTag?: string;
}>();

/**
 * @returns BCP 47 language tag
 */
export function getPreferredUserLanguage(): string {
  const preferences = LanguagePreferences.get(LS_LANGUAGE_PREFERENCES_KEY) || {};
  if (typeof preferences.userLanguageTag === 'string') {
    return preferences.userLanguageTag;
  }
  const {preferredLanguages} = ConfigHolder.getUIConfig();
  if (preferredLanguages.length > 0) {
      return preferredLanguages[0];
  }
  return DEFAULT_LANGUAGE;
}

export function setPreferredUserLanguage(bcp47LanguageTag: string | undefined) {
  LanguagePreferences.update(LS_LANGUAGE_PREFERENCES_KEY, {
    userLanguageTag: bcp47LanguageTag,
  });
}
