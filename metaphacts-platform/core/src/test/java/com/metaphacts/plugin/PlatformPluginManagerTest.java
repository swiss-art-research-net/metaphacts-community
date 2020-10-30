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
package com.metaphacts.plugin;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.Assert.assertThat;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.Writer;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.StringUtils;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.pf4j.CompoundPluginRepository;
import org.pf4j.PluginRepository;
import org.pf4j.PluginState;
import org.pf4j.PluginWrapper;

public class PlatformPluginManagerTest {
    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();
    
    File appsFolder;
    
    @Before
    public void setup() throws Exception {
        appsFolder = tempFolder.newFolder("apps");
    }
    
    @Test
    public void ensurePluginLoadOrder_SingleAppRepo_noDependencies() throws Exception {
        // The plugins are stored in AbstractPluginManager in a Map which has no defined order. 
        // Using random app ids this would be become obvious as they are typically not returned  
        // in the same order as they were inserted
        List<String> appIds = generateAppIds(10);
        List<App> apps = createApps(appIds);
        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(apps));
        
        List<PluginWrapper> plugins = pluginManager.getResolvedPlugins();
        List<String> pluginIds = plugins.stream().map(p -> p.getPluginId()).collect(Collectors.toList());
        assertThat("all apps should be loaded and resolved", pluginIds, containsInAnyOrder(appIds.toArray()));
    }
    
    @Test
    public void ensurePluginLoadOrder_MultipleAppRepos_noDependencies() throws Exception {
        // The plugins are stored in AbstractPluginManager in a Map which has no defined order. 
        // Using random app ids this would be become obvious as they are typically not returned  
        // in the same order as they were inserted
        List<String> appsFolderAppIds = generateAppIds(10);
        List<App> appsFolderApps = createApps(appsFolderAppIds);
        List<String> additionalAppIds = generateAppIds(2);
        List<App> additionalApps = createApps(additionalAppIds);
        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(appsFolderApps), fromApps(additionalApps));
        
        List<String> appIds = new ArrayList<>(appsFolderAppIds);
        appIds.addAll(additionalAppIds);
        
        List<PluginWrapper> plugins = pluginManager.getResolvedPlugins();
        List<String> pluginIds = plugins.stream().map(p -> p.getPluginId()).collect(Collectors.toList());
        assertThat("all apps should be loaded and resolved", pluginIds, containsInAnyOrder(appIds.toArray()));
    }
    
    @Test
    public void ensurePluginLoadOrder_SingleAppRepo_withDependencies() throws Exception {
        List<String> appIds = generateAppIds(10);
        List<App> apps = createApps(appIds);
        
        App app1 = apps.get(1);
        App app2 = apps.get(2);
        App app3 = apps.get(3);
        App app4 = apps.get(4);
        App app5 = apps.get(5);
        App app6 = apps.get(6);
        App app7 = apps.get(7);
        App app8 = apps.get(8);
        App app9 = apps.get(9);
        
        defineAppDependency(app5, app7, app3);
        defineAppDependency(app8, app1);
        defineAppDependency(app2, app4);
        defineAppDependency(app9, app1, app2, app3, app4, app5, app6, app7);
        defineAppDependency(app8, app9);
        
        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(apps));
        List<PluginWrapper> plugins = pluginManager.getResolvedPlugins();
        List<String> pluginIds = plugins.stream().map(p -> p.getPluginId()).collect(Collectors.toList());
        
        int app1Index = pluginIds.indexOf(app1.getAppId());
        int app2Index = pluginIds.indexOf(app2.getAppId());
        int app3Index = pluginIds.indexOf(app3.getAppId());
        int app4Index = pluginIds.indexOf(app4.getAppId());
        int app5Index = pluginIds.indexOf(app5.getAppId());
        int app6Index = pluginIds.indexOf(app6.getAppId());
        int app7Index = pluginIds.indexOf(app7.getAppId());
        int app8Index = pluginIds.indexOf(app8.getAppId());
        int app9Index = pluginIds.indexOf(app9.getAppId());
        
        assertThat("app 8 should come after app 1", app8Index, greaterThan(app1Index));
        assertThat("app 5 should come after app 7", app5Index, greaterThan(app7Index));
        assertThat("app 5 should come after app 3", app5Index, greaterThan(app3Index));
        
        assertThat("app 9 should come after app 1", app9Index, greaterThan(app1Index));
        assertThat("app 9 should come after app 2", app9Index, greaterThan(app2Index));
        assertThat("app 9 should come after app 3", app9Index, greaterThan(app3Index));
        assertThat("app 9 should come after app 4", app9Index, greaterThan(app4Index));
        assertThat("app 9 should come after app 5", app9Index, greaterThan(app5Index));
        assertThat("app 9 should come after app 6", app9Index, greaterThan(app6Index));
        assertThat("app 9 should come after app 7", app9Index, greaterThan(app7Index));
        
        assertThat("app 8 should come after app 1", app8Index, greaterThan(app1Index));
        assertThat("app 8 should come after app 2", app8Index, greaterThan(app2Index));
        assertThat("app 8 should come after app 3", app8Index, greaterThan(app3Index));
        assertThat("app 8 should come after app 4", app8Index, greaterThan(app4Index));
        assertThat("app 8 should come after app 5", app8Index, greaterThan(app5Index));
        assertThat("app 8 should come after app 6", app8Index, greaterThan(app6Index));
        assertThat("app 8 should come after app 7", app8Index, greaterThan(app7Index));
        assertThat("app 8 should come after app 9", app8Index, greaterThan(app9Index));
    }
    
    @Test
    public void ensurePluginLoadOrder_SingleAppRepo_cyclicDependencies() throws Exception {
        List<String> appIds = generateAppIds(3);
        List<App> apps = createApps(appIds);
        
        App app1 = apps.get(0);
        App app2 = apps.get(1);
        //App app3 = apps.get(2);

        // define cyclic dependency between apps 1 and 3
        defineAppDependency(app1, app2);
        defineAppDependency(app2, app1);

        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(apps));
        
        // check resolved plugins
        List<PluginWrapper> allPlugins = pluginManager.getPlugins();
        List<PluginWrapper> resolvedPlugins = pluginManager.getResolvedPlugins();
        List<PluginWrapper> unresolvedPlugins = pluginManager.getUnresolvedPlugins();
        
        assertThat("there should be three apps in total", allPlugins.size(), is(3));
        assertThat("there should be no resolved apps", resolvedPlugins.size(), is(0));
        assertThat("there should be three unresolved apps", unresolvedPlugins.size(), is(3));
    }
    
    @Test
    public void ensurePluginLoadOrder_SingleAppRepo_unsatisfiedDependencies() throws Exception {
        List<String> appIds = generateAppIds(3);
        List<App> apps = createApps(appIds);
        
        App app1 = apps.get(0);
        App app2 = apps.get(1);
        App app3 = apps.get(2);
        // non-existing app
        App app4 = createApp("app4", false);

        // define dependencies between apps
        defineAppDependency(app1, app2);
        defineAppDependency(app3, app4);

        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(apps));
        
        // check resolved plugins
        List<PluginWrapper> allPlugins = pluginManager.getPlugins();
        List<PluginWrapper> resolvedPlugins = pluginManager.getResolvedPlugins();
        List<PluginWrapper> unresolvedPlugins = pluginManager.getUnresolvedPlugins();
        
        assertThat("there should be three apps in total", allPlugins.size(), is(3));
        assertThat("there should be two resolved apps", resolvedPlugins.size(), is(0));
        assertThat("there should be one unresolved app", unresolvedPlugins.size(), is(3));
        
        PluginWrapper plugin1 = pluginManager.getPlugin(app1.getAppId());
        PluginWrapper plugin2 = pluginManager.getPlugin(app2.getAppId());
        PluginWrapper plugin3 = pluginManager.getPlugin(app3.getAppId());
        PluginWrapper plugin4 = pluginManager.getPlugin(app4.getAppId());
        
        assertThat("app1 should be created", plugin1.getPluginState(), is(PluginState.CREATED));
        assertThat("app2 should be created", plugin2.getPluginState(), is(PluginState.CREATED));
        assertThat("app3 should be created", plugin3.getPluginState(), is(PluginState.CREATED));
        assertThat("app4 should not exist", plugin4, nullValue());
        
        // start plugins
        pluginManager.startPlugins();
        
        assertThat("app1 should be created", plugin1.getPluginState(), is(PluginState.CREATED));
        assertThat("app2 should be created", plugin2.getPluginState(), is(PluginState.CREATED));
        assertThat("app3 should be created", plugin3.getPluginState(), is(PluginState.CREATED));
    }
    
    @Test
    public void ensurePluginLoadOrder_SingleAppRepo_simpleDependencies() throws Exception {
        List<String> appIds = generateAppIds(3);
        List<App> apps = createApps(appIds);
        
        App app1 = apps.get(0);
        App app2 = apps.get(1);
        App app3 = apps.get(2);

        // define dependencies between apps
        defineAppDependency(app1, app2);
        defineAppDependency(app2, app3);

        PlatformPluginManager pluginManager = createPluginManagerForApps(fromApps(apps));
        
        // check resolved plugins
        List<PluginWrapper> allPlugins = pluginManager.getPlugins();
        List<PluginWrapper> resolvedPlugins = pluginManager.getResolvedPlugins();
        List<PluginWrapper> unresolvedPlugins = pluginManager.getUnresolvedPlugins();
        
        assertThat("there should be three apps in total", allPlugins.size(), is(3));
        assertThat("there should be two resolved apps", resolvedPlugins.size(), is(3));
        assertThat("there should be one unresolved app", unresolvedPlugins.size(), is(0));
        
        PluginWrapper plugin1 = pluginManager.getPlugin(app1.getAppId());
        PluginWrapper plugin2 = pluginManager.getPlugin(app2.getAppId());
        PluginWrapper plugin3 = pluginManager.getPlugin(app3.getAppId());
        
        assertThat("app1 should be resolved", plugin1.getPluginState(), is(PluginState.RESOLVED));
        assertThat("app2 should be resolved", plugin2.getPluginState(), is(PluginState.RESOLVED));
        assertThat("app3 should be resolved", plugin3.getPluginState(), is(PluginState.RESOLVED));
        
        // start plugins
        pluginManager.startPlugins();
        
        assertThat("app1 should be started", plugin1.getPluginState(), is(PluginState.STARTED));
        assertThat("app2 should be started", plugin2.getPluginState(), is(PluginState.STARTED));
        assertThat("app3 should be disstartedabled", plugin3.getPluginState(), is(PluginState.STARTED));
        
        // check order
        List<String> pluginIds = resolvedPlugins.stream().map(p -> p.getPluginId()).collect(Collectors.toList());
        
        int app1Index = pluginIds.indexOf(app1.getAppId());
        int app2Index = pluginIds.indexOf(app2.getAppId());
        int app3Index = pluginIds.indexOf(app3.getAppId());
        
        assertThat("app 1 should come after app 2", app1Index, greaterThan(app2Index));
        assertThat("app 2 should come after app 3", app2Index, greaterThan(app3Index));
        assertThat("app 1 should come after app 3", app1Index, greaterThan(app3Index));
    }
    
    protected void defineAppDependency(App app, App... appDependencies) throws Exception {
        // generate list of app dependencies
        List<String> appDependencyId = Arrays.asList(appDependencies).stream().map(a -> a.getAppId()).collect(Collectors.toList());
        String appIds = StringUtils.join(appDependencyId, ",");
        // update manifest
        app.getPluginProperties().setProperty("plugin.dependencies", appIds);
        // write manifest to app folder
        writeAppManifest(app);
    }

    protected File getAppsFolder() {
        return appsFolder;
    }
    
    protected App createApp(String appId) throws Exception {
        return createApp(appId, true);
    }
    
    protected App createApp(String appId, boolean persist) throws Exception {
        File appFolder = new File(appsFolder, appId);
        if (persist) {
            appFolder.mkdirs();
        }
        Properties props = new Properties();
        props.setProperty("plugin.id", appId);
        props.setProperty("plugin.provider", "Metaphacts");
        props.setProperty("plugin.version", "1.0.0");
        //props.setProperty("plugin.class", Plugin.class.getName());
        
        App app = new App(appId, appFolder.toPath(), props);
        if (persist) {
            writeAppManifest(app);
        }
        return app;
    }
    
    protected void writeAppManifest(App app) throws IOException {
        writeAppManifest(app.getPath(), app.getAppId(), app.getPluginProperties());
    }

    protected void writeAppManifest(Path appFolder, String appId, Properties props) throws IOException {
        File appManifest = new File(appFolder.toFile(), "plugin.properties");
        try (Writer out = new FileWriter(appManifest)) {
            props.store(out, "manifest for app " + appId);
        }
    }
    
    protected List<App> createApps(String... appIds) throws Exception {
        return createApps(Arrays.asList(appIds));
    }
    
    protected List<App> createApps(List<String> appIds) throws Exception {
        List<App> apps = new ArrayList<>();
        for (String appId : appIds) {
            apps.add(createApp(appId));
        }
        return apps;
    }
    
    /**
     * Generate random app ids
     * @param count number of app ids to generate
     * @return list of app ids
     */
    protected List<String> generateAppIds(int count) {
        return IntStream.rangeClosed(1, count)
            .mapToObj(i -> RandomStringUtils.randomAlphanumeric(10))
            .collect(Collectors.toList());
    }
    
    protected PlatformPluginManager createPluginManagerForApps(PluginRepository... appRepos) {
        return new PlatformPluginManager(getAppsFolder().toPath()) {
            @Override
            protected PluginRepository createPluginRepository() {
                CompoundPluginRepository compoundPluginRepository = new CompoundPluginRepository();
                for (PluginRepository appRepo : appRepos) {
                    compoundPluginRepository.add(appRepo);
                }
                return compoundPluginRepository;
            }
        };
    }
    
    protected static PluginRepository fromApps(List<App> apps) {
        List<Path> appPaths = apps.stream().map(a -> a.getPath()).collect(Collectors.toList());
        return new ListPluginRepository(appPaths);
    }
    
    public static class ListPluginRepository implements PluginRepository {
        private final List<Path> pluginPaths;
        

        public ListPluginRepository(List<Path> pluginPaths) {
            this.pluginPaths = pluginPaths;
        }

        @Override
        public List<Path> getPluginPaths() {
            return pluginPaths;
        }

        @Override
        public boolean deletePluginPath(Path pluginPath) {
            return false;
        }
    }
    
    public static class App {
        private final String appId;
        private final Path path;
        private final Properties pluginProperties;

        public App(String appId, Path path, Properties pluginProperties) {
            this.appId = appId;
            this.path = path;
            this.pluginProperties = pluginProperties;
        }
        
        public String getAppId() {
            return appId;
        }
        
        public Path getPath() {
            return path;
        }
        
        public Properties getPluginProperties() {
            return pluginProperties;
        }
    }
}
