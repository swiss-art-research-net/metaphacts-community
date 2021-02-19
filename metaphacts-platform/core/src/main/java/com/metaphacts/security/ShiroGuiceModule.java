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
package com.metaphacts.security;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;

import javax.inject.Singleton;
import javax.servlet.Filter;
import javax.servlet.ServletContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.config.ConfigurationException;
import org.apache.shiro.guice.web.ShiroWebModule;
import org.apache.shiro.web.mgt.WebSecurityManager;

import com.google.common.collect.Lists;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.binder.AnnotatedBindingBuilder;
import com.google.inject.name.Names;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.security.sso.SSOCallbackFilter;
import com.metaphacts.security.sso.SSOLogoutFilter;
import com.metaphacts.security.sso.SSOSecurityFilter;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * @author Artem Kozlov {@literal <ak@metaphacts.com>}
 * @author Johannes Trame {@literal <jt@metaphacts.com>}
 */
public class ShiroGuiceModule extends ShiroWebModule {

    private static Logger logger = LogManager.getLogger(ShiroGuiceModule.class);

    public static final String LOGIN_PATH = "/login";

    private Injector coreInjector;

    public ShiroGuiceModule(ServletContext servletContext, Injector corePlatformInjector) {
        super(servletContext);
        this.coreInjector = corePlatformInjector;
    }


    @Override
    protected void configureShiroWeb() {

        Configuration config = this.coreInjector.getInstance(com.metaphacts.config.Configuration.class);
        bindConstant().annotatedWith(Names.named("shiro.successUrl")).to("/");

        // note: we can't set the session timeout here, but need to do that using the MetaphactsSecurityManager,
        //       which brings its own session manager (in which we change the global timeout)
        addFilterChain("/assets/no_auth/**", ANON);

        // supplied for use as a default "you have been logged out" page in SSO setups.
        addFilterChain("/logged-out/**", ANON);

        // these need to be anon access for tableau
        addFilterChain("/assets/api-commons-*-bundle.js", ANON);
        addFilterChain("/assets/tableau-*-bundle.js", ANON);
        addFilterChain("/tableau", ANON);
        addFilterChain("/tableau/isAnonymousEnabled", ANON);

        configureRealmBindings(config);

        addFilterChain("/favicon.ico", ANON);
        addFilterChain("/metaphacts/branding/metaphacts-logo.png", ANON);

        Key<? extends Filter>[] filters = null;
        try {
            filters = getFiltersFromConfig();
            logger.info("Adding authentication filters to filter chain: " + Arrays.toString(filters));
        } catch (Exception e) {
            logger.fatal("Critical error while configuring the shiro authentication filter: " + e.getMessage());
            /*
             * STOP SERVLET CONFIGURATION AND START-UP
             * If there are exceptions in getting the (correct
             * order of) filters from the config, this might be a serious security issue and such we
             * prevent from further start-up.
             */
            System.exit(78); // 78 = /* configuration error */
        }

        addFilterChain("/**", filters);
    }

    protected void configureRealmBindings(Configuration config) {
        if (config.getEnvironmentConfig().getSecurityConfig(SecurityConfigType.ShiroLDAPConfig).exists()) {
            addLocalLogin(config);
            bindRealm().toProvider(LDAPRealmProvider.class).in(Singleton.class);
            addFilterChain("/logout", LOGOUT);
        } else {
            bindLocalUsersRealm();
            addDefaultLoginPage();
            addFilterChain("/logout", LOGOUT);
        }
    }

    protected void addDefaultLoginPage() {
        bindConstant().annotatedWith(Names.named("authc.loginUrl")).to(LOGIN_PATH);
        addFilterChain(LOGIN_PATH, Key.get(FormLogoutLoginFilter.class), ShiroFilter.authc.getFilterKey());
    }

    protected void addLocalLogin(Configuration config) {
        if (config.getEnvironmentConfig().isEnableLocalUsers()) {
            bindLocalUsersRealm();
        }

        addDefaultLoginPage();
    }

    protected void bindLocalUsersRealm() {
        bindRealm().toProvider(ShiroRealmProvider.class).in(Singleton.class);
    }

    @Override
    protected void bindWebSecurityManager(final AnnotatedBindingBuilder<? super WebSecurityManager>  bind) {
        try {
            bind.toConstructor(MetaphactsSecurityManager.class.getConstructor(Collection.class, Configuration.class,
                    CacheManager.class, PlatformStorage.class)).asEagerSingleton();
        } catch (NoSuchMethodException e) {
            throw new ConfigurationException("This is a serious configuration error while setting up the ShiroModule", e);
        }
    }

    private Key<? extends Filter>[] getFiltersFromConfig(){
        List<Key<? extends Filter>> filters = Lists.newArrayList();
        for(String strFilter : this.coreInjector.getInstance(Configuration.class).getEnvironmentConfig().getShiroAuthenticationFilter()){
            try{
                ShiroFilter filterKey = ShiroFilter.valueOf(strFilter);
                filters.add(filterKey.getFilterKey() );
            }catch(Exception e){
                throw new IllegalStateException("Authentication filter "+strFilter+" no known. Please choose any of: "+Lists.newArrayList(ShiroFilter.values()));
            }
        }
        if(filters.isEmpty()){
            throw new IllegalStateException("No authentication filter specified. Please choose any of: "+Lists.newArrayList(ShiroFilter.values()));
        }else if(filters.size() == 1 && filters.get(0) == ShiroFilter.authcBasic.getFilterKey()){
            throw new IllegalStateException("Only \"authcBasic\" filter specified. \"authcBasic\" filter MUST be combined with at least another (session based) authentication filter.");
        }else if(filters.contains(ShiroFilter.authcBasic.getFilterKey()) && filters.get(0) != ShiroFilter.authcBasic.getFilterKey()){
            // here we only log a warning, this is actually not an critical error, however, certainly not what has been intended
            logger.warn("\"authcBasic\" filter should be applied as first filter in the filter chain.");
        }

        @SuppressWarnings("unchecked")
        Key<? extends Filter>[] ar = new Key[filters.size()];

        return filters.toArray(ar);
    }

    public enum ShiroFilter {
        authc(FormAuthenticationFilter.class),
        anon(AnonymousUserFilter.class),
        authcBasic(OptionalBasicAuthFilter.class),

        oauth2(SSOSecurityFilter.class),
        saml2(SSOSecurityFilter.class),
        jwt(SSOSecurityFilter.class),
        sso(SSOSecurityFilter.class),
        ssoLogout(SSOLogoutFilter.class),
        ssoCallback(SSOCallbackFilter.class);



        private Key<? extends javax.servlet.Filter> filterKey ;

        ShiroFilter(Class<? extends Filter> filterClass){
            this.filterKey = Key.get(filterClass);
        }

        public Key<? extends Filter> getFilterKey(){
            return this.filterKey;
        }
    }

}
