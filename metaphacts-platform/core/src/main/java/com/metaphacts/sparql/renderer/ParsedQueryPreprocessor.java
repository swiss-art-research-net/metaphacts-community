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
package com.metaphacts.sparql.renderer;

import java.util.HashMap;
import java.util.Map;
import java.util.Stack;

import org.eclipse.rdf4j.query.Dataset;
import org.eclipse.rdf4j.query.algebra.Add;
import org.eclipse.rdf4j.query.algebra.And;
import org.eclipse.rdf4j.query.algebra.ArbitraryLengthPath;
import org.eclipse.rdf4j.query.algebra.Avg;
import org.eclipse.rdf4j.query.algebra.BNodeGenerator;
import org.eclipse.rdf4j.query.algebra.BindingSetAssignment;
import org.eclipse.rdf4j.query.algebra.Bound;
import org.eclipse.rdf4j.query.algebra.Clear;
import org.eclipse.rdf4j.query.algebra.Coalesce;
import org.eclipse.rdf4j.query.algebra.Compare;
import org.eclipse.rdf4j.query.algebra.CompareAll;
import org.eclipse.rdf4j.query.algebra.CompareAny;
import org.eclipse.rdf4j.query.algebra.Copy;
import org.eclipse.rdf4j.query.algebra.Count;
import org.eclipse.rdf4j.query.algebra.Create;
import org.eclipse.rdf4j.query.algebra.Datatype;
import org.eclipse.rdf4j.query.algebra.DeleteData;
import org.eclipse.rdf4j.query.algebra.Difference;
import org.eclipse.rdf4j.query.algebra.Distinct;
import org.eclipse.rdf4j.query.algebra.EmptySet;
import org.eclipse.rdf4j.query.algebra.Exists;
import org.eclipse.rdf4j.query.algebra.Extension;
import org.eclipse.rdf4j.query.algebra.ExtensionElem;
import org.eclipse.rdf4j.query.algebra.Filter;
import org.eclipse.rdf4j.query.algebra.FunctionCall;
import org.eclipse.rdf4j.query.algebra.Group;
import org.eclipse.rdf4j.query.algebra.GroupConcat;
import org.eclipse.rdf4j.query.algebra.GroupElem;
import org.eclipse.rdf4j.query.algebra.IRIFunction;
import org.eclipse.rdf4j.query.algebra.If;
import org.eclipse.rdf4j.query.algebra.In;
import org.eclipse.rdf4j.query.algebra.InsertData;
import org.eclipse.rdf4j.query.algebra.Intersection;
import org.eclipse.rdf4j.query.algebra.IsBNode;
import org.eclipse.rdf4j.query.algebra.IsLiteral;
import org.eclipse.rdf4j.query.algebra.IsNumeric;
import org.eclipse.rdf4j.query.algebra.IsResource;
import org.eclipse.rdf4j.query.algebra.IsURI;
import org.eclipse.rdf4j.query.algebra.Join;
import org.eclipse.rdf4j.query.algebra.Label;
import org.eclipse.rdf4j.query.algebra.Lang;
import org.eclipse.rdf4j.query.algebra.LangMatches;
import org.eclipse.rdf4j.query.algebra.LeftJoin;
import org.eclipse.rdf4j.query.algebra.Like;
import org.eclipse.rdf4j.query.algebra.Load;
import org.eclipse.rdf4j.query.algebra.LocalName;
import org.eclipse.rdf4j.query.algebra.MathExpr;
import org.eclipse.rdf4j.query.algebra.Max;
import org.eclipse.rdf4j.query.algebra.Min;
import org.eclipse.rdf4j.query.algebra.Modify;
import org.eclipse.rdf4j.query.algebra.Move;
import org.eclipse.rdf4j.query.algebra.MultiProjection;
import org.eclipse.rdf4j.query.algebra.Namespace;
import org.eclipse.rdf4j.query.algebra.Not;
import org.eclipse.rdf4j.query.algebra.Or;
import org.eclipse.rdf4j.query.algebra.Order;
import org.eclipse.rdf4j.query.algebra.OrderElem;
import org.eclipse.rdf4j.query.algebra.Projection;
import org.eclipse.rdf4j.query.algebra.ProjectionElem;
import org.eclipse.rdf4j.query.algebra.ProjectionElemList;
import org.eclipse.rdf4j.query.algebra.QueryModelNode;
import org.eclipse.rdf4j.query.algebra.QueryRoot;
import org.eclipse.rdf4j.query.algebra.Reduced;
import org.eclipse.rdf4j.query.algebra.Regex;
import org.eclipse.rdf4j.query.algebra.SameTerm;
import org.eclipse.rdf4j.query.algebra.Sample;
import org.eclipse.rdf4j.query.algebra.Service;
import org.eclipse.rdf4j.query.algebra.SingletonSet;
import org.eclipse.rdf4j.query.algebra.Slice;
import org.eclipse.rdf4j.query.algebra.StatementPattern;
import org.eclipse.rdf4j.query.algebra.Str;
import org.eclipse.rdf4j.query.algebra.Sum;
import org.eclipse.rdf4j.query.algebra.TupleExpr;
import org.eclipse.rdf4j.query.algebra.Union;
import org.eclipse.rdf4j.query.algebra.UpdateExpr;
import org.eclipse.rdf4j.query.algebra.ValueConstant;
import org.eclipse.rdf4j.query.algebra.ValueExpr;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.query.algebra.ZeroLengthPath;
import org.eclipse.rdf4j.query.algebra.helpers.AbstractQueryModelVisitor;
import org.eclipse.rdf4j.query.parser.ParsedBooleanQuery;
import org.eclipse.rdf4j.query.parser.ParsedDescribeQuery;
import org.eclipse.rdf4j.query.parser.ParsedGraphQuery;
import org.eclipse.rdf4j.query.parser.ParsedTupleQuery;
import org.eclipse.rdf4j.sail.federation.algebra.AbstractNaryTupleOperator;

import com.google.common.collect.Lists;
import com.metaphacts.sparql.renderer.SerializableParsedTupleQuery.QueryModifier;


/**
 * A query visitor that parses the incoming query or TupleExpr and collects meta-level information
 * that is later used by the {@link MpSparqlQueryRenderer} (e.g., information about the included
 * subquery, all group, order, and slice operations etc.).
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 *
 */
public class ParsedQueryPreprocessor extends AbstractQueryModelVisitor<RuntimeException> {
    
    public Map<Projection, SerializableParsedTupleQuery> queriesByProjection = new HashMap<Projection, SerializableParsedTupleQuery>();

    public Stack<SerializableParsedTupleQuery> queryProfilesStack = new Stack<SerializableParsedTupleQuery>();

    public SerializableParsedTupleQuery currentQueryProfile = new SerializableParsedTupleQuery();

    public Slice currentSlice = null;
    public SerializableParsedTupleQuery.QueryModifier currentModifier = null;
    
    public MultiProjection graphQueryProjection = null;
    
    public ParsedQueryPreprocessor() {

    }

    /**
     * Processes the incoming parsed query collecting the information required for rendering.
     * 
     * @param query
     *            standard {@link ParsedTupleQuery}
     * @return {@link SerializableParsedTupleQuery} containing the original query and the required
     *         additional information.
     */
    public SerializableParsedTupleQuery transformToSerialize(ParsedTupleQuery query) {
        query.getTupleExpr().visit(this);
        
        for (SerializableParsedTupleQuery tmp : this.queriesByProjection.values()) {
            cleanBindingSetAssignments(tmp);
        }

        currentQueryProfile.subQueriesByProjection.putAll(queriesByProjection);
        if (query.getDataset() != null) {
            currentQueryProfile.dataset = query.getDataset();
        }
        
        return currentQueryProfile;

    }
    
    public SerializableParsedConstructQuery transformToSerialize(ParsedGraphQuery query) {
        query.getTupleExpr().visit(this);
        
        for (SerializableParsedTupleQuery tmp : this.queriesByProjection.values()) {
            cleanBindingSetAssignments(tmp);
        }
        
        currentQueryProfile.subQueriesByProjection.putAll(queriesByProjection);
        
        SerializableParsedConstructQuery queryProfile = new SerializableParsedConstructQuery();
        queryProfile.subQueriesByProjection.putAll(queriesByProjection);
        queryProfile.whereClause = currentQueryProfile.whereClause;
        if (queryProfile.whereClause instanceof Extension) {
            queryProfile.whereClause = ((Extension)queryProfile.whereClause).getArg();
        }
        if (queryProfile.whereClause instanceof Slice) {
            queryProfile.whereClause = ((Slice) queryProfile.whereClause).getArg();
        }
        if (queryProfile.whereClause instanceof Order) {
            queryProfile.whereClause = ((Order)queryProfile.whereClause).getArg();
        } 
        queryProfile.bindings = currentQueryProfile.bindings;
        queryProfile.limit = currentQueryProfile.limit;
        queryProfile.dataset = query.getDataset();
        queryProfile.orderBy = currentQueryProfile.orderBy;
        // There was no multi projection, it means that there is 
        // only one triple pattern in the CONSTRUCT block
        // and it is represented as {@link Projection}. 
        // We transform it into MultiProjection to unify the serialization. 
        if (this.graphQueryProjection == null) {
            this.graphQueryProjection = new MultiProjection();
            this.graphQueryProjection.setProjections(
                    Lists.newArrayList(currentQueryProfile.projection.getProjectionElemList()));
            this.graphQueryProjection.setArg(currentQueryProfile.projection.getArg());
        }
        
        queryProfile.projection = this.graphQueryProjection;
        queryProfile.extensionElements = currentQueryProfile.extensionElements;
        
        if (query instanceof ParsedDescribeQuery) {
            queryProfile.describe = true;
        }
        
        return queryProfile;
    }
    
    public SerializableParsedUpdate transformToSerialize(UpdateExpr update, Dataset dataset) {
        update.visit(this);
        
        for (SerializableParsedTupleQuery tmp : this.queriesByProjection.values()) {
            cleanBindingSetAssignments(tmp);
        }
        currentQueryProfile.dataset = dataset;
        currentQueryProfile.subQueriesByProjection.putAll(queriesByProjection);
        SerializableParsedUpdate queryProfile = new SerializableParsedUpdate();
        queryProfile.subQueriesByProjection.putAll(queriesByProjection);
        if (currentQueryProfile.whereClause instanceof Extension) {
            queryProfile.whereClause = ((Extension)currentQueryProfile.whereClause).getArg();
        } else {
            queryProfile.whereClause = currentQueryProfile.whereClause;
        }
        queryProfile.bindings = currentQueryProfile.bindings;
        queryProfile.limit = currentQueryProfile.limit;
        queryProfile.updateExpr = update;
        return queryProfile;
    }
    
    
    /**
     * Processes the incoming parsed ASK query collecting the information required for rendering.
     * 
     * @param query
     *            standard {@link ParsedBooleanQuery}
     * @return {@link SerializableParsedBooleanQuery} containing the original query and the required
     *         additional information.
     */
    public SerializableParsedBooleanQuery transformToSerialize(ParsedBooleanQuery query) {
        if (!(query.getTupleExpr() instanceof Slice)) {
            throw new IllegalArgumentException(
                    "Unexpected boolean query: Slice expected as a root element, was "
                            + query.getTupleExpr().getSignature());
        } 
        
        Slice queryRoot = (Slice)query.getTupleExpr().clone();
        
        TupleExpr whereClause = queryRoot.getArg();
        
        Projection fakeProjection = new Projection(whereClause);
        whereClause.setParentNode(fakeProjection);
        queryRoot.setArg(fakeProjection);
        fakeProjection.setParentNode(queryRoot);
        
        queryRoot.visit(this);
        
        for (SerializableParsedTupleQuery tmp : this.queriesByProjection.values()) {
            cleanBindingSetAssignments(tmp);
        }
        
        currentQueryProfile.subQueriesByProjection.putAll(queriesByProjection);
        SerializableParsedBooleanQuery queryProfile = new SerializableParsedBooleanQuery();
        queryProfile.projection = currentQueryProfile.projection;
        queryProfile.subQueriesByProjection.putAll(queriesByProjection);
        queryProfile.whereClause = currentQueryProfile.whereClause;
        queryProfile.bindings = currentQueryProfile.bindings;
        queryProfile.extensionElements = currentQueryProfile.extensionElements;
        queryProfile.dataset = query.getDataset();
        return queryProfile;

    }
    
    

    /**
     * Processes the incoming parsed {@link TupleExpr} collecting the information required for
     * rendering.
     * 
     * @param tupleExpr
     *            standard {@link TupleExpr}
     * @return {@link SerializableParsedTupleQuery} containing the original query and the required
     *         additional information.
     */
    public SerializableParsedTupleQuery transformToSerialize(TupleExpr tupleExpr) {

        tupleExpr.visit(this);
        
        for (SerializableParsedTupleQuery query : this.queriesByProjection.values()) {
            cleanBindingSetAssignments(query);
        }
        cleanBindingSetAssignments(currentQueryProfile);

        currentQueryProfile.subQueriesByProjection.putAll(queriesByProjection);
        return currentQueryProfile;

    }

    /**
     * If we have a VALUES clause inside the WHERE clause, we should not render it twice.
     */
    protected void cleanBindingSetAssignments(SerializableParsedTupleQuery query) {
        if (query.bindings != null && query.whereClause != null
                && isAncestor(query.whereClause, query.bindings)) {
            query.bindings = null;
        }
    }

    protected boolean isAncestor(QueryModelNode node1, QueryModelNode node2) {
        if (node2.getParentNode() == null) {
            return false;
        } else if (node2.getParentNode().equals(node1)) {
            return true;
        } else {
            return isAncestor(node1, node2.getParentNode());
        }
    }

    @Override
    public void meet(QueryRoot node) throws RuntimeException {

        super.meet(node);

    }

    @Override
    public void meet(Add add) throws RuntimeException {

        super.meet(add);

    }

    @Override
    public void meet(And node) throws RuntimeException {
        ensureNonAnonymousVar(node.getLeftArg());
        ensureNonAnonymousVar(node.getRightArg());
        super.meet(node);
    }

    @Override
    public void meet(ArbitraryLengthPath node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(Avg node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(BindingSetAssignment node) throws RuntimeException {
        currentQueryProfile.bindings = node;
    }

    @Override
    public void meet(BNodeGenerator node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Bound node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(Clear clear) throws RuntimeException {
        super.meet(clear);

    }

    @Override
    public void meet(Coalesce node) throws RuntimeException {
        node.getArguments().stream().forEach(arg -> ensureNonAnonymousVar(arg));
        super.meet(node);
    }

    @Override
    public void meet(Compare node) throws RuntimeException {
        ensureNonAnonymousVar(node.getLeftArg());
        ensureNonAnonymousVar(node.getRightArg());
        super.meet(node);
    }

    @Override
    public void meet(CompareAll node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(CompareAny node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(Copy copy) throws RuntimeException {
        super.meet(copy);
    }

    @Override
    public void meet(Count node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Create create) throws RuntimeException {
        super.meet(create);
    }

    @Override
    public void meet(Datatype node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(DeleteData deleteData) throws RuntimeException {
        super.meet(deleteData);
    }

    @Override
    public void meet(Difference node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            this.currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(Distinct node) throws RuntimeException {
        currentModifier = SerializableParsedTupleQuery.QueryModifier.DISTINCT;
        super.meet(node);

    }

    @Override
    public void meet(EmptySet node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Exists node) throws RuntimeException {

        super.meet(node);

    }

    @Override
    public void meet(Extension node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(ExtensionElem node) throws RuntimeException {
        currentQueryProfile.extensionElements.put(node.getName(), node);
        super.meet(node);
    }

    @Override
    public void meet(Filter node) throws RuntimeException {
        boolean maybeHaving = false;
        if (currentQueryProfile.groupBy == null) {
            maybeHaving = true;
        }

        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }

        super.meet(node);

        if (maybeHaving && currentQueryProfile.groupBy != null) {
            currentQueryProfile.having = node;
        }

    }

    @Override
    public void meet(FunctionCall node) throws RuntimeException {
        node.getArgs().stream().forEach(arg -> ensureNonAnonymousVar(arg));
        super.meet(node);
    }

    @Override
    public void meet(Group node) throws RuntimeException {
        if (this.currentQueryProfile.whereClause != null) {
            this.currentQueryProfile.whereClause = null;
        }

        if (this.currentQueryProfile.groupBy == null) {
            this.currentQueryProfile.groupBy = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(GroupConcat node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(GroupElem node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(If node) throws RuntimeException {
        ensureNonAnonymousVar(node.getCondition());
        ensureNonAnonymousVar(node.getResult());
        ensureNonAnonymousVar(node.getAlternative());
        super.meet(node);

    }

    @Override
    public void meet(In node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(InsertData insertData) throws RuntimeException {
        super.meet(insertData);

    }

    @Override
    public void meet(Intersection node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            this.currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(IRIFunction node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(IsBNode node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(IsLiteral node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(IsNumeric node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(IsResource node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(IsURI node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(Join node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(Label node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(Lang node) throws RuntimeException {
        ensureNonAnonymousVar(node.getArg());
        super.meet(node);
    }

    @Override
    public void meet(LangMatches node) throws RuntimeException {
        ensureNonAnonymousVar(node.getLeftArg());
        ensureNonAnonymousVar(node.getRightArg());
        super.meet(node);
    }

    @Override
    public void meet(LeftJoin node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }
        super.meet(node);
    }

    @Override
    public void meet(Like node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Load load) throws RuntimeException {
        super.meet(load);
    }

    @Override
    public void meet(LocalName node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(MathExpr node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Max node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Min node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Modify modify) throws RuntimeException {
        currentQueryProfile.modifier = currentModifier;
        currentModifier = null;
        super.meet(modify);
    }

    @Override
    public void meet(Move move) throws RuntimeException {
        super.meet(move);

    }

    @Override
    public void meet(MultiProjection node) throws RuntimeException {
        this.graphQueryProjection = node;
        currentQueryProfile.modifier = currentModifier;
        currentModifier = null;
        Projection fakeProjection = new Projection();
        
        node.getProjections().stream().forEach(
            projList -> projList.getElements().stream().forEach(
                elem -> fakeProjection.getProjectionElemList().addElement(elem)));
        fakeProjection.setArg(node.getArg().clone());
        currentQueryProfile.projection = fakeProjection;
        queriesByProjection.put(fakeProjection, currentQueryProfile);
        super.meet(node);

    }

    @Override
    public void meet(Namespace node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Not node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Or node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Order node) throws RuntimeException {

        if (currentQueryProfile.orderBy == null) {
            currentQueryProfile.orderBy = node;
        }

        super.meet(node);
    }

    @Override
    public void meet(OrderElem node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Projection node) throws RuntimeException {

        boolean isSubquery = false;
        if ( (currentQueryProfile.whereClause != null)|| (currentQueryProfile.projection != null)) {
            // we have a subquery
            isSubquery = true;
            if (currentQueryProfile.whereClause == null) {
                currentQueryProfile.whereClause = node;
            }
            queryProfilesStack.push(currentQueryProfile);
            currentQueryProfile = new SerializableParsedTupleQuery();
        }

        currentQueryProfile.modifier = currentModifier;
        currentModifier = null;

        currentQueryProfile.projection = node;
        queriesByProjection.put(node, currentQueryProfile);

        super.meet(node);

        if (isSubquery) {
            currentQueryProfile = queryProfilesStack.pop();
        }

    }

    @Override
    public void meet(ProjectionElem node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(ProjectionElemList node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Reduced node) throws RuntimeException {
        currentModifier = QueryModifier.REDUCED;
        super.meet(node);

    }

    @Override
    public void meet(Regex node) throws RuntimeException {
        ensureNonAnonymousVar(node.getLeftArg());
        ensureNonAnonymousVar(node.getRightArg());
        super.meet(node);
    }

    @Override
    public void meet(SameTerm node) throws RuntimeException {
        ensureNonAnonymousVar(node.getLeftArg());
        ensureNonAnonymousVar(node.getRightArg());
        super.meet(node);

    }

    @Override
    public void meet(Sample node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Service node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }
        super.meet(node);

    }

    @Override
    public void meet(SingletonSet node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Slice node) throws RuntimeException {
        currentSlice = node;

        currentQueryProfile.limit = node;
        super.meet(node);
    }

    @Override
    public void meet(StatementPattern node) throws RuntimeException {

        if (currentQueryProfile.whereClause == null) {
            this.currentQueryProfile.whereClause = node;
        }

        super.meet(node);

    }

    @Override
    public void meet(Str node) throws RuntimeException {
        super.meet(node);

    }

    @Override
    public void meet(Sum node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Union node) throws RuntimeException {
        if (currentQueryProfile.whereClause == null) {
            currentQueryProfile.whereClause = node;
        }

        super.meet(node);

    }

    @Override
    public void meet(ValueConstant node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(Var node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meet(ZeroLengthPath node) throws RuntimeException {
        super.meet(node);
    }

    @Override
    public void meetOther(QueryModelNode node) throws RuntimeException {
        if (node instanceof AbstractNaryTupleOperator) {
            AbstractNaryTupleOperator naryNode = (AbstractNaryTupleOperator) node;
            if (currentQueryProfile.whereClause == null) {
                currentQueryProfile.whereClause = naryNode;
            }
            naryNode.visitChildren(this);
        } else {
            super.meetOther(node);
        }
    }
    
    protected void ensureNonAnonymousVar(ValueExpr valueExpr) {
        if (valueExpr instanceof Var) {
            Var var = (Var) valueExpr;
            if (var.isAnonymous() && !var.isConstant()) {
                currentQueryProfile.nonAnonymousVars.put(var.getName(), var);
            }
        }
    }
}
