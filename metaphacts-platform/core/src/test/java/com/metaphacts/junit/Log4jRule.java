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
package com.metaphacts.junit;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.layout.PatternLayout;
import org.apache.logging.log4j.util.ReadOnlyStringMap;
import org.junit.rules.ExternalResource;

import com.google.common.collect.Lists;

/**
 * Rule for configuring the Log4J backend from tests
 * 
 * @author Andreas Schwarte
 */
public class Log4jRule extends ExternalResource {

    public static Log4jRule create() {
        return create(Level.INFO);
    }

    public static Log4jRule create(Level level) {
        return new Log4jRule(level);
    }


    private final Level level;

    private Log4jRule(Level level) {
        this.level = level;
    }

    @Override
    protected void before() throws Throwable {

        Configurator.reconfigure(Log4jRule.class.getResource("/com/metaphacts/junit/log4j2-test.xml").toURI());
        setLogLevel("com.metaphacts", this.level);
    }

    @Override
    protected void after() {
        // reset to initial configuration
        Configurator.reconfigure();
    }

    public void setLogLevel(String loggerName, Level loggerLevel) {
        Configurator.setAllLevels(loggerName, loggerLevel);
    }

    public void setLogLevel(Class<?> clazz, Level loggerLevel) {
        Configurator.setAllLevels(clazz.getName(), loggerLevel);
    }

    public RecordedLog startRecording(String loggerName) {
        return startRecording(loggerName, null);
    }

    public RecordedLog startRecording(Class<?> loggerClass, PatternLayout layout) {
        return startRecording(loggerClass.getCanonicalName(), layout);
    }

    /**
     * Retrieve recorded log messages for the given logger
     * <p>
     * Usage example:
     * </p>
     * 
     * <pre>
     * try (RecordedLog log = log4j.startRecording(MDCTestEndpoint.class, layout)) {
     *      // do something ...
     *      Assert.assertThat(log.getMessages(), THE_CHECK_HERE)
     * }
     * </pre>
     * 
     * @param loggerName
     * @param layout
     * @return
     */
    public RecordedLog startRecording(String loggerName, PatternLayout layout) {

        if (layout == null) {
            layout = PatternLayout.createDefaultLayout();
        }

        RecordLogAppender appender = new RecordLogAppender(loggerName);
        org.apache.logging.log4j.core.Logger classLogger = (org.apache.logging.log4j.core.Logger) LogManager
                .getLogger(loggerName);
        classLogger.addAppender(appender);
        appender.start();
        return new RecordedLog() {

            @Override
            public void close() throws Exception {
                appender.stop();
                classLogger.removeAppender(appender);
            }

            @Override
            public List<String> getMessages() {
                return appender.messages.stream().map(m -> m.message).collect(Collectors.toList());
            }

            @Override
            public List<MessageWithContext> getMessagesWithContext() {
                return appender.messages;
            }
        };
    }

    public static abstract class RecordedLog implements AutoCloseable {

        public abstract List<String> getMessages();

        public abstract List<MessageWithContext> getMessagesWithContext();

        public ReadOnlyStringMap getMessageContext(String message) {
            Optional<MessageWithContext> res = getMessagesWithContext().stream().filter(m -> m.message.equals(message))
                    .findFirst();
            return res.isPresent() ? res.get().context : null;
        }
    }

    private static class RecordLogAppender extends AbstractAppender {

        // maps the message to the log context informations
        private final List<MessageWithContext> messages = Lists.newArrayList();

        protected RecordLogAppender(String loggerName) {
            this(loggerName, PatternLayout.createDefaultLayout());
        }

        protected RecordLogAppender(String loggerName, PatternLayout layout) {
            super(loggerName + "_Appender", null, layout, true, Property.EMPTY_ARRAY);
        }

        @Override
        public void append(LogEvent event) {
            messages.add(new MessageWithContext(event.getMessage().getFormattedMessage(), event.getContextData()));
        }
    }

    public static class MessageWithContext {
        public final String message;
        public final ReadOnlyStringMap context;

        private MessageWithContext(String message, ReadOnlyStringMap context) {
            super();
            this.message = message;
            this.context = context;
        }
    }
}
