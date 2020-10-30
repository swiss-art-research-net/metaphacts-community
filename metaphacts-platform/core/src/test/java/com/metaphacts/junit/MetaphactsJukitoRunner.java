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
package com.metaphacts.junit;

import java.lang.reflect.InvocationTargetException;

import org.jukito.InjectedAfterStatements;
import org.jukito.JukitoRunner;
import org.junit.rules.ExpectedException;
import org.junit.runners.model.FrameworkMethod;
import org.junit.runners.model.InitializationError;
import org.junit.runners.model.MultipleFailureException;
import org.junit.runners.model.Statement;

import com.google.inject.Injector;

/**
 * Modification to the {@link JukitoRunner} to pass the injector statically to
 * {@link ResourceTestConfig} to establish the HK2 guice bridge.
 * 
 * <p>
 * Also, a work around for proper support of ExpectedException is applied.
 * </p>
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class MetaphactsJukitoRunner extends JukitoRunner {
    public MetaphactsJukitoRunner(final Class<?> classToRun) throws InitializationError,
    InvocationTargetException, InstantiationException, IllegalAccessException {
        super(classToRun);
    }
    
    public MetaphactsJukitoRunner(Class<?> klass, Injector injector)
            throws InitializationError, InvocationTargetException, InstantiationException, IllegalAccessException {
        super(klass, injector);
    }
    
    /**
     * Apply work around for proper support of {@link ExpectedException}.
     * 
     * <p>
     * See <a href="https://github.com/ArcBees/Jukito/issues/83">Jukito does not work well with ExpectedException rule #83</a> for details.
     * </p>
     */
    @Override
    protected Statement withAfters(FrameworkMethod method, Object target, Statement statement) {
        Statement parent = super.withAfters(method, target, statement);
        if (parent instanceof InjectedAfterStatements) {
            return new Statement() {
                @Override
                public void evaluate() throws Throwable {
                    try {
                        parent.evaluate();
                    }
                    catch (MultipleFailureException mfe) {
                        // if there was only a single failure, 
                        // rather re-throw that individually
                        MultipleFailureException.assertEmpty(mfe.getFailures());
                    }
                }
            };
        }
        return parent;
    }
    
    /**
     * Passes the injector statically to {@link ResourceTestConfig} to establish the HK2 guice bridge.
     */
    @Override
    public Object createTest() throws Exception {
        ResourceTestConfig.injector= getInjector();
        return super.createTest();
    }
}