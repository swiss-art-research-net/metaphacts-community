/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import java.util.Collection;
import java.util.Collections;
import java.util.function.Supplier;

import org.apache.shiro.SecurityUtils;
import org.apache.shiro.UnavailableSecurityManagerException;
import org.apache.shiro.authc.UsernamePasswordToken;
import org.apache.shiro.mgt.SecurityManager;
import org.apache.shiro.realm.Realm;
import org.apache.shiro.util.LifecycleUtils;
import org.apache.shiro.util.ThreadContext;
import org.junit.runners.model.FrameworkMethod;
import org.junit.runners.model.Statement;

import com.github.sdorra.shiro.ShiroRule;
import com.github.sdorra.shiro.SubjectAware;
import com.github.sdorra.shiro.internal.SubjectAwareDescriptor;
import com.github.sdorra.shiro.internal.SubjectAwares;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.security.MetaphactsSecurityManager;
import com.metaphacts.security.MetaphactsSecurityTestUtils;

/**
 * Extension of {@link ShiroRule} which uses {@link MetaphactsSecurityManager}
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class MetaphactsShiroRule extends ShiroRule {
    
    
    private Supplier<Configuration> configurationSupplier;

    /**
     * optional collection of realms
     */
    private Supplier<Collection<Realm>> realms;
    
    private Supplier<CacheManager> cacheManagerSupplier;

    /**
     * Note: Realm needs to be provided with {@link SubjectAware} annotation
     * 
     * @param configurationSupplier
     */
    public MetaphactsShiroRule(Supplier<Configuration> configurationSupplier) {
        this.configurationSupplier = configurationSupplier;
    }

    public MetaphactsShiroRule(String iniResourcePath, Supplier<Configuration> configurationSupplier) {
        this((Supplier<Collection<Realm>>) (() -> Collections
                .<Realm>singletonList(MetaphactsSecurityTestUtils.loadRealm(iniResourcePath))),
                configurationSupplier);
    }

    public MetaphactsShiroRule(Supplier<Collection<Realm>> realms, Supplier<Configuration> configurationSupplier) {
        this.realms = realms;
        this.configurationSupplier = configurationSupplier;
    }
    
    public MetaphactsShiroRule withCacheManager(Supplier<CacheManager> cacheManagerSupplier) {
        this.cacheManagerSupplier = cacheManagerSupplier;
        return this;
    }

    @Override
    public Statement apply(Statement base, FrameworkMethod method, Object target) {
        tearDownShiro(); // clean up whatever other tests might have left behind

        final SubjectAwareDescriptor desc = new SubjectAwareDescriptor();
        SubjectAware subjectAware = SubjectAwares.find(target);

        if (subjectAware != null) {
            desc.merge(subjectAware);
        }

        subjectAware = SubjectAwares.find(method.getAnnotations());

        if (subjectAware != null) {
            desc.merge(subjectAware);
        }

        return new Statement() {

            @Override
            public void evaluate() throws Throwable {
                before(desc);

                try {
                    base.evaluate();
                } finally {
                    tearDownShiro();
                }
            }
        };
    }

    protected void before(SubjectAwareDescriptor descriptor) {
        initializeSecurityManager(descriptor);
        loginSubject(descriptor);
    }


    private void initializeSecurityManager(SubjectAwareDescriptor subjectAware) {

        SecurityManager securityManager = null;

        // if realms are set explicitly use these
        if (realms != null) {
            securityManager = MetaphactsSecurityTestUtils.createInstance(realms.get(),
                    configurationSupplier.get(), cacheManagerSupplier.get());
        }

        if (subjectAware.isMerged()) {
            String cfg = subjectAware.getConfiguration();
            if (securityManager != null && cfg.length() > 0) {
                throw new IllegalStateException(
                        "Either realms or the SubjectAware annotation can provide the realm configuration.");
            }
    
            if (cfg.length() > 0) {
                securityManager = MetaphactsSecurityTestUtils.createInstance(cfg,
                        configurationSupplier.get(), cacheManagerSupplier.get());
            }
        }

        if (securityManager == null) {
            throw new IllegalStateException("Security manager has not been initialized");
        }

        SecurityUtils.setSecurityManager(securityManager);
    }

    private void loginSubject(SubjectAwareDescriptor subjectAware) {
        String username = subjectAware.getUsername();

        if ((username != null) && (username.length() > 0)) {
            UsernamePasswordToken token = new UsernamePasswordToken(username,
                    subjectAware.getPassword());

            SecurityUtils.getSubject().login(token);
        }
    }

    /**
     * Method description
     *
     */
    private void tearDownShiro() {
        try {
            SecurityManager securityManager = SecurityUtils.getSecurityManager();

            LifecycleUtils.destroy(securityManager);
            ThreadContext.unbindSecurityManager();
            ThreadContext.unbindSubject();
            ThreadContext.remove();
        } catch (UnavailableSecurityManagerException e) {

            // we don't care about this when cleaning up the test environment
            // (for example, maybe the subclass is a unit test and it didn't
            // need a SecurityManager instance because it was using only mock Subject instances)
        }

        SecurityUtils.setSecurityManager(null);
    }

}
