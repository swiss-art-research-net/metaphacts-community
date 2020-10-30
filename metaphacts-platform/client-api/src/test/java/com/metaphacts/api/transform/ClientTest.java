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
package com.metaphacts.api.transform;

import com.metaphacts.api.dto.queryform.QueryFormConfiguration;
import com.metaphacts.api.dto.queryform.QueryFormElement;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;
import com.metaphacts.api.rest.client.APICallFailedException;
import com.metaphacts.api.rest.client.APIInitializationException;
import com.metaphacts.api.rest.client.PlatformRestClient;

public class ClientTest {

    public static void main(String[] args) throws APIInitializationException, APICallFailedException {
        PlatformRestClient client = new PlatformRestClient("http://127.0.0.1:8888/", null, null);

       for(QueryFormConfiguration<QueryTemplate<?>> f :client.getQueryFormCatalogAPI().getFormConfigurations()){
           System.out.println(f.getLabel());
           System.out.println(f.getDescription());
           System.out.println(f.getQueryTemplate().getQuery().getQueryString());
           for(QueryFormElement e : f.getQueryFormElements()){
               System.out.println(e.getLabel());
               System.out.println(e.getDescription());
               System.out.println(e.getSuggestionQueryId());
               if(e.getSuggestionQueryId()!=null)System.out.println(client.getQueryCatalogAPI().getSelectQuery(e.getSuggestionQueryId()));
           }
       }
    }
}
