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
package com.metaphacts.data.rdf;

import java.io.OutputStream;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFWriter;
import org.eclipse.rdf4j.rio.RDFWriterFactory;
import org.eclipse.rdf4j.rio.helpers.JSONLDSettings;
import org.eclipse.rdf4j.rio.jsonld.JSONLDWriter;

public class HierarchicalJSONLDWriterFactory implements RDFWriterFactory {
    public static final String MIMETYPE_LD_JSON_HIERARCHICAL = "application/vnd.ld+json+hierarchical";
    /**
     * The <a href="http://www.w3.org/TR/json-ld/">JSON-LD</a> file format, an RDF serialization format that supports
     * recording of named graphs.
     * <p>
     * The file extension <code>.jsonld</code> is recommended for JSON-LD documents. The media type is
     * <code>application/ld+json</code> and the encoding is UTF-8.
     * </p>
     *
     * @see <a href="http://www.w3.org/TR/json-ld/">JSON-LD 1.0</a>
     */
    public static final RDFFormat JSONLD_HIERARCHICAL = new RDFFormat("JSON-LD-HIERARCHICAL", Arrays.asList(MIMETYPE_LD_JSON_HIERARCHICAL),
            StandardCharsets.UTF_8, Arrays.asList("jsonld"),
            SimpleValueFactory.getInstance().createIRI("http://www.w3.org/ns/formats/JSON-LD"), RDFFormat.SUPPORTS_NAMESPACES,
            RDFFormat.SUPPORTS_CONTEXTS);

    @Override
    public RDFFormat getRDFFormat() {
        return JSONLD_HIERARCHICAL;
    }
    
    @Override
    public RDFWriter getWriter(OutputStream out) {
        return configure(new JSONLDWriter(out));
    }

    @Override
    public RDFWriter getWriter(OutputStream out, String baseURI) {
        return configure(new JSONLDWriter(out, baseURI));
    }

    @Override
    public RDFWriter getWriter(Writer writer) {
        return configure(new JSONLDWriter(writer));
    }

    @Override
    public RDFWriter getWriter(Writer writer, String baseURI) {
        return configure(new JSONLDWriter(writer, baseURI));
    }

    protected JSONLDWriter configure(JSONLDWriter writer) {
        writer.getWriterConfig().set(JSONLDSettings.HIERARCHICAL_VIEW, true);
        return writer;
    }
}