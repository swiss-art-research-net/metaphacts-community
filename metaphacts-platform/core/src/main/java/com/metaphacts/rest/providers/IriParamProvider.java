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
package com.metaphacts.rest.providers;

import java.lang.annotation.Annotation;
import java.lang.reflect.Type;

import javax.inject.Singleton;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ParamConverter;
import javax.ws.rs.ext.ParamConverterProvider;

import org.eclipse.rdf4j.common.net.ParsedIRI;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;


/**
 * JAX-RS {@link ParamConverterProvider} for {@link String} -> {@link IRI}
 * conversion.
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Singleton
public class IriParamProvider implements ParamConverterProvider {
    private final ValueFactory vf = SimpleValueFactory.getInstance();
    @Override
    public <T> ParamConverter<T> getConverter(final Class<T> rawType,
            Type genericType, final Annotation[] annotations) {
        if (rawType.equals(IRI.class)) {
            return new ParamConverter<T>() {
                @Override
                public T fromString(final String value) {
                    if(value == null){
                        return null;
                    }
                    try {
                        boolean isAbsoluteIri = ParsedIRI.create(value).isAbsolute();
                        if (!isAbsoluteIri) {
                            throw new IllegalArgumentException("IRI \"" + value +"\" is not an absolute IRI.");
                        }
                        // value has been already URL-decoded by jersey
                        IRI uri = vf.createIRI(value);
                        return rawType.cast(uri);
                    } catch (final IllegalArgumentException ex) {
                        throw new WebApplicationException(getErrorResponse(ex));
                    }
                }
    
                @Override
                public String toString(final T value)
                        throws IllegalArgumentException {
                    
                    return value !=null ? value.toString() : null;
                }

                protected Response getErrorResponse(IllegalArgumentException ex) {
                    return Response
                        .status(400)
                        .entity(ex.getMessage())
                        .type(MediaType.TEXT_PLAIN)
                        .build();
                }
            };
        }
        return null;
    }
}