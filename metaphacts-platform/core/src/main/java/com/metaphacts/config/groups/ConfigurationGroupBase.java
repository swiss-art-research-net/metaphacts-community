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
package com.metaphacts.config.groups;

import java.beans.PropertyDescriptor;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;
import javax.inject.Inject;

import org.apache.commons.configuration2.CombinedConfiguration;
import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.io.output.ByteArrayOutputStream;
import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.ConfigParameterValueInfo;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameterHook;
import com.metaphacts.config.ConfigurationUtil;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.util.ReflectionUtil;


/**
 * Base class providing common functionality for the {@link ConfigurationGroup}
 * interface. This includes locating the file (based on the backing file type,
 * but prospectively also other metadata such as a list of lookup directories),
 * loading it into a backing apache commons configuration object, and providing
 * generic lookup (and, prospectively, serialization) capabilities.
 * 
 * The way this works is that the {@link ConfigurationGroupBase} objects contains
 * a {@link FileBasedConfigurationBuilder} as a backing object, to which it
 * delegates.
 *  
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public abstract class ConfigurationGroupBase implements ConfigurationGroup {

    private static final Logger logger =  LogManager.getLogger(ConfigurationGroupBase.class);
    
    /**
     * ID of the configuration group
     */
    private final String id;
    
    /**
     * Description of the configuration group
     */
    private final String description;

    protected final PlatformStorage platformStorage;
    
    @Inject
    protected CacheManager cacheManager;
    
    /**
     * The internal configuration
     */
    private CombinedConfiguration config;
    
    public ConfigurationGroupBase(
        String id, String description, PlatformStorage platformStorage
    ) throws InvalidConfigurationException {
        this.id = id;
        this.description = description;
        this.platformStorage = platformStorage;
        
        ////// basic consistency checking
        if (StringUtils.isEmpty(id)) {
            throw new InvalidConfigurationException(
                "Configuration group ID must not be null or empty.");
        }

        if (StringUtils.isEmpty(description)) {
            throw new InvalidConfigurationException(
                "Configuration group description must not be null or empty.");
        }

        // initialize the backing configuration object (and so the configuration group itself)
        logger.info("Loading configuration group {}", id);
        reloadConfig();

        // soundness and completeness check
        assertConsistency();
    }

    private StoragePath getObjectId() {
        return ObjectKind.CONFIG.resolve(id).addExtension(".prop");
    }

    private void reloadConfig() throws InvalidConfigurationException {
        try {
            config = ConfigurationUtil.readConfigFromStorageOverrides(platformStorage, getObjectId());
        } catch (IOException | ConfigurationException e) {
            throw new InvalidConfigurationException(e);
        }
    }
    
    @Override
    public String getId() {
        return id;
    }

    @Override
    public String getDescription() {
        return description;
    }

    /**
     * Method to be overridden in order to assert that the configuration
     * parameters are consistent. This may include checks such as value space
     * restrictions for datatypes, interdependencies between parameters, etc. 
     */
    @Override
    public abstract void assertConsistency();
    
    /**
     * Sets the property to the new value in the runtime and serializes the
     * new property value to the backing file. 
     * 
     * @param parameterName the configuration parameter name relative to the group
     * @param configValues values of the configuration
     * @param targetAppId target app ID to save configuration parameter to
     * @throws ConfigurationException 
     */
    public void setParameter(String parameterName, List<String> configValues, String targetAppId)
        throws UnknownConfigurationException {
        try {
            // the call below also checks if configuration parameter with specified name exists
            ConfigurationParameterType type = getParameterType(parameterName);
            if (configValues.size() > 1 && type != ConfigurationParameterType.STRING_LIST) {
                throw new IllegalArgumentException(
                    "Cannot set multiple values for non-list configuration parameter");
            }
            internalSetParameter(parameterName, configValues, targetAppId);
        } catch (ConfigurationException e) {
            logger.warn("Error while saving configuration: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    @Override
    public String getString(final String configIdInGroup) {
        return getString(configIdInGroup, null /* no fallback value */);
    }

    @Override
    public String getString(final String configIdInGroup, final String fallbackValue) {
        return getStringFromDelegate(configIdInGroup, fallbackValue);
    }

    @Override
    public Boolean getBoolean(final String configIdInGroup, final Boolean fallbackValue) {
        return getBooleanFromDelegate(configIdInGroup, fallbackValue);
    }

    @Override
    public Boolean getBoolean(final String configIdGroup) {
        return getBoolean(configIdGroup, null);
    }

    @Override
    public Integer getInteger(final String configIdInGroup) {
        return getInteger(configIdInGroup, null /* no fallback value */);
    }

    @Override
    public Integer getInteger(final String configIdInGroup, final Integer fallbackValue) {
        return getIntegerFromDelegate(configIdInGroup, fallbackValue);
    }

    @Override
    public List<String> getStringList(final String configIdInGroup) {
        return getStringList(configIdInGroup, null);
    }

    public List<String> getStringList(final String configIdInGroup, final List<String> fallbackValue) {
        return getStringListFromDelegate(configIdInGroup, fallbackValue);
    }

    /**
     * Internal save method of the configuration group base. Serializes the
     * saved value back to the backing file.
     * @throws ConfigurationException 
     * @throws NoSuchMethodException
     * @throws Exception 
     */
    private synchronized void internalSetParameter(
        String configIdInGroup, List<String> configValues, String targetAppId
    ) throws ConfigurationException {

        ObjectStorage storage = platformStorage.getStorage(targetAppId);

        try {
            logger.info("Saving new values: {} [at {}] -> {}", configIdInGroup, targetAppId, configValues);
            PropertiesConfiguration targetConfig =
                (PropertiesConfiguration)config.getConfiguration(targetAppId);
            if (targetConfig == null) {
                targetConfig = ConfigurationUtil.createEmptyConfig();
            }

            Object configValue = ConfigurationUtil.listAsConfigValue(configValues);
            if (configValue == null) {
                targetConfig.clearProperty(configIdInGroup);
            } else {
                checkParameterValueByUpdateHook(configIdInGroup, configValues, targetConfig);
                targetConfig.setProperty(configIdInGroup, configValue);
            }

            // in principal we could also move setProperty to the hooks itself in the future
            // and invalidate only specific caches
            cacheManager.invalidateAll();

            try (ByteArrayOutputStream content = new ByteArrayOutputStream()) {
                FileHandler handler = new FileHandler(targetConfig);
                handler.save(content);
                storage.appendObject(
                    getObjectId(),
                    platformStorage.getDefaultMetadata(),
                    content.toInputStream(),
                    content.size()
                );
            } catch (IOException e) {
                throw new ConfigurationException(e);
            }

            reloadConfig();
        } catch (InvalidConfigurationException e) {
            throw new ConfigurationException(e);
        }
    }

    private void checkParameterValueByUpdateHook(
        String configIdInGroup,
        List<String> configValues,
        PropertiesConfiguration targetConfig
    ) throws ConfigurationException {
        Method updateHook = findParameterUpdateHook(configIdInGroup);
        if (updateHook != null) {
            try {
                updateHook.invoke(this, configIdInGroup, configValues, targetConfig);
            } catch (IllegalAccessException e) {
                throw new RuntimeException(e);
            } catch (InvocationTargetException e) {
                if (e.getCause() instanceof ConfigurationException) {
                    throw (ConfigurationException) e.getCause();
                }
                throw new RuntimeException(e);
            }
        }
    }

    @Nullable
    private Method findParameterUpdateHook(String configIdInGroup) {
        
        // Look into the current configuration class for methods annotated with
        // ConfigurationParameterHook, and return the first where the parameter
        // name matches the expected config ID
        ReflectionUtil.findMethodsWithAnnotation(this.getClass(), ConfigurationParameterHook.class);

        for (Method method : ReflectionUtil.findMethodsWithAnnotation(this.getClass(),
                ConfigurationParameterHook.class)) {
            ConfigurationParameterHook configurationParameterHook = method
                    .getAnnotation(ConfigurationParameterHook.class);
            if (configurationParameterHook.forSetting().equalsIgnoreCase(configIdInGroup)) {
                return method;
            }
        }

        return null;
    }

    /**
     * Returns the string associated with the given property ID. Internal
     * helper method, not exposed to the outside. All access to system parameters
     * should go through this and sibling getTYPEInternal, as this method 
     * handles overrides via -D.config.<GroupId>.<ParamId>
     * 
     * @param configIdInGroup the parameter name relative to the group
     * @return the parameter's current value string 
     */
    private synchronized String getStringFromDelegate(String configIdInGroup, String fallbackValue) {
        String systemPropertyName = configParamToSystemParam(configIdInGroup);
        String systemPropertyVal = System.getProperty(systemPropertyName);

        if (StringUtils.isNotEmpty(systemPropertyVal)) {
            return systemPropertyVal;
        }
        return config.getString(configIdInGroup, fallbackValue);
    }

    private synchronized Boolean getBooleanFromDelegate(String configIdInGroup, Boolean fallbackValue) {
        String systemPropertyName = configParamToSystemParam(configIdInGroup);
        String systemPropertyVal = System.getProperty(systemPropertyName);

        if (StringUtils.isNotEmpty(systemPropertyVal)) {
            return Boolean.valueOf(systemPropertyVal);
        }
        // no or invalid system override for parameter resumes here:
        return config.getBoolean(configIdInGroup, fallbackValue);
    }

    /**
     * Returns the Integer associated with the given property ID. Internal
     * helper method, not exposed to the outside. All access to system parameters
     * should go through this and sibling getTYPEInternal, as this method 
     * handles overrides via -D.config.<GroupId>.<ParamId>
     * 
     * @param configIdInGroup the parameter name relative to the group
     * @return the parameter's current integer value 
     */
    private synchronized Integer getIntegerFromDelegate(String configIdInGroup, Integer fallbackValue) {
        String systemPropertyName = configParamToSystemParam(configIdInGroup);
        String systemPropertyVal = System.getProperty(systemPropertyName);

        if (StringUtils.isNotEmpty(systemPropertyVal)) {
            try {
                return Integer.valueOf(systemPropertyVal);
            } catch (NumberFormatException e) {
                logger.warn(
                    "-D parameter override for parameter " + configIdInGroup +
                    " provided, but not a valid integer: " + systemPropertyName +
                    ". Parameter override will be ignored.");
            }
        }
        // no or invalid system override for parameter resumes here:
        return config.getInteger(configIdInGroup, fallbackValue);
    }

    /**
     * Returns the string list associated with the given property ID. Internal
     * helper method, not exposed to the outside. All access to system parameters
     * should go through this and sibling getTYPEInternal, as this method 
     * handles overrides via -D.config.<GroupId>.<ParamId>
     * 
     * @param configIdInGroup the parameter name relative to the group
     * @return the parameter's current value string list
     */
    public synchronized List<String> getStringListFromDelegate(
        String configIdInGroup, List<String> fallbackValue
    ) {
        String systemPropertyName = configParamToSystemParam(configIdInGroup);
        String systemPropertyVal = System.getProperty(systemPropertyName);

        if (StringUtils.isNotEmpty(systemPropertyVal)) {
            return ConfigurationUtil.configValueAsList(systemPropertyVal);
        }

        String[] retAsArr = config.getStringArray(configIdInGroup);
        return retAsArr.length == 0 && fallbackValue != null
            ? fallbackValue : Arrays.asList(retAsArr);
    }

    
    /**
     * Converts a config parameter for the given group to its unique
     * system parameter name. More precisely, a config parameter <PARAM> in
     * group <GROUP> is referenced via config.<GROUP>.<PARAM>. Throws an
     * {@link IllegalArgumentException} if the config parameter passed in
     * is null or empty.
     * 
     * @param configParam
     * 
     * @return the associated system parameter string
     */
    private String configParamToSystemParam(final String configParam) {
        return ConfigurationUtil.configParamToSystemParam(getId(), configParam);
    }

    @Override
    public ConfigurationParameterType getParameterType(String paramName) throws UnknownConfigurationException {
        // get read method (using bean conventions)
        Method readMethod = getGetterMethod(paramName, getClass());
        if (readMethod == null) {
            throw new UnknownConfigurationException(
                "Config property \"" + paramName +
                "\" is unknown to configuration group \"" + this.getId() + "\".");
        }

        Class<?> returnType = readMethod.getReturnType();
        if (returnType.isAssignableFrom(String.class)) {
            return ConfigurationParameterType.STRING;
        } else if (returnType.isAssignableFrom(Boolean.class) || returnType.isAssignableFrom(Boolean.TYPE)) {
            return ConfigurationParameterType.BOOLEAN;
        } else if (returnType.isAssignableFrom(Integer.class) || returnType.isAssignableFrom(Integer.TYPE)) {
            return ConfigurationParameterType.INTEGER;
        } else if (returnType.isAssignableFrom(List.class)) {
            return ConfigurationParameterType.STRING_LIST;
        } else {
            // fallback parameter type
            return ConfigurationParameterType.STRING;
        }
    }

    @Override
    public synchronized ConfigParameterValueInfo getParameterInfo(
        String parameterId
    ) throws UnknownConfigurationException {
        // get read method (using bean conventions)
        Method readMethod = getGetterMethod(parameterId, getClass());
        if (readMethod == null) {
            throw new UnknownConfigurationException(
                "Config property \"" + parameterId +
                    "\" is unknown to configuration group \"" + this.getId() + "\".");
        }

        try {
            // invoke method and return result
            Object value = readMethod.invoke(this);

            ConfigurationParameterType type = getParameterType(parameterId);

            // check whether the parameter is shadowed
            String systemPropertyName = ConfigurationUtil.configParamToSystemParam(getId(), parameterId);
            boolean isShadowed = StringUtils.isNotEmpty(System.getProperty(systemPropertyName));

            List<String> definedByApps = ConfigurationUtil.getStorageIdsInOverrideOrderForParam(config, parameterId);

            ConfigurationParameter configParameter = readMethod.getAnnotation(ConfigurationParameter.class);
            if (configParameter == null) {
                configParameter = ConfigurationUtil.toConfigurationParameter(parameterId, "", true);
            }
            return new ConfigParameterValueInfo(type, value, isShadowed, definedByApps, configParameter);
        } catch (IllegalAccessException | InvocationTargetException e) {
            // this should not happen, so write some log output
            logger.warn("Exception during ID based config parameter lookup "
                + "when invoking target method '" + readMethod.getName()
                + "': " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    @Override
    public synchronized Map<String, ConfigParameterValueInfo> getAllParametersInfo() throws UnknownConfigurationException {
        Map<String, ConfigParameterValueInfo> params = new HashMap<>();

        Method[] methods = getClass().getDeclaredMethods();
        for (Method method : methods) {
            ConfigurationParameter[] configParameter = method.getAnnotationsByType(ConfigurationParameter.class);
            if (configParameter.length == 0) {
                continue;
            }
            String parameterId = configParameter[0].name();

            // legacy support: if the name is not specified in the annotation
            // infer it from the method
            if (StringUtils.isEmpty(parameterId)) {
                parameterId = getParamNameForGetter(method);
            }
            if (parameterId != null) {
                ConfigParameterValueInfo value = getParameterInfo(parameterId);
                params.put(parameterId, value);
            }
        }

        return params;
    }

    /**
     * Returns a getter for the given property.
     * 
     * <p>
     * This method tries to find a {@link Method} for the given parameter in the
     * respective class.
     * </p>
     * 
     * <p>
     * By default we inspect all methods for the {@link ConfigurationParameter}
     * annotation and compare the {@link ConfigurationParameter#name()}.
     * </p>
     * 
     * <p>
     * For legacy reasons we support resolving the Method using method name logics.
     * </p>
     * 
     * <p>
     * Note: we can's use the {@link PropertyDescriptor} here, since our classes
     * only have a setter. That's why we have custom logics to resolve getters. We
     * give priority to get over is prefixes (which is fine as long as there's only
     * one present).
     * </p>
     *
     * @return the getter name for a given
     */
    static Method getGetterMethod(String paramName, Class<?> clazz) {

        if (StringUtils.isEmpty(paramName)) {
            return null;
        }

        // TODO introduce cache to avoid reflective access for constant data

        // scan for method for annotation with the same param name
        Optional<Method> targetGetter = ReflectionUtil.findMethodsWithAnnotation(clazz, ConfigurationParameter.class)
                .stream().filter(m -> m.getAnnotation(ConfigurationParameter.class).name().equals(paramName))
                .findFirst();

        if (targetGetter.isPresent()) {
            return targetGetter.get();
        }

        // LEGACY SUPPORT

        final String capitalizedParamName = Character.toUpperCase(paramName.charAt(0)) + paramName.substring(1);

        // try "get" prefix
        Method getter = null;
        try {
            getter = clazz.getMethod("get" + capitalizedParamName);
        } catch (NoSuchMethodException e) {
            // ignore
        } catch (SecurityException e) {
            logger.warn("Security exception accessing getter for " + capitalizedParamName + ": " + e.getMessage());
        }

        if (getter == null) { // fallback: try "is" prefix
            try {
                getter = clazz.getMethod("is" + capitalizedParamName);
            } catch (NoSuchMethodException e) {
                // ignore
            } catch (SecurityException e) {
                logger.warn("Security exception accessing getter for " + capitalizedParamName + ": " + e.getMessage());
            }
        }

        if (getter == null) {
            return null; // not found
        }

        // finally check that the method has a non-void return type
        final Class<?> propertyType = getter.getReturnType();

        return propertyType == Void.TYPE ? null : getter;
    }

    /**
     * Returns the parameter name identified by the getter method.
     * 
     * @deprecated replaced with {@link ConfigurationParameter#name()} mechanism
     */
    @Deprecated
    static String getParamNameForGetter(Method method) {

        if (method == null) {
            return null;
        }

        final String name = method.getName();

        if (name.startsWith("get")) {

            final String paramName = name.substring(3);
            return Character.toLowerCase(paramName.charAt(0)) + paramName.substring(1);

        } else if (name.startsWith("is")) {

            final String paramName = name.substring(2);
            return Character.toLowerCase(paramName.charAt(0)) + paramName.substring(1);

        } else {
            logger.warn("Called getParamNameForGetter() for method not being a getter: " + name);
            return null;
        }
    }
}
