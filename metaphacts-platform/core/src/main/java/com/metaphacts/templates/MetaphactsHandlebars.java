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
package com.metaphacts.templates;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.github.jknack.handlebars.EscapingStrategy;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.Options;
import com.github.jknack.handlebars.cache.ConcurrentMapTemplateCache;
import com.github.jknack.handlebars.io.TemplateLoader;
import com.google.inject.Singleton;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.templates.helper.DocumentationHelper;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Alexey Morozov
 */
@Singleton
public class MetaphactsHandlebars extends Handlebars{

    private static final Logger logger = LogManager.getLogger(MetaphactsHandlebars.class);

    public static final String startDelimiter="[[";
    public static final String endDelimiter="]]";

    @Inject
    public MetaphactsHandlebars(PlatformStorage platformStorage, NamespaceRegistry ns, HandlebarsHelperRegistry helperRegistry) {
        this(new TemplateByIriLoader(platformStorage, ns), helperRegistry);
    }

    protected MetaphactsHandlebars(TemplateLoader templateLoader, HandlebarsHelperRegistry helperRegistry) {
        super();
        initialize(templateLoader, helperRegistry);
    }

    private void initialize(TemplateLoader templateLoader, HandlebarsHelperRegistry helperRegistry) {

        ConcurrentMapTemplateCache cache = new ConcurrentMapTemplateCache().setReload(true);

        if(templateLoader!=null){
            with(templateLoader);
        }
        with(cache);
        startDelimiter(startDelimiter);
        endDelimiter(endDelimiter);
        setPrettyPrint(true);
        registerHelperMissing(new Helper<Object>() {
            @Override
            public CharSequence apply(final Object context, final Options options) throws MissingHelperException {
              throw new MissingHelperException("Missing helper: " + options.fn.text() +"\nTemplate: "+options.fn.filename()+ " Line: "+options.fn.position()[0] +" Column "+options.fn.position()[1] );
            }
        });
        with(EscapingStrategy.NOOP);
        registerMetaphactsHelper(helperRegistry);
        if(templateLoader!=null){
            logger.debug("Initialized backend handlebars engine with template loader:  " + templateLoader.getClass());
        }else{
            logger.debug("Initialized backend handlebars engine with no template loader. Default (classpath) template loader will be used.");
        }

    }

    private void registerMetaphactsHelper(HandlebarsHelperRegistry helperRegistry) {
        helperRegistry.getHelpers().forEach(this::registerHelpers);
        helperRegistry.getNamedHelpers().entrySet().forEach(entry ->
            registerHelper(entry.getKey(), entry.getValue()));

        // register DocumentationHelper
        registerHelper("documentation", new DocumentationHelper());

        if (logger.isDebugEnabled()) {
            logger.debug("Registered the following handlebars template helper: \n" + this.helpers());
        }
    }
}
