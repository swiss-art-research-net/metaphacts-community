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
package com.metaphacts.rest.feature;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

import javax.ws.rs.GET;
import javax.ws.rs.NameBinding;
import javax.ws.rs.POST;

/**
 * Annotations for cach control header injection.
 * @see CacheControlFeature
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class CacheControl {

    /**
     * Annotation to inject cache control header values into any HTTP response header generated by
     * any {@link GET} or {@link POST} jersey methods. Value must a valid cache control header
     * according to the <a href="https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9"
     * >W3 standard</a> i.e. no further validation will be applied when injecting the value into the
     * header.
     */
    @NameBinding
    @Target({ElementType.METHOD, ElementType.TYPE })
    @Retention(RetentionPolicy.RUNTIME)
    public static @interface Cache {
        /**
         * @return String value that will be used in the "Cache-Control" header field of the
         *         response. Must be a valid value according to the standard i.e. compare <a
         *         href="https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9"
         *         >https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9</a>
         */
        String value();
    }

    /**
     * Annotation to inject "Cache-Control" header with static value
     * "max-age=0, no-cache, no-store, must-revalidate" into any HTTP response header generated by
     * any {@link GET} or {@link POST} jersey methods.
     */
    @NameBinding
    @Target({ElementType.METHOD, ElementType.TYPE })
    @Retention(RetentionPolicy.RUNTIME)
    public static @interface NoCache {
    }

    /**
     * Annotation to inject max-age cache control header value into any HTTP response header
     * generated by any {@link GET} or {@link POST} jersey methods. Similar to {@link Cache}
     * annotation, however, provides more abstraction i.e. the given {@link MaxAgeCache#value()}
     * will be automatically converted to a valid max-age string according to the specified
     * {@link MaxAgeCache#unit()}.
     */
    @NameBinding
    @Target({ElementType.METHOD, ElementType.TYPE })
    @Retention(RetentionPolicy.RUNTIME)
    public static @interface MaxAgeCache {
        /**
         * @return The time value.
         */
        long time() default 1;
        /**
         * @return The unit of the numerical time value. Default: {@link TimeUnit#MINUTES}
         */
        TimeUnit unit() default TimeUnit.MINUTES;
    }

}