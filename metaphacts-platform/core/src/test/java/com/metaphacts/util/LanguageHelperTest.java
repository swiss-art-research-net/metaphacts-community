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

import com.google.common.collect.Lists;
import org.junit.Assert;
import org.junit.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class LanguageHelperTest {
    private static final String LANGUAGE_TAG_EN = "en";
    private static final String LANGUAGE_TAG_DE = "de";
    private static final String LANGUAGE_TAG_RU = "ru";
    private static final String MULTIPLE_PREFERRED_LANGUAGE_TAGS = "en, de, ru";
    private static final String MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED = "en;q=0.5, de, ru;q=0.9";
    private static final String MULTIPLE_PREFERRED_LANGUAGE_TAGS_1 = "en-us, de-ch, ru";
    private static final String MULTIPLE_PREFERRED_LANGUAGE_TAGS_2 = "it, fr, jp";
    private static final String MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED_2 = "it;q=0.5, fr, jp;q=0.9";
    private static final String INCORRECT_PREFERRED_LANGUAGE_TAGS = "....#?!....";

    @Test
    public void mergePreferredLanguagesTest() throws Exception {
        String result0 = LanguageHelper.mergePreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS);
        assertTrue(MULTIPLE_PREFERRED_LANGUAGE_TAGS == result0); // it should be the same object
        String result1 = LanguageHelper.mergePreferredLanguages(LANGUAGE_TAG_EN, LANGUAGE_TAG_DE, LANGUAGE_TAG_RU);
        assertEquals(MULTIPLE_PREFERRED_LANGUAGE_TAGS, result1);
        String result2 = LanguageHelper.mergePreferredLanguages(LANGUAGE_TAG_DE, LANGUAGE_TAG_RU, LANGUAGE_TAG_EN);
        assertEquals("de, ru, en", result2);
        String result3 = LanguageHelper.mergePreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS, MULTIPLE_PREFERRED_LANGUAGE_TAGS_2);
        assertEquals("en, de, ru, it, fr, jp", result3);
        String result4 = LanguageHelper.mergePreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED, MULTIPLE_PREFERRED_LANGUAGE_TAGS_2);
        assertEquals("de, ru, en, it, fr, jp", result4);
        String result5 = LanguageHelper.mergePreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED, MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED_2);
        assertEquals("de, ru, en, fr, jp, it", result5);
        String result6 = LanguageHelper.mergePreferredLanguages(result4, result5);
        assertEquals(result4, result6);
        String result7 = LanguageHelper.mergePreferredLanguages(null, null, "", null, LANGUAGE_TAG_EN, "");
        assertEquals(LANGUAGE_TAG_EN, result7);
        String result8 = LanguageHelper.mergePreferredLanguages(null, LANGUAGE_TAG_EN, "", null, LANGUAGE_TAG_DE, "");
        assertEquals("en, de", result8);

        Assert.assertThrows(IllegalArgumentException.class,
            () -> LanguageHelper.mergePreferredLanguages(INCORRECT_PREFERRED_LANGUAGE_TAGS, LANGUAGE_TAG_EN));

        // Function doesn't validate the single string and return it as is
        String result9 = LanguageHelper.mergePreferredLanguages(INCORRECT_PREFERRED_LANGUAGE_TAGS);
        assertEquals(INCORRECT_PREFERRED_LANGUAGE_TAGS, result9);

        String result10 = LanguageHelper.mergePreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS, MULTIPLE_PREFERRED_LANGUAGE_TAGS_1);
        assertEquals("en, de, ru, en-us, de-ch", result10);
    }

    @Test
    public void getPreferredLanguagesTest() throws Exception {
        assertEquals(0, LanguageHelper.getPreferredLanguages(null).size());
        assertEquals(0, LanguageHelper.getPreferredLanguages("").size());

        List<String> preferredLanguages = LanguageHelper.getPreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS);
        Assert.assertNotEquals(0, preferredLanguages.size());
        assertEquals(LANGUAGE_TAG_EN, preferredLanguages.get(0));
        assertEquals(LANGUAGE_TAG_DE, preferredLanguages.get(1));
        assertEquals(LANGUAGE_TAG_RU, preferredLanguages.get(2));
        Assert.assertEquals(Lists.newArrayList("en", "de", "ru"), preferredLanguages);

        List<String> preferredLanguagesWeighted = LanguageHelper.getPreferredLanguages(MULTIPLE_PREFERRED_LANGUAGE_TAGS_WEIGHTED);
        Assert.assertNotEquals(0, preferredLanguagesWeighted.size());
        Assert.assertEquals(Lists.newArrayList("de", "ru", "en"), preferredLanguagesWeighted);

        Assert.assertThrows(IllegalArgumentException.class,
            () -> LanguageHelper.getPreferredLanguages(INCORRECT_PREFERRED_LANGUAGE_TAGS));
    }

    @Test
    public void getPreferredLanguageTest() throws Exception {
        assertEquals(false, LanguageHelper.getPreferredLanguage(null).isPresent());
        assertEquals(false, LanguageHelper.getPreferredLanguage("").isPresent());
        Optional<String> preferredLanguage = LanguageHelper.getPreferredLanguage(MULTIPLE_PREFERRED_LANGUAGE_TAGS);
        assertEquals(true, preferredLanguage.isPresent());
        assertEquals(LANGUAGE_TAG_EN, preferredLanguage.get());
        Assert.assertThrows(IllegalArgumentException.class,
            () -> LanguageHelper.getPreferredLanguage(INCORRECT_PREFERRED_LANGUAGE_TAGS));
    }
}
