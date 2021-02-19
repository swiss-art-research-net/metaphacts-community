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

import javax.inject.Inject;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;

import org.apache.shiro.SecurityUtils;
import org.apache.shiro.session.Session;
import org.apache.shiro.subject.PrincipalCollection;
import org.apache.shiro.subject.SimplePrincipalCollection;
import org.apache.shiro.subject.Subject;
import org.apache.shiro.util.ThreadContext;
import org.apache.shiro.web.servlet.AdviceFilter;
import org.apache.shiro.web.servlet.ShiroHttpSession;

import com.metaphacts.config.Configuration;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class AnonymousUserFilter extends AdviceFilter {
    
    @Inject
    private Configuration config;
    
    public static final String ANONYMOUS_PRINCIPAL = "anonymous";
    private static final String ANONYMOUS_REALM = "platform";
    private static final String ORIGINAL_SUBJECT = AnonymousUserFilter.class.getName() + ".originalSubject";

    private Subject buildSubject(final HttpServletRequest request) {
        PrincipalCollection principals = new SimplePrincipalCollection(ANONYMOUS_PRINCIPAL,ANONYMOUS_REALM);
        ShiroHttpSession shiroSession = (ShiroHttpSession)request.getSession();
        
        // FIXME: anonymous sessions should be backed by MetaphactsSecurityManager instead
        final Session session = shiroSession.getSession();
        session.setTimeout(config.getEnvironmentConfig().getShiroSessionTimeoutSecs() * 1000 /* convert s -> ms */);
        
        return new Subject.Builder()
            .principals(principals)
            .authenticated(true)
            .session(session)
            .sessionCreationEnabled(true)
            .buildSubject();
      }

    @Override
    protected boolean preHandle(final ServletRequest request, final ServletResponse response) throws Exception {
      Subject subject = SecurityUtils.getSubject();

      if (subject.getPrincipal() == null ){
        request.setAttribute(ORIGINAL_SUBJECT, subject);
        subject = buildSubject((HttpServletRequest)request);
        ThreadContext.bind(subject);
      }

      return true;
    }

    @Override
    public void afterCompletion(final ServletRequest request, final ServletResponse response, final Exception exception)
        throws Exception
    {
      Subject subject = (Subject) request.getAttribute(ORIGINAL_SUBJECT);
      if (subject != null) {
        ThreadContext.bind(subject);
      }
    }
}