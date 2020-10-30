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

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;

import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.junit.Assert;
import org.junit.Test;

import com.google.inject.Injector;
import com.metaphacts.config.ConfigParameterValueInfo;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameterHook;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.util.ReflectionUtil;

public class ConfigurationGroupBaseTest extends AbstractIntegrationTest {

    @Inject
    private PlatformStorage platformStorage;

    @Inject
    Injector injector;

    @Test
    public void testSimple() throws Exception {

        MyTestConfiguration config = createConfiguration();

        Map<String, ConfigParameterValueInfo> allConfigs = config.getAllParametersInfo();

        Assert.assertTrue(allConfigs.containsKey("testString"));
        ConfigParameterValueInfo v = allConfigs.get("testString");
        Assert.assertEquals("Hello World", v.getValue());
    }

    @Test
    public void testParamNameFromAnnotation() throws Exception {
        MyTestConfiguration config = createConfiguration();

        Map<String, ConfigParameterValueInfo> allConfigs = config.getAllParametersInfo();

        ConfigParameterValueInfo v = allConfigs.get("newParameter");
        Assert.assertEquals("New Parameter", v.getValue());
    }

    @Test
    public void testLegacy() throws Exception {

        MyTestConfiguration config = createConfiguration();

        Map<String, ConfigParameterValueInfo> allConfigs = config.getAllParametersInfo();

        ConfigParameterValueInfo v = allConfigs.get("legacyParameter");
        Assert.assertEquals("Legacy Parameter", v.getValue());

        ConfigParameterValueInfo v2 = allConfigs.get("legacyBoolean");
        Assert.assertEquals(true, v2.getValue());
    }

    @Test
    public void testSetParameter() throws Exception {

        MyTestConfiguration config = createConfiguration();
        config.setParameter("test.String", Arrays.asList("Updated Value"), "runtime");

        Map<String, ConfigParameterValueInfo> allConfigs = config.getAllParametersInfo();
        ConfigParameterValueInfo v = allConfigs.get("test.String");

        Assert.assertEquals("Updated Value", v.getValue());
    }

    @Test
    public void testConfigurationParameterHook() throws Exception {

        MyTestConfiguration config = createConfiguration();
        config.setParameter("testString", Arrays.asList("Updated Value"), "runtime");

        Assert.assertEquals("Updated Value", config.getTestString());
        Assert.assertEquals("[Updated Value]", config.updateHookValue);

    }

    @Test
    public void testConfigurationParameterNameExistsForCacheConfiguration() {
        for (Method method : ReflectionUtil.findMethodsWithAnnotation(CacheConfiguration.class,
                ConfigurationParameter.class)) {

            validateNameInConfigurationParameter(method);
        }
    }

    @Test
    public void testConfigurationParameterNameExistsForDataQualityConfiguration() {
        for (Method method : ReflectionUtil.findMethodsWithAnnotation(DataQualityConfiguration.class,
                ConfigurationParameter.class)) {

            validateNameInConfigurationParameter(method);
        }
    }

    @Test
    public void testConfigurationParameterNameExistsForUIConfiguration() {
        for (Method method : ReflectionUtil.findMethodsWithAnnotation(UIConfiguration.class,
                ConfigurationParameter.class)) {

            validateNameInConfigurationParameter(method);
        }
    }

    @Test
    public void testConfigurationParameterNameExistsForGlobalConfiguration() {
        for (Method method : ReflectionUtil.findMethodsWithAnnotation(GlobalConfiguration.class,
                ConfigurationParameter.class)) {

            validateNameInConfigurationParameter(method);
        }
    }

    @Test
    public void testConfigurationParameterNameExistsForEnvironmentConfiguration() {
        for (Method method : ReflectionUtil.findMethodsWithAnnotation(EnvironmentConfiguration.class,
                ConfigurationParameter.class)) {

            validateNameInConfigurationParameter(method);
        }
    }

    protected void validateNameInConfigurationParameter(Method method) {

        ConfigurationParameter configParameter = method.getAnnotation(ConfigurationParameter.class);
        Assert.assertFalse(
                "No name defined in ConfigurationParameter for method " + method,
                configParameter.name().equals(""));
    }

    protected MyTestConfiguration createConfiguration() throws InvalidConfigurationException {
        MyTestConfiguration res = new MyTestConfiguration("myTestConfig", "Test configuration", platformStorage);
        injector.injectMembers(res);
        return res;
    }

    static class MyTestConfiguration extends ConfigurationGroupBase {

        protected String updateHookValue = null;

        public MyTestConfiguration(String id, String description, PlatformStorage platformStorage)
                throws InvalidConfigurationException {
            super(id, description, platformStorage);
        }

        @Override
        public void assertConsistency() {
        }

        @ConfigurationParameter(name = "testString")
        public String getTestString() {
            return getString("testString", "Hello World");
        }

        @ConfigurationParameter(name = "newParameter")
        public String newParameter() {
            // method name does not need to follow get pattern
            return getString("newParameter", "New Parameter");
        }

        @ConfigurationParameter
        public String getLegacyParameter() {
            // name of the parameter is extracted from the method name
            return getString("legacyParameter", "Legacy Parameter");
        }

        @ConfigurationParameter
        public boolean isLegacyBoolean() {
            // name of the parameter is extracted from the method name
            return getBoolean("legacyBoolean", true);
        }

        @ConfigurationParameter(name = "test.String")
        public String getValueWithPrefixInAnnotation() {
            return getString("test.String", "Existing old value");
        }
        
        @ConfigurationParameterHook(forSetting = "testString")
        public void onUpdateTestString(String configIdInGroup, List<String> configValues,
                PropertiesConfiguration targetConfig) throws ConfigurationException {

            updateHookValue = configValues.toString();
        }
    }
}
