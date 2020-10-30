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
package com.metaphacts.rest.providers;

import java.lang.annotation.Annotation;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.ext.ParamConverter;
import javax.ws.rs.ext.ParamConverterProvider;

import org.glassfish.hk2.api.ServiceLocator;
import org.glassfish.jersey.internal.inject.Providers;
import org.glassfish.jersey.internal.util.ReflectionHelper;
import org.glassfish.jersey.internal.util.collection.ClassTypePair;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@Singleton
public class OptionalParamProvider implements ParamConverterProvider {

    private final ServiceLocator locator;

    @Inject
    public OptionalParamProvider(final ServiceLocator locator) {
        this.locator = locator;
    }

    @Override
    public <T> ParamConverter<T> getConverter(final Class<T> rawType, final Type genericType,
            final Annotation[] annotations) {
        if (rawType == Optional.class) {
            final List<ClassTypePair> ctps = ReflectionHelper.getTypeArgumentAndClass(genericType);
            ClassTypePair ctp = (ctps.size() == 1) ? ctps.get(0) : null;
            final Set<ParamConverterProvider> converterProviders = Providers.getProviders(locator,
                    ParamConverterProvider.class);
            for (ParamConverterProvider provider : converterProviders) {
                final ParamConverter<?> converter = provider.getConverter(ctp.rawClass(),
                        ctp.type(), annotations);
                if (converter != null) {
                    return new ParamConverter<T>() {
                        @Override
                        public T fromString(final String value) {
                            if (value == null) {
                                return rawType.cast(Optional.empty());
                            }
                            return rawType.cast(Optional.ofNullable(converter.fromString(value)));
                        }

                        @Override
                        public String toString(final T value) throws IllegalArgumentException {
                            return value.toString();
                        }
                    };
                }
            }
        }

        return null;
    }
}