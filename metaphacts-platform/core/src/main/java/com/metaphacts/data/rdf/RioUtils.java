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
package com.metaphacts.data.rdf;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.rio.ParserConfig;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFParseException;
import org.eclipse.rdf4j.rio.RDFWriter;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.rio.UnsupportedRDFormatException;
import org.eclipse.rdf4j.rio.helpers.BasicParserSettings;
import org.eclipse.rdf4j.rio.helpers.BasicWriterSettings;
import org.eclipse.rdf4j.rio.helpers.ParseErrorLogger;

import com.metaphacts.config.NamespaceRegistry;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@Singleton
public class RioUtils {

	@Inject
	private NamespaceRegistry ns;

	/**
	 * Namespaces aware RIO parser.
	 */
	public Model parse(InputStream io, String baseURI, RDFFormat dataFormat, Resource... contexts) throws RDFParseException, UnsupportedRDFormatException, IOException {
		ParserConfig config = new ParserConfig();
		config.set(BasicParserSettings.NAMESPACES, ns.getRioNamespaces());
		return Rio.parse(io, baseURI, dataFormat, config, SimpleValueFactory.getInstance(),
				new ParseErrorLogger(), contexts);
	}

    /**
     * Basic RIO writer
     */
    public void write(RDFFormat format, Model model, OutputStream out) {
        RDFWriter writer = Rio.createWriter(format, out);
        ns.getRioNamespaces().stream().forEach(model::setNamespace);
        writer.set(BasicWriterSettings.PRETTY_PRINT, true);
        Rio.write(model, writer);
    }
}
