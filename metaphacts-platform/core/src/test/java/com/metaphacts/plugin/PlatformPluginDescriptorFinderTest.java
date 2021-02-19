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

import static org.junit.Assert.assertEquals;

import java.io.File;
import java.io.IOException;
import java.util.Collection;

import org.apache.commons.io.FileUtils;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.pf4j.Plugin;
import org.pf4j.PluginDescriptor;
import org.pf4j.PluginDescriptorFinder;
import org.pf4j.PluginRuntimeException;

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.MpAssert;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class PlatformPluginDescriptorFinderTest extends AbstractIntegrationTest{
    @Rule
    public TemporaryFolder tempFolderRule = new TemporaryFolder();
    
    @Inject
    public PlatformPluginManager manager;
    
    @Test
    public void testExceptionNoPluginId() throws IOException {
        File pulginDirectory = tempFolderRule.newFolder();
        
        File pluginProperties = new File(pulginDirectory, "plugin.properties");
        pluginProperties.createNewFile();
        
        PluginDescriptorFinder finder = manager.createPluginDescriptorFinder();
        MpAssert.assertThrows("Field 'id' cannot be empty", PluginRuntimeException.class, () -> {
            manager.validatePluginDescriptor(finder.find(pulginDirectory.toPath()));
        });
    }

    @Test
    public void testExceptionNoPluginVersion() throws IOException {
        File pulginDirectory = tempFolderRule.newFolder();
        
        Collection<String> lines = Lists.newArrayList(
                "plugin.id=testPlugin"
        );
        FileUtils.writeLines(new File(pulginDirectory, "plugin.properties"), lines);
        
        PluginDescriptorFinder finder = manager.createPluginDescriptorFinder();
        MpAssert.assertThrows("Field 'version' cannot be empty", PluginRuntimeException.class, () -> {
            manager.validatePluginDescriptor(finder.find(pulginDirectory.toPath()));
        });
    }
    
    @Test
    public void testDefaults() throws IOException {
        File pluginDirectory = tempFolderRule.newFolder();
        
        Collection<String> lines = Lists.newArrayList(
                "plugin.id=testPlugin",
                "plugin.version=1.0.0"
                );
        FileUtils.writeLines(new File(pluginDirectory, "plugin.properties"), lines);
        PluginDescriptorFinder finder = manager.createPluginDescriptorFinder();
        PluginDescriptor descriptor = (PluginDescriptor) finder.find(pluginDirectory.toPath());
        
        // if not plugin is class is defined, default Plugin class should be returned
        assertEquals(Plugin.class.getCanonicalName(), descriptor.getPluginClass());
    }
}
