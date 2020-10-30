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
package com.metaphacts.services.fields;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.junit.Before;
import org.junit.Test;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.AbstractIntegrationTest;

public class SimpleFieldDefinitionGeneratorChainTest extends AbstractIntegrationTest {

    private SimpleFieldDefinitionGeneratorChain subject;
    private FieldDefinitionGenerator generator1;
    private FieldDefinitionGenerator generator2;

    @Inject
    private Configuration config;

    @Inject
    private CacheManager cacheManager;

    @Before
    public void setUp() {
        generator1 = mock(FieldDefinitionGenerator.class);
        generator2 = mock(FieldDefinitionGenerator.class);

        subject = new SimpleFieldDefinitionGeneratorChain(Arrays.asList(generator1, generator2), cacheManager, config);
    }

    @Test
    public void testHandle() throws Exception {
        IRI field = FOAF.FAMILY_NAME;
        FieldDefinition expected = new FieldDefinition();
        when(generator1.generate(field)).thenReturn(Optional.empty());
        when(generator2.generate(field)).thenReturn(Optional.of(expected));
        
        assertEquals(expected, subject.handle(field).orElse(null));
        verify(generator1).generate(field);
        verify(generator2).generate(field);
    }

    @Test
    public void testHandleAll() throws Exception {
        List<IRI> fields = Arrays.asList(FOAF.FAMILY_NAME);
        
        Map<IRI, FieldDefinition> expected = new HashMap<IRI, FieldDefinition>();
        expected.put(fields.get(0), new FieldDefinition());
        
        when(generator1.generateAll(fields)).thenReturn(expected);
        when(generator2.generateAll(fields)).thenReturn(Collections.emptyMap());

        assertEquals(expected, subject.handleAll(fields));
        verify(generator1).generateAll(fields);
        verify(generator2).generateAll(fields);
    }

}
