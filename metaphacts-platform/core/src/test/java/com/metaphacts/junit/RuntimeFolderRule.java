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

import java.io.File;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;

import javax.inject.Inject;

import org.junit.rules.TemporaryFolder;

import com.google.inject.Singleton;
import com.metaphacts.config.Configuration;

/**
 * Rule to create a temporary runtime folder and "apply" it be setting the 
 * system property expected by {@link Configuration#getRuntimeDirectory()}.
 * 
 * <p>
 * This rule will create the runtime folder itself as well as the {@code data} and {@code config} folders.
 * </p>
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
@Singleton
public class RuntimeFolderRule extends TemporaryFolder {
    private SecureRandom random = new SecureRandom();
    protected File runtimeFolder;
    
    public RuntimeFolderRule() {
        
    }

    protected String nextRandom() {
      return new BigInteger(130, random).toString(32);
    }
    
    public File getRuntimeFolder() {
        return runtimeFolder;
    }
    
    /**
     * Check whether the runtime folder is already initialized.
     */
    protected boolean isInitialized() {
        // we check whether the initialization already happened 
        // by fetching the root folder which will throw an  
        // IllegalStateException if it was not yet initialized
        try {
            getRoot();
            return true;
        }
        catch (IllegalStateException e) {
            return false;
        }
    }
    
    /**
     * Ensure that the runtime folder is set to a temporary folder.
     * This method is idempotent, i.e. calling it repeatedly has no additional effect.
     * @throws IOException in case of errors
     */
    @Inject
    public void ensureRuntimeFolderExists() throws IOException {
        create();
    }
    
    @Override
    public void create() throws IOException {
        if (isInitialized()) {
            // is already initialized
            return;
        }
        
        super.create();
        
        runtimeFolder = newFolder("metaphatory-" + nextRandom());
        Files.createDirectories(runtimeFolder.toPath());

        // set system property used by Configuration#getRuntimeDirectory()
        System.setProperty(Configuration.SYSTEM_PROPERTY_RUNTIME_DIRECTORY,
                getRuntimeFolderPath().toString());

        createRuntimeFolderStructure(runtimeFolder);
    }

    /**
     * Create folder structure within runtime folder.
     * 
     * <p>
     * This implementation creates the {@code data} and {@code config} folders.
     * </p>
     * 
     * @param runtimeFolder runtime folder in which to create the folder structure
     * @throws IOException in case of errors
     */
    protected void createRuntimeFolderStructure(File runtimeFolder) throws IOException {
        // create data dir
        File dataFolder = new File(runtimeFolder, "./data");
        Files.createDirectories(dataFolder.toPath());
        // create config dir
        File configFolder = new File(runtimeFolder, "./config");
        Files.createDirectories(configFolder.toPath());
    }

    public Path getRuntimeFolderPath() {
        return getRuntimeFolder().toPath().toAbsolutePath();
    }
    
    @Override
    protected void after() {
        // unset system property, but only if this is actually the same value as our directory
        if (Configuration.getRuntimeDirectory().equals(getRuntimeFolderPath().toString())) {
            System.clearProperty(Configuration.SYSTEM_PROPERTY_RUNTIME_DIRECTORY);
        }
        
        // the runtime folder and all contents will be deleted by the parent class
        super.after();
    }
}
