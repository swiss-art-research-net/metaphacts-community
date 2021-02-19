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
package com.metaphacts.util;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Abstract base class for a delegation mechanism. This base class holds all
 * delegates which can either be passed in the constructor or via
 * {@link #setDelegates(List)}.
 * 
 * <p>
 * Typically, an implementation would implement the same interface, which is
 * often a SingleAbstractMethod (SAM) type and returns a value or
 * {@link Optional}. When iterating over the delegates the first
 * non-<code>null</code> value or Optional with a value present would be
 * returned.
 * </p>
 * 
 * <p>
 * The list of delegates maintained by this class is mutable and can be extended
 * by adding more delegates using {@link #addDelegate(Object...)}
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 *
 * @param <T> type of services to delegate to
 */
public abstract class AbstractDelegatingProvider<T> {
    protected List<T> delegates;

    public AbstractDelegatingProvider() {
        this.delegates = new ArrayList<T>();
    }

    public AbstractDelegatingProvider(List<T> delegates) {
        this.delegates = new ArrayList<T>(delegates);
    }

    public List<T> getDelegates() {
        return delegates;
    }

    public void setDelegates(List<T> delegates) {
        this.delegates = new ArrayList<T>(delegates);
    }
    
    public void addDelegate(@SuppressWarnings("unchecked") T... delegates) {
        this.delegates.addAll(Arrays.asList(delegates));
    }

    public void removeDelegate(@SuppressWarnings("unchecked") T... delegates) {
        this.delegates.removeAll(Arrays.asList(delegates));
    }
}
