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
package com.metaphacts.templates.helper;

import static org.junit.Assert.assertEquals;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;

public class DateTimeHelperSourceTest {
    @Test
    public void testDateTimeFormat() throws Exception {
        Date now = new Date();
        String targetFormat = "yyyy.MM.dd G 'at' HH:mm:ss";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-format timestamp targetFormat}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testDateTimeFormat_SourceFormat() throws Exception {
        Date now = new Date();
        String targetFormat = "yyyy.MM.dd G 'at' HH:mm:ss";
        String sourceFormat = "dd.MM.yyyy HH-mm-ss";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-format timestamp targetFormat sourceFormat}}", now, targetFormat,
                sourceFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testDateTimeFormat_InvalidTimestamp() throws Exception {
        String timestampString = "5. Mai 2020";
        String targetFormat = "yyyy.MM.dd G 'at' HH:mm:ss";
        // as the timestamp cannot be parsed we expect an empty string
        String expected = "";

        String output = applyTemplate("{{date-format timestamp targetFormat}}", timestampString, targetFormat,
                DateTimeHelperSource.ISO_DATETIME_FORMAT);
        assertEquals(expected, output);
    }

    @Test
    public void testYear() throws Exception {
        Date now = new Date();
        String targetFormat = "yyyy";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatYear timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testYear_InvalidTimestamp() throws Exception {
        String timestampString = "5. Mai 2020";
        String targetFormat = "yyyy";
        // as the timestamp cannot be parsed we expect an empty string
        String expected = "";

        String output = applyTemplate("{{date-formatYear timestamp}}", timestampString, targetFormat,
                DateTimeHelperSource.ISO_DATETIME_FORMAT);
        assertEquals(expected, output);
    }

    @Test
    public void testYear_SourceFormat() throws Exception {
        Date now = new Date();
        String targetFormat = "yyyy";
        String sourceFormat = "dd.MM.yyyy HH-mm-ss";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatYear timestamp sourceFormat}}", now, targetFormat, sourceFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testMonth() throws Exception {
        Date now = new Date();
        String targetFormat = "MM";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatMonth timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testDay() throws Exception {
        Date now = new Date();
        String targetFormat = "dd";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatDay timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testHours() throws Exception {
        Date now = new Date();
        String targetFormat = "HH";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatHour timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testMinutes() throws Exception {
        Date now = new Date();
        String targetFormat = "mm";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatMinute timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    @Test
    public void testSeconds() throws Exception {
        Date now = new Date();
        String targetFormat = "ss";
        String expected = new SimpleDateFormat(targetFormat).format(now);

        String output = applyTemplate("{{date-formatSecond timestamp}}", now, targetFormat);
        assertEquals(expected, output);
    }

    protected String applyTemplate(String templateText, Date now, String targetFormat) throws IOException {
        return applyTemplate(templateText, now, targetFormat, DateTimeHelperSource.ISO_DATETIME_FORMAT);
    }

    protected String applyTemplate(String templateText, Date timestamp, String targetFormat, String sourceFormat)
            throws IOException {
        String timestampString = new SimpleDateFormat(sourceFormat).format(timestamp);
        return applyTemplate(templateText, timestampString, targetFormat, sourceFormat);
    }

    protected String applyTemplate(String templateText, String timestampString, String targetFormat,
            String sourceFormat)
            throws IOException {
        Handlebars handlebars = new Handlebars();
        DateTimeHelperSource.getHelpers().entrySet().forEach(entry ->
            handlebars.registerHelper(entry.getKey(), entry.getValue()));
        Template template = handlebars.compileInline(templateText);
        Map<String, Object> model = new HashMap<String, Object>();

        model.put("timestamp", timestampString);
        model.put("targetFormat", targetFormat);
        model.put("sourceFormat", sourceFormat);
        Object context = Context.newBuilder(model).build();
        return template.apply(context);
    }

}
