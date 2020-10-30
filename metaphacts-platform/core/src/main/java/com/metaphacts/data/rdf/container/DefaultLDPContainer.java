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


import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.google.common.base.Throwables;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.vocabulary.LDP;


/**
 * Default implementation of a {@link LDPContainer} i.e. if no custom
 * implementation is provided.
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class DefaultLDPContainer extends AbstractLDPContainer {

    
    public DefaultLDPContainer(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }

    /**
     * TODO see {@link VisibilityContainer}, {@link SetContainer} and {@link ClipboardRootContainer}
     * @param setItem
     * @param connectingPredicate
     * @param checkForUserIdentity
     * @return
     */
    protected IRI checkForExistingItem(IRI setItem, IRI connectingPredicate, boolean checkForUserIdentity){

        String query="SELECT ?node WHERE{"
                    + "?container <http://www.w3.org/ns/ldp#contains> ?node."
                    + (checkForUserIdentity ? "?node <http://www.w3.org/ns/prov#wasAttributedTo> ?useruri." : "")
                    + "?node ?connectingPredicate ?setItem."
                + "}";
        TupleQuery tq=null;
        try (RepositoryConnection con = getConnection()) {
            tq = con.prepareTupleQuery(QueryLanguage.SPARQL, query);
            tq.setBinding("container", this.getResourceIRI());
            tq.setBinding("setItem", setItem);
            if(checkForUserIdentity)tq.setBinding("useruri", ns.getUserIRI());
            tq.setBinding("connectingPredicate", connectingPredicate);
           
            TupleQueryResult result = tq.evaluate();
            while (result.hasNext()) {
                BindingSet next = result.next();
                return (IRI) next.getBinding("node").getValue();
            }
            return null;

        } catch (NullPointerException e) {
            return null;
        } catch (Exception e) {
            throw Throwables.propagate(e);
        }
    }
    
    @Override
    public IRI getResourceType() {
        return LDP.Resource;
    }
}