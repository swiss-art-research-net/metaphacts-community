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
package com.metaphacts.data.json;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.function.BiConsumer;

import javax.ws.rs.core.StreamingOutput;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.google.common.base.Throwables;

/**
 * @author Aretm Kozlov <ak@metaphacts.com>
 */
public class JsonUtil {

    private static final ObjectMapper mapper = new ObjectMapper();
    static {
        SimpleModule module = new SimpleModule();
        module.addSerializer(Resource.class, new RdfValueSerializers.ResourceSerializer());
        module.addSerializer(IRI.class, new RdfValueSerializers.IriSerializer());
        mapper.registerModule(module);
    }

    public static <T> String toJson(T obj) throws RuntimeException {
        String json = null;
        try {
            json = JsonUtil.mapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            Throwables.propagate(e);
        }
        return json;
    }

    public static <T> String prettyPrintJson(T obj) throws RuntimeException {
        String json = null;
        try {
            json = JsonUtil.mapper.writerWithDefaultPrettyPrinter().writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            Throwables.propagate(e);
        }
        return json;
    }

    public static ObjectMapper getDefaultObjectMapper() {
        return mapper;
    }

    @FunctionalInterface
    public static interface JsonFieldProducer extends BiConsumer<JsonGenerator, String> {}

    /**
     * Utility that helps to map over JSON Array in a streaming fashion,
     * apply some function for every value,
     * and produce JSON object where initial value will be used as a key and produced one as a value.
     */
    public static StreamingOutput processJsonMap(
        final JsonParser jp, final JsonFieldProducer fn
    ) throws IOException {
        return new StreamingOutput() {
            @Override
            public void write(OutputStream os) throws IOException {
                JsonFactory jfactory = new JsonFactory();
                try (JsonGenerator jGenerator = jfactory.createGenerator(os)) {
                    jGenerator.writeStartObject();
                    while (jp.nextToken() != JsonToken.END_ARRAY) {
                        String iriString = jp.getText();
                        fn.accept(jGenerator, iriString);
                    }
                    jGenerator.writeEndObject();
                }
            }
        };
    }

    public static Iterable<Map.Entry<String, JsonNode>> iterate(ObjectNode node) {
        return node::fields;
    }

    public static Iterable<JsonNode> iterate(ArrayNode node) {
        return node::elements;
    }

    public static ObjectNode toObjectNode(JsonNode node) {
        return shallowMerge(node, NullNode.getInstance());
    }

    public static ObjectNode shallowMerge(JsonNode first, JsonNode second) {
        if (first instanceof ObjectNode && second instanceof ObjectNode) {
            ObjectNode result = mapper.createObjectNode();
            assign(result, first);
            assign(result, second);
            return result;
        } else if (first instanceof ObjectNode) {
            return (ObjectNode)first;
        } else if (second instanceof ObjectNode) {
            return (ObjectNode)second;
        } else {
            return mapper.createObjectNode();
        }
    }

    public static void assign(ObjectNode target, JsonNode source) {
        if (source instanceof ObjectNode) {
            target.setAll((ObjectNode)source);
        }
    }
}
