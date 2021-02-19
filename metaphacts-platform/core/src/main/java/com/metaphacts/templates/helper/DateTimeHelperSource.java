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

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

import javax.annotation.Nullable;
import javax.validation.constraints.NotNull;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.github.jknack.handlebars.Options;
import com.metaphacts.resource.HandlebarsDescriptionRenderer;
import com.metaphacts.templates.MetaphactsHandlebars;

/**
 * Helpers for date time handling and formatting.
 * 
 * <p>
 * These helpers are used in backend templating, e.g. from
 * {@link MetaphactsHandlebars} and {@link HandlebarsDescriptionRenderer}.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 * @author Olga Belyaeva <ob@metaphacts.com>
 */
public class DateTimeHelperSource {
    private static final Logger logger = LogManager.getLogger(DateTimeHelperSource.class);

    /**
     * Timestamp format string to parse/render date time values in the format used
     * for xsd:dateTime
     */
    public final static String ISO_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ssX";
    public final static String ISO_DATE_FORMAT = "yyyy-MM-dd";
    public final static String OUTPUT_FORMAT = "yyyy-MM-dd HH:mm:ss X";

    /**
     * Helper to render a timestamp using the provided format string.
     * 
     * <p>
     * General usage: <code>{{dateTimeFormat timestamp format sourceFormat}}</code>
     * </p>
     * <ul>
     * <li><code>timestamp</code>. variable (or value) containing a timestamp.
     * Unless otherwise defined, this should follow the ISO formats for either
     * <code>xsd:dateTime</code> or <code>xsd:date</code>. The format of this
     * variable can be overridden using the parameter <code>sourceFormat</code></li>
     * <li><code>format</code>: target format string for the formatted timestamp
     * (optional). If not provided a default value of {@value #OUTPUT_FORMAT} is
     * used</li>
     * <li><code>sourceFormat</code>: source format string for the timestamp
     * (optional). If not provided a default value of {@value #ISO_DATETIME_FORMAT}
     * or {@value #ISO_DATE_FORMAT} is used</li>
     * </ul>
     * 
     * <p>
     * Examples:
     * </p>
     * <p>
     * Render provided timestamp using German conventions:<br>
     * <code>{{dateTimeFormat timestamp "dd.MM.yyyy HH:mm:ss"}}</code>
     * </p>
     * <p>
     * Render provided timestamp using German conventions, parse the timestamp using
     * the provided format (last parameter):<br>
     * <code>{{dateTimeFormat timestamp "dd.MM.yyyy HH:mm:ss" "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * </p>
     * <p>
     * Render provided timestamp using default format as defined in
     * {@value #OUTPUT_FORMAT}:<br>
     * <code>{{dateTimeFormat timestamp}}</code>
     * </p>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  additional parameters
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     * @see See <a href=
     *      "https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/text/SimpleDateFormat.html">Format
     *      String for Date and Time Patterns </a> (class {@link SimpleDateFormat})
     *      for a description of date and time formatting symbols
     */
    public static CharSequence dateTimeFormat(String dateTime, Options options) {
        String outputFormat = options.param(0, OUTPUT_FORMAT);
        String sourceFormat = options.param(1, null);

        try {
            Date timestamp = tryParseTimestamp(dateTime, sourceFormat);
            return formatTimestamp(outputFormat, timestamp);
        } catch (Exception e) {
            logger.debug("Failed to render timestamp {} using sourceFormat {} to format {}: {}", dateTime, sourceFormat,
                    outputFormat, e.getMessage());
            logger.trace("Details: ", e);
            // replace with empty result
            return null;
        }
    }

    /**
     * Helper to render the year of a timestamp:<br>
     * <code>{{year timestamp}}</code> or
     * <code>{{year timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence year(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "yyyy");
    }

    /**
     * Helper to render the month of a timestamp:<br>
     * <code>{{month timestamp}}</code> or
     * <code>{{month timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence month(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "MM");
    }

    /**
     * Helper to render the day of a timestamp:<br>
     * <code>{{day timestamp}}</code> or
     * <code>{{day timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence day(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "dd");
    }

    /**
     * Helper to render the hours of a timestamp:<br>
     * <code>{{hours timestamp}}</code> or
     * <code>{{hours timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence hours(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "HH");
    }

    /**
     * Helper to render the minutes of a timestamp:<br>
     * <code>{{minutes timestamp}}</code> or
     * <code>{{minutes timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence minutes(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "mm");
    }

    /**
     * Helper to render the seconds of a timestamp:<br>
     * <code>{{seconds timestamp}}</code> or
     * <code>{{seconds timestamp "yyyy-MM-dd'T'HH:mm:ss"}}</code>
     * 
     * @param dateTime timestamp as obtained e.g. from a RDF literal of type
     *                 <code>xsd:date</code> or <code>xsd:dateTime</code>
     * @param options  optional argument to specify the source format of the
     *                 timestamp, i.e. how to parse it into a {@link Date}
     * @return formatted timestamp or an empty string id there was a parsing or
     *         formatting error
     */
    public static CharSequence seconds(String dateTime, Options options) {
        return parseAndFormatTimestamp(dateTime, options, "ss");
    }

    protected static CharSequence formatTimestamp(@NotNull String format, Date timestamp) {
        SimpleDateFormat formatter = new SimpleDateFormat(format);
        return formatter.format(timestamp);
    }

    protected static Date tryParseTimestamp(@NotNull String dateTime, @Nullable String sourceFormat) {
        if (sourceFormat == null) {
            // no format specified, try typical formats for xsd:dateTime and xsd:date
            try {
                return parseTimestamp(dateTime, ISO_DATETIME_FORMAT);
            } catch (Exception e) {
                return parseTimestamp(dateTime, ISO_DATE_FORMAT);
            }
        } else {
            return parseTimestamp(dateTime, sourceFormat);
        }
    }

    protected static Date parseTimestamp(@NotNull String dateTime, @NotNull String sourceFormat) {
        SimpleDateFormat parser = new SimpleDateFormat(sourceFormat);
        try {
            return parser.parse(dateTime);
        } catch (ParseException e) {
            String msg = String.format("Failed to parse timestamp '%1$s' using format '%2$s' : %2$s", dateTime,
                    sourceFormat, e.getMessage());
            logger.debug(msg);
            logger.trace("Details: ", e);
            throw new RuntimeException(msg);
        }
    }

    protected static CharSequence parseAndFormatTimestamp(String dateTime, Options options, String outputFormat) {
        String sourceFormat = options.param(0, null);

        try {
            Date timestamp = tryParseTimestamp(dateTime, sourceFormat);
            return formatTimestamp(outputFormat, timestamp);
        } catch (Exception e) {
            logger.debug("Failed to render timestamp {} using sourceFormat {} to format {}: {}", dateTime, sourceFormat,
                    outputFormat, e.getMessage());
            logger.trace("Details: ", e);
            // replace with empty result
            return null;
        }
    }

    /**
     * Returns the current system time. Default format is "dd.MM.yyyy HH:mm:ss.SSS".
     * <p>Example:</p>
     * <pre><code>
     * [[currentDateTime]]
     * [[currentDateTime format="MM-dd-yyyy"]]
     * </code></pre>
     */
    public String currentDateTime(Options options) {
        String format = options.hash("format", "dd.MM.yyyy HH:mm:ss.SSS");
        SimpleDateFormat dateFormat = new SimpleDateFormat(format);
        Date date = new Date();
        return dateFormat.format(date);
    }
}
