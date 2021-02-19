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
package com.metaphacts.plugin;

import java.io.IOException;
import java.net.URL;
import java.util.Enumeration;

import org.pf4j.ClassLoadingStrategy;
import org.pf4j.PluginClassLoader;
import org.pf4j.PluginDescriptor;
import org.pf4j.PluginManager;

/**
 * ClassLoader for plugins/apps. 
 * 
 * <p>
 * This class loader behaves as the parent class with the exception of suppressing resources
 * from the parent class loader when looking for resources in {@code META-INF/services/}, as
 * we want to avoid loading classes via ServiceLoader which are specified in the main class path.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class PlatformPluginClassLoader extends PluginClassLoader {

    public PlatformPluginClassLoader(PluginManager pluginManager, PluginDescriptor pluginDescriptor, ClassLoader parent,
            boolean parentFirst) {
        super(pluginManager, pluginDescriptor, parent,
                parentFirst ? ClassLoadingStrategy.APD : ClassLoadingStrategy.PDA);
    }

    public PlatformPluginClassLoader(PluginManager pluginManager, PluginDescriptor pluginDescriptor,
            ClassLoader parent) {
        super(pluginManager, pluginDescriptor, parent);
    }
    
    @Override
    public URL getResource(String name) {
        // suppressing resources from the parent class loader when looking for resources 
        // in META-INF/services/, as we want to avoid loading classes via ServiceLoader 
        // which are specified in the main class path
        if (isExtensionDefinition(name)) {
            // only look in our own classpath
            return findResource(name);
        }
        return super.getResource(name);
        
    }
    
    @Override
    public Enumeration<URL> getResources(String name) throws IOException {
        // suppressing resources from the parent class loader when looking for resources 
        // in META-INF/services/, as we want to avoid loading classes via ServiceLoader 
        // which are specified in the main class path
        if (isExtensionDefinition(name)) {
            // only look in our own classpath
            return findResources(name);
        }
        // simply pass to parent class
        return super.getResources(name);
    }

    /**
     * Determine whether the named resource contains names of extensions, e.g. for the ServiceLoader 
     * or the PF4J extension mechanism.
     * 
     * @param name name of the resource
     * @return <code>true</code> if the named resource contains names of extensions, <code>false</code> otherwise
     */
    protected boolean isExtensionDefinition(String name) {
        return name.startsWith("META-INF/services/") || name.equals("META-INF/extensions.idx");
    }
}
