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
package com.metaphacts.data.rdf.container;

import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.junit.Assert;
import org.junit.Test;

import com.metaphacts.api.dto.query.SelectQuery;
import com.metaphacts.api.dto.querytemplate.QueryArgument;
import com.metaphacts.api.dto.querytemplate.SelectQueryTemplate;
import com.metaphacts.api.rest.client.QueryCatalogAPIClientImpl;
import com.metaphacts.api.rest.client.QueryTemplateCatalogAPIClient;
import com.metaphacts.api.rest.client.QueryTemplateCatalogAPIClientImpl;

public class LocalLDPAPITest extends AbstractLDPTest {

    ValueFactory VF = SimpleValueFactory.getInstance();

    public LocalLDPAPITest() {
        // TODO Auto-generated constructor stub
    }

    protected void loadData() throws Exception {
        Repository repo = repositoryRule.getRepository();
        try (RepositoryConnection conn = repo.getConnection()) {
            conn.add(this.getClass().getResourceAsStream("testQueryTemplateContainer.trig"), "",
                    RDFFormat.TRIG);
        }
    }

    @Test
    public void testLoad() throws Exception {
        loadData();
        LocalLDPAPIClient ldpClient = new LocalLDPAPIClient(this.api,
                QueryContainer.IRI);
        QueryCatalogAPIClientImpl queryClient = new QueryCatalogAPIClientImpl(ldpClient);

        QueryTemplateCatalogAPIClient templateClient = new QueryTemplateCatalogAPIClientImpl(
                ldpClient, queryClient);

        SelectQueryTemplate template = templateClient.getSelectQueryTemplate(
                VF.createIRI("http://localhost:10214/container/queryTemplateContainer/test-query"));

        Assert.assertEquals(1, template.getArguments().size());
        QueryArgument arg = template.getArguments().iterator().next();
        Assert.assertEquals(VF.createIRI("http://metaphacts.com/query/test-query/arg/0"),
                arg.getId());
        Assert.assertEquals(VF.createIRI("http://www.w3.org/2001/XMLSchema#anyURI"),
                arg.getValueType());
        Assert.assertEquals("type", arg.getLabel());
        Assert.assertEquals("type", arg.getPredicate());

        SelectQuery sq = template.getQuery();
        Assert.assertEquals(
            "SELECT * WHERE {   ?x a ?type . }",
            sq.getQueryString()
                .replace("\r\n", " ")
                .replace('\n', ' ')
        );
    }
}
