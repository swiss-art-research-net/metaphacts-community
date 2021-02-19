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

import java.nio.file.FileSystems;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.pf4j.PluginRepository;

/**
 * Plugin repository which resolves apps to load from system properties or environment variables.
 * 
 * <p>
 * Besides loading plugins from the runtime/apps/ folder the path for additional apps can also be 
 * specified using system properties starting with {@code app.}:
 * 
 * <pre>
 * -Dapp.1=path/to/some/app -Dapp.2=path/to/other/app
 * </pre>
 * 
 * </p>
 * 
 * <p>
 * In addition to system properties paths can also be specified using environment variables starting 
 * with {@code MP_APP_}:
 * 
 * <pre>
 * MP_APP_1=path/to/some/app MP_APP_2=path/to/other/app
 * </pre>
 * </p>
 * 
 * <p>
 * This allows loading apps in-place during development from arbitrary locations without copying 
 * them into a common apps folder.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class PlatformExternalPluginRepository implements PluginRepository {
    private static final Logger logger = LogManager.getLogger(PlatformExternalPluginRepository.class);
    public static final String APP_SYSPROP_PREFIX = "app.";
    public static final String APP_ENV_PREFIX = "MP_APP_";
    
    public PlatformExternalPluginRepository() {
    }

    @Override
    public List<Path> getPluginPaths() {
        List<Path> paths = new ArrayList<>();
        findAppsFromSystemProperties(paths);
        findAppsFromEnvironment(paths);
        
        return paths;
    }

    protected void findAppsFromEnvironment(List<Path> paths) {
        Map<String, String> environment = System.getenv();
        for (Map.Entry<String, String> env : environment.entrySet()) {
            String name = env.getKey();
            if (!name.startsWith(APP_ENV_PREFIX)) {
                continue;
            }
            String path = env.getValue();
            if (path == null || path.isEmpty()) {
                continue;
            }
            Optional<Path> appPath = resolveApp(path);
            appPath.ifPresent(p -> paths.add(p));
        }
    }

    protected void findAppsFromSystemProperties(List<Path> paths) {
        Properties props = System.getProperties();
        for (Map.Entry<Object, Object> prop : props.entrySet()) {
            Object key = prop.getKey();
            String name = key.toString();
            if (!name.startsWith(APP_SYSPROP_PREFIX)) {
                continue;
            }
            String path = props.getProperty(name);
            if (path == null || path.isEmpty()) {
                continue;
            }
            Optional<Path> appPath = resolveApp(path);
            appPath.ifPresent(p -> paths.add(p));
        }
    }

    protected Optional<Path> resolveApp(String path) {
        try {
            Path p = FileSystems.getDefault().getPath(path);
            if (p.toFile().exists()) {
                logger.debug("found app at {}", p);
                return Optional.of(p);
            }
            else {
                logger.debug("no such app at {}", p);
                return Optional.empty();
            }
        }
        catch (Exception e) {
            logger.warn("Failed to resolve app path {}: {}", path, e.getMessage());
            logger.debug("Details: ", e);
            return Optional.empty();
        }
    }

    @Override
    public boolean deletePluginPath(Path pluginPath) {
        // ignore
        return false;
    }

}
