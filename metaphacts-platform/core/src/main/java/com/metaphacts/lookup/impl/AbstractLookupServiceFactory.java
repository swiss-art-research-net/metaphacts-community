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
package com.metaphacts.lookup.impl;

import com.google.inject.Inject;
import com.google.inject.Injector;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceFactory;

/**
 * Abstract base class for a LookupServiceFactory.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 *
 * @param <CFG> configuration class, must extend {@link LookupServiceConfig}
 */
public abstract class AbstractLookupServiceFactory<CFG extends CommonLookupConfig> implements LookupServiceFactory {
    
    protected final String lookupType;
    protected final Class<CFG> configClass;
    
    Injector injector;

    protected AbstractLookupServiceFactory(String lookupType, Class<CFG> configClass) {
        this.lookupType = lookupType;
        this.configClass = configClass;
    }
    
    @Override
    public String getLookupServiceType() {
        return lookupType;
    }

    @Override
    public CFG getConfig() {
        try {
            CFG config = configClass.newInstance();
            config.setType(lookupType);
            return config;
        } catch (InstantiationException | IllegalAccessException e) {
            throw new RuntimeException("Failed to create instance of LookupServiceConfig class", e);
        }
    }

    @Override
    public LookupService getLookupService(LookupServiceConfig config) throws Exception {
        if (!lookupType.equals(config.getType())) {
            throw new Exception("Invalid LookupService type: " + config.getType());
        }
        
        if (!configClass.isAssignableFrom(config.getClass())) {
            throw new Exception("Invalid LookupService type: " + config.getType());
        }
        
        CFG castedConfig = configClass.cast(config);
        
        // validate config
        castedConfig.validate();
        
        LookupService lookupService = createLookupService(castedConfig);
        if (injector != null) {
            injector.injectMembers(lookupService);
        }
        return lookupService;
    }
    
    @Inject(optional = true)
    void setInjector(Injector injector) {
        this.injector = injector;
    }

    protected abstract LookupService createLookupService(CFG config);
}
