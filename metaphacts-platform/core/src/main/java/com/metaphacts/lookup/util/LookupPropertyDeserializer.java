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
package com.metaphacts.lookup.util;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.metaphacts.lookup.model.LookupDataProperty;
import com.metaphacts.lookup.model.LookupObjectProperty;
import com.metaphacts.lookup.model.LookupProperty;

import java.io.IOException;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;

public class LookupPropertyDeserializer extends StdDeserializer<List<LookupProperty<?>>> {
    private static final long serialVersionUID = 1L;

    public LookupPropertyDeserializer() {
        this(null);
    }
    public LookupPropertyDeserializer(Class<List<LookupProperty<?>>> t) {
        super(t);
    }

    @Override
    public List<LookupProperty<?>> deserialize(
        JsonParser jp,
        DeserializationContext context
    ) throws IOException {
        List<LookupProperty<?>> list = new LinkedList<>();

        Object jsonObject = jp.readValueAsTree();
        if (jsonObject != null) {
            String value = jsonObject.toString();
            ObjectMapper mapper = new ObjectMapper();
            JsonNode properties = mapper.readTree(value);
            for (Iterator<JsonNode> it = properties.elements(); it.hasNext(); ) {
                JsonNode property = it.next();
                if (property.get("v") != null && property.get("v").isObject()) {
                    list.add(
                        mapper.readValue(property.toString(), LookupObjectProperty.class)
                    );
                } else {
                    list.add(
                        mapper.readValue(property.toString(), LookupDataProperty.class)
                    );
                }
            }
        }

        return list;
    }
}


