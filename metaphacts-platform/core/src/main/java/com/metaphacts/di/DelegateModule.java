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
package com.metaphacts.di;

import javax.inject.Provider;

import com.google.inject.AbstractModule;
import com.google.inject.Injector;
import com.google.inject.binder.ScopedBindingBuilder;

/**
 * Module base class that can be used to fetch a subset of bindings 
 * from another Guice contect/injector to avoid exposing all bindings.
 * 
 * <p>
 * In order to use this create a subclass parameterized with the delegate
 * injector and within the overridden
 * {@code configure()} method calls {@link #bindDelegate(Class)}.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DelegateModule extends AbstractModule {
    protected Injector delegateInjector;

    public DelegateModule(Injector delegateInjector) {
        this.delegateInjector = delegateInjector;
    }
    
    public Injector getDelegateInjector() {
        return delegateInjector;
    }
    
    protected <T> ScopedBindingBuilder bindDelegate(Class<T> type) {
        // bind type to object from delegate injector
        return bind(type).toProvider(new DelegateProvider<T>(delegateInjector, type));
    }
    
    public static class DelegateProvider<T> implements Provider<T> {
        protected final Injector delegateInjector;
        protected final Class<T> type;
        public DelegateProvider(Injector delegateInjector, Class<T> type) {
            this.delegateInjector = delegateInjector;
            this.type = type;
        }

        @Override
        public T get() {
            // fetch instance from delegate injector
            return delegateInjector.getInstance(type);
        }
        
    }
}
