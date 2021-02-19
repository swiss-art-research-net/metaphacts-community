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
package com.metaphacts.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.annotation.Nullable;
import javax.validation.constraints.NotNull;

import org.apache.commons.collections.CollectionUtils;

import com.google.common.base.Strings;
import com.google.common.collect.Lists;

/**
 * Contains the set of methods to work with a preferredLanguage string.
 * This string is a language tag (or comma-separated list of language tags with decreasing order of preference)
 * of the preferred language(s) (optional).
 * A language tag consists of the language and optionally variant, e.g.
 * <code>de</code> or <code>de-CH</code>. See <a href="https://tools.ietf.org/html/rfc4647">RFC4647</a> for details.<br>
 * Examples: <code>en</code>, <code>en,fr-CH,de,ru</code></li>
 */
public class LanguageHelper {
    /**
     * The function merges preferred languages from different sources and returns one preferredLanguage string.
     * Each string is a language tag (or comma-separated list of language tags with decreasing order of preference)
     * of the preferred language(s). A language tagы consists of the language and optionally variant, e.g. <code>de</code>
     * or <code>de-CH</code>. See <a href="https://tools.ietf.org/html/rfc4647">RFC4647</a> for details.<br>
     * Examples: <code>en</code>, <code>en,fr-CH,de,ru</code>. All language tags are merged into the one language tags
     * which include all provided tags.
     * The order of the provided tags has meaning. Languages from the second list will always have
     * lower weight than languages from the first list.
     *
     * @param preferredLanguages
     * @return
     * @throws IllegalArgumentException
     */
    public static @Nullable String mergePreferredLanguages(String... preferredLanguages) throws IllegalArgumentException {
       List<String> filteredPreferredLanguages = Arrays.stream(preferredLanguages)
           .filter(stringRange -> !Strings.isNullOrEmpty(stringRange)).collect(Collectors.toList());
       if (filteredPreferredLanguages.size() == 0) {
           return null;
       } else if (filteredPreferredLanguages.size() == 1) {
           return filteredPreferredLanguages.get(0);
       } else {
           List<String> languages = new ArrayList<>();
           for (String stringRange : filteredPreferredLanguages) {
               for(Locale.LanguageRange range : Locale.LanguageRange.parse(stringRange)) {
                   String lang = range.getRange();
                   if (!languages.contains(lang)) {
                       languages.add(lang);
                   }
               }
           }
           return languages.stream().collect(Collectors.joining(", "));
       }

    }

    /**
     * Parse preferredLanguage represented as a single string to the list of language tags
     * This function always returns a list.
     * @param preferredLanguage
     * @return
     * @throws IllegalArgumentException
     */
    public static @NotNull List<String> getPreferredLanguages(@Nullable String preferredLanguage) throws IllegalArgumentException {
        if (Strings.isNullOrEmpty(preferredLanguage)) {
            return new ArrayList<>();
        } else {
            return Locale.LanguageRange.parse(preferredLanguage).stream()
                    .map(lang -> lang.getRange()).collect(Collectors.toList());
        }
    }

    /**
     * Resolve the given user preferredLanguage using
     * {@link LanguageHelper#getPreferredLanguages(String)} and adds those system
     * preferred languages which are not already provided.
     * 
     * @param preferredLanguage        an optional preferred language tag string
     * @param systemPreferredLanguages the list of system preferred language tags,
     *                                 with at least one item
     * 
     * @return a non-null list of language tags with at least one item
     */
    public static List<String> getPreferredLanguages(@Nullable String preferredLanguage,
            List<String> systemPreferredLanguages) {
        List<String> res = Lists.newArrayList();

        // resolve user provided preferred languages
        res.addAll(LanguageHelper.getPreferredLanguages(preferredLanguage));

        // add those system preferred languages that are not user-provided already
        systemPreferredLanguages.forEach(systemPreferredLanguage -> {
            if (!res.contains(systemPreferredLanguage)) {
                res.add(systemPreferredLanguage);
            }
        });

        return res;
    }

    /**
     * Parse preferredLanguage represented as a single string to the list of language tags and returns the first one
     * if exists otherwise return Optional.empty.
     * @param preferredLanguage
     * @return
     * @throws IllegalArgumentException
     */
    public static Optional<String> getPreferredLanguage(@Nullable String preferredLanguage) throws IllegalArgumentException {
        if (!Strings.isNullOrEmpty(preferredLanguage)) {
            List<String> preferredLanguages = getPreferredLanguages(preferredLanguage);
            if (CollectionUtils.isNotEmpty(preferredLanguages)) {
                return Optional.of(preferredLanguages.get(0));
            }
        }
        return Optional.empty();
    }

    /**
     * Check if the provided preferredLanguage string has valid format and
     * returns object which has isValid flag to indicate if the object is valid,
     * and nullable errorMessage string which contain the error message if the string is not valid
     * @param preferredLanguage
     * @return
     */
    public static LanguageValidationResults validatePreferredLanguage(@Nullable String preferredLanguage) {
        try {
            if (!Strings.isNullOrEmpty(preferredLanguage)) {
                Locale.LanguageRange.parse(preferredLanguage);
            }
            return new LanguageValidationResults(true, null);
        } catch (IllegalArgumentException e) {
            return new LanguageValidationResults(false, e.getMessage());
        }
    }

    public static class LanguageValidationResults {
        public final boolean isValid;
        public final String errorMessage;

        public LanguageValidationResults(boolean isValid, @Nullable String errorMessage) {
            this.isValid = isValid;
            this.errorMessage = errorMessage;
        }
    }
}
