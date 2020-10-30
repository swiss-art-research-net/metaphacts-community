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

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;

/**
 * @author jt
 *
 */
public class ModelUtils {
    public static IRI getNotNullSubjectIRI(Model model, IRI pred, Value obj, Resource... contexts) throws ModelException{
        return Models.subjectIRI(model.filter(null, pred, obj, contexts))
                .orElseThrow(
                () -> new ModelException("Subject of { ?subject " +  pred + " " + obj + " } is not an IRI or is null."));
    }
    
    public static Resource getNotNullSubjectResource(Model model, IRI pred, Value obj, Resource... contexts) throws ModelException{
        return Models.subject(model.filter(null, pred, obj, contexts))
                .orElseThrow(
                () -> new ModelException("Subject of { ?subject " +  pred + " " + obj + " } is not a resource or is null."));
    }
    
    public static IRI getNotNullObjectIRI(Model model, Resource subj, IRI pred, Resource... contexts) throws ModelException{
        return Models.objectIRI(model.filter(subj, pred, null, contexts))
                .orElseThrow(
                () -> new ModelException("Object of { "+subj+" "+pred +" ?object } is not an IRI or is null."));
    }
    
    public static Resource getNotNullObjectResource(Model model, Resource subj, IRI pred, Resource... contexts) throws ModelException{
        return Models.objectResource(model.filter(subj, pred, null, contexts))
                .orElseThrow(
                () -> new ModelException("Object of { "+subj+" "+pred +" ?object } is not a resource or is null."));
    }

    public static Literal getNotNullObjectLiteral(Model model, Resource subj, IRI pred, Resource... contexts) throws ModelException{
        return Models.objectLiteral(model.filter(subj, pred, null, contexts)).orElseThrow(
                () -> new ModelException("Object of { "+subj+" "+pred +" ?object } is not an Literal or is null."));
    }


}