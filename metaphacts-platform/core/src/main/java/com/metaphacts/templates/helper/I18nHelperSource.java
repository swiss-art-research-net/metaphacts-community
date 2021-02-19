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
package com.metaphacts.templates.helper;

import static org.apache.commons.lang3.Validate.notEmpty;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.URL;
import java.net.URLConnection;
import java.text.MessageFormat;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.Optional;
import java.util.PropertyResourceBundle;
import java.util.ResourceBundle;
import java.util.Set;

import javax.annotation.Nullable;
import javax.inject.Inject;

import org.apache.commons.lang3.LocaleUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageLocation;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.TemplateContext;

/**
 * Class which provides the {@code i18n} Handlebars helper. See {@link #i18n(String, Options)} for details.
 * @author wschell
 * @see #i18n(String, Options)
 */
public class I18nHelperSource {
    public static final String DEFAULT_BUNDLE = "messages";

    public static final String CACHE_ID = "platform.I18nCache";

    private static final Logger logger = LogManager.getLogger(I18nHelperSource.class);
    
    private final Configuration config;
    private final CacheManager cacheManager;
    private final ResourceBundle.Control control;

    @Inject
    public I18nHelperSource(Configuration config, PlatformStorage platformStorage, CacheManager cacheManager) {
        this.config = config;
        this.cacheManager = cacheManager;
        
        this.control = createControl(platformStorage);
        setFallbackLocale(getSystemPreferredLocale(config));
        
        this.cacheManager.register(createCache());
    }

    /**
     * Determine the preferred system language.
     * @param config system configuration
     * @return system preferred language or <code>null</code> if unset
     */
    protected Locale getSystemPreferredLocale(Configuration config) {
        return getLocaleWithSystemFallback(null);
    }
    
    /**
     * Get locale by name.
     * 
     * @param localeName name of the locale, e.g. 'de' or 'de_DE' or <code>null</code> to use system language
     * @return locale or <code>null</code> if locale could not be determined
     */
    protected Locale getLocaleWithSystemFallback(@Nullable String localeName) {
        String language = config.getUiConfig().resolvePreferredLanguage(localeName);
        if (language != null) {
            try {
                return LocaleUtils.toLocale(language);
            }
            catch (Exception e) {
                // fallback, trace but ignore error
                logger.trace("Failed to resolve locale " + localeName + ": " + e.getMessage(), e);
                return Locale.forLanguageTag(language);
            }
        }
        return null;
    }

    /**
     * Create instance of {@link ResourceBundle.Control}.
     * This method can be overridden to further customize loading of resource bundles. 
     * The default implementation creates an instance of {@link StorageResourceBundleControl},
     * sub-classes of I18nHelperSource would preferably also create sub-classes of {@link StorageResourceBundleControl},
     * 
     * @param platformStorage 
     * @param fallbackLocale
     * @return
     */
    protected ResourceBundle.Control createControl(PlatformStorage platformStorage) {
        return new StorageResourceBundleControl(platformStorage);
    }

    /**
     * Create instance of {@link PlatformCache}.
     * 
     * @return
     */
    protected PlatformCache createCache() {
        return new I18nHelperSourceCache();
    }

    /**
     * <p>
     * A helper built on top of {@link ResourceBundle}. A {@link ResourceBundle} is the most well
     * known mechanism for internationalization (i18n).
     * </p>
     * 
     * <p>
     * In contrast to commonly used handling of I18n in Java applications, {@link ResourceBundle}s are loaded via the  
     * <a href="https://help.metaphacts.com/resource/Help:Storage">(App) Storage Mechanism</a> from the {@code data/i18n/} 
     * folder of an app or runtime storage. {@link ResourceBundle}s will be assumed to be in UTF-8 encoding.
     * </p>
     * <p>
     * <h3>messages.properties:</h3>
     * </p>
     *
     * <pre>
     *  hello=Hola
     * </pre>
     *
     * <h3>Basic Usage:</h3>
     *
     * <pre>
     *  [[i18n "hello"]]
     * </pre>
     *
     * <p>
     * Will result in: <code>Hola</code>
     * </p>
     * 
     * <h3>Using an explicitly specified locale:</h3>
     *
     * <pre>
     *  [[i18n "hello" locale="es"]]
     *  [[i18n "hello" locale="es_AR"]]
     * </pre>
     *
     * <h3>Using a different bundle:</h3>
     *
     * <pre>
     *  [[i18n "hello" bundle="myMessages"]]
     * </pre>
     * 
     * <p>
     * Will search for messages in <code>myMessages.properties</code>.
     * </p>
     * 
     * <h3>Using a message format:</h3>
     * 
     * <p>
     * Note that single quotes need to be escaped with another single quote: {@code ''}.
     * See for details.
     * </p>
     *
     * <pre>
     *  hello=Let''s dance, {0}!
     * </pre>
     *
     * <pre>
     *  [[i18n "hello" "Handlebars.java"]]
     * </pre>
     * 
     * <h3>Auto-escaping for HTML</h3>
     * 
     * <p>
     * By default all messages are automatically escaped for HTML, i.e. special characters such as &lt;, &amp;, &gt;, &quot;
     * are replaced with the corresponding HTML entities. This can be disabled using the option <code>escapeHTML</code>:
     * </p>
     * 
     * <pre>
     *  [[i18n "<font color='red'>hello</font>" "Handlebars.java" escapeHTML=false]]
     * </pre>
     * 
     * <p>
     * If the key cannot be resolved to a message the key itself is returned with a warning appended.
     * </p>
     *
     * @param key The bundle's key. Required.
     * @param options The helper's options. Not null.
     * @return An i18n message. If the key cannot be resolved to a message it is return with a warning appended.
     */
    public CharSequence i18n(final String messageKey, final Options options) throws IOException {
        // note: the implementation is based on the original one from 
        // com.github.jknack.handlebars.helper.new I18nHelper() {...}.apply(String, Options)
      TemplateContext context =  (TemplateContext) options.context.model();
      notEmpty(messageKey, "found: '%s', expected 'bundle's key'", messageKey);
      Locale locale = getLocaleWithSystemFallback(options.hash("locale", context.getPreferredLanguage().orElse(null)));
      String bundleName = options.hash("bundle", DEFAULT_BUNDLE);
      
      // determine class loader to use: explicitly provided, app-specific or global 
      ClassLoader classLoader = options.hash("classLoader");
      if (classLoader == null) {
          // use default class loader
          classLoader = getApplicationClassLoader();
      }
      
      // note: ResourceBundle.getBundle() performs caching internally
      ResourceBundle bundle = null;
      try {
          bundle = ResourceBundle.getBundle(bundleName, locale, classLoader, this.control);
      }
      catch (MissingResourceException e) {
          logger.debug("I18n bundle {} not found", bundleName);
          return messageKey + " (bundle not found)";
      }
      
      if (!bundle.containsKey(messageKey)) {
          logger.debug("I18n key {} not found in bundle {}", messageKey, bundleName);
          // TODO do we want to support message string provided as parameter?
          return messageKey + " (message key not found)";
      }
      String message = bundle.getString(messageKey);
      Object[] args = options.params;
      if (args != null && args.length > 0) {
        MessageFormat format = new MessageFormat(message, locale);
        message = format.format(args);
      }
      Boolean escapeHtml = options.hash("escapeHTML", Boolean.TRUE);
      return escapeHtml 
              ? StringEscapeUtils.escapeHtml4(message)
              : new Handlebars.SafeString(message);
    }

    protected ClassLoader getApplicationClassLoader() {
        return getClass().getClassLoader();
    }
    
    /**
     * Set fallback locale for when the user's locale is not defined or cannot be determined.
     * @param fallbackLocale locale to be used as fallback
     */
    protected void setFallbackLocale(@Nullable Locale fallbackLocale) {
        if (control instanceof StorageResourceBundleControl) {
            ((StorageResourceBundleControl) control).setFallbackLocale(fallbackLocale);
        }
    }
    
    /**
     * Helper class which loads {@link ResourceBundle}s from folder {@code data/i18n/} in the {@link PlatformStorage}  
     * falling back to the provided class loader for default behavior.
     * <p>
     * Note: when loading from {@link PlatformStorage}, {@link ResourceBundle}s are loaded using {@code UTF-8} encoding.
     * </p>
     * @author wschell
     */
    public static class StorageResourceBundleControl extends ResourceBundle.Control {
        private static final Logger logger = LogManager.getLogger(StorageResourceBundleControl.class);
        
        private final PlatformStorage platformStorage;
        private Locale fallbackLocale;
        
        public StorageResourceBundleControl(PlatformStorage platformStorage) {
            this(platformStorage, null);
        }
        
        public StorageResourceBundleControl(PlatformStorage platformStorage, Locale fallbackLocale) {
            this.platformStorage = platformStorage;
            this.fallbackLocale = fallbackLocale;
        }
        
        /**
         * Returns the application preferred <code>Locale</code>} if the given
         * <code>locale</code> isn't the same one. Otherwise, <code>null</code> is returned.
         */
        @Override
        public Locale getFallbackLocale(String baseName, Locale locale) {
            if (fallbackLocale != null) {
                return locale.equals(fallbackLocale) ? null : fallbackLocale;
            }
            return super.getFallbackLocale(baseName, locale);
        }
        
        public void setFallbackLocale(Locale fallbackLocale) {
            this.fallbackLocale = fallbackLocale;
        }
        
        @Override
        public boolean needsReload(String baseName, Locale locale, String format, ClassLoader loader,
                ResourceBundle bundle, long loadTime) {
            // this method can be customized if we need more fine-granular control over (auto-)reloading of resource bundles.
            // for now, resource bundles are only reloaded after the cache has been invalidated using CacheManager#invalidateAll()
            return super.needsReload(baseName, locale, format, loader, bundle, loadTime);
        }
        
        @Override
        public ResourceBundle newBundle(String baseName, Locale locale, String format, ClassLoader loader,
                boolean reload) throws IllegalAccessException, InstantiationException, IOException {
            // we only support for properties files
            if (format.equals("java.properties")) {
                // resolve resource name
                final String resourceName = toResourceName(baseName, locale);
                if (resourceName == null) {
                    return null;
                }
                InputStream stream = openStream(resourceName, loader, reload);
                if (stream != null) {
                    // assume UTF-8
                    try (Reader reader = new InputStreamReader(stream, "UTF-8")){
                        return new PropertyResourceBundle(reader);
                    }
                }
            }
            
            // fallback: delegate to parent class for default behavior
            return super.newBundle(baseName, locale, format, loader, reload);
        }

        protected String toResourceName(String baseName, Locale locale) {
            String bundleName = toBundleName(baseName, locale);
            final String resourceName = toResourceName(bundleName, "properties");
            return resourceName;
        }

        /**
         * Load specified resource bundle, either from {@link PlatformStorage} or the provided class loader.
         * @param resourceName
         * @param classLoader
         * @param reload
         * @return
         * @throws IOException
         * 
         * @see #openStreamFromStorageLoader(String, ClassLoader, boolean)
         * @see #openStreamFromClassLoader(String, ClassLoader, boolean)
         */
        protected InputStream openStream(final String resourceName, final ClassLoader classLoader, boolean reload) throws IOException {
            InputStream stream = openStreamFromStorageLoader(resourceName);
            if (stream != null) {
                return stream;
            }
            return openStreamFromClassLoader(resourceName, classLoader, reload);
        }
        
        /**
         * Load resource bundle from {@link PlatformStorage}.
         * @param resourceName name of the resource to load 
         * @return InputStream for resource or <code>null</code> if none could be found
         * @throws IOException in case of errors
         */
        protected InputStream openStreamFromStorageLoader(final String resourceName) throws IOException {
            // load from storage
            Optional<StoragePath> path = StoragePath.tryParse(resourceName);
            if (path.isPresent()) {
                StoragePath resourceBundlePath = ObjectKind.I18N.resolve(path.get());
                logger.trace("trying to load I18n resource bundle {} from {}", resourceName, resourceBundlePath);
                Optional<PlatformStorage.FindResult> resource = platformStorage.findObject(resourceBundlePath);
    
                if (resource.isPresent()) {
                    StorageLocation location = resource.get().getRecord().getLocation();
                    logger.debug("loading I18n resource bundle {} from {} in {}", resourceName, resourceBundlePath, location.getStorage());
                    return location.readContent();
                }
            }
            return null;
        }
        
        /**
         * Load resource bundle from the provided {@link ClassLoader}.
         * 
         * @param resourceName name of the resource to load
         * @param classLoader the <code>ClassLoader</code> to use to load the bundle
         * @param reload the flag to indicate bundle reloading; <code>true</code>
         *        if reloading an expired resource bundle, <code>false</code> otherwise
         * @return the resource bundle instance or <code>null</code> if none could be found
         * @throws IOException
         */
        protected InputStream openStreamFromClassLoader(final String resourceName, final ClassLoader classLoader, boolean reload) throws IOException {
            logger.trace("trying to load I18n resource bundle {} from classpath", resourceName);
            // logic copied from base class implementation
            // (ResourceBundle.Control.newBundle(String, Locale, String, ClassLoader, boolean))
            if (reload) {
                URL url = classLoader.getResource(resourceName);
                if (url != null) {
                    URLConnection connection = url.openConnection();
                    if (connection != null) {
                        // Disable caches to get fresh data for reloading.
                        connection.setUseCaches(false);
                        logger.debug("loading I18n resource bundle {} from classpath");
                        return connection.getInputStream();
                    }
                }
            } else {
                return classLoader.getResourceAsStream(resourceName);
            }
            return null;
        }
    }

    /**
     * {@link PlatformCache} implementation for {@link I18nHelperSource}.
     * 
     * <p>
     * This is implemented as a separate class, as otherwise Handlebars registers
     * the public {@link PlatformCache#invalidate()} methods as helpers.
     * </p>
     */
    protected class I18nHelperSourceCache implements PlatformCache {
        @Override
        public void invalidate() {
            // clear I18n bundle caches (note: this is by class loader)
            ResourceBundle.clearCache(getApplicationClassLoader());
            // reset fallback locale based on configured preferred language
            setFallbackLocale(getSystemPreferredLocale(config));
        }

        @Override
        public void invalidate(Set<IRI> iris) {
            // The main point of implementing PlatformCache is to allow cache invalidation
            // via the Admin:CacheInvalidation UI, but this is not related to any specific
            // IRI, hence this method is silently ignored
        }

        @Override
        public String getId() {
            // cache id
            return CACHE_ID;
        }
    }
}
