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

import java.io.*;
import java.net.URLEncoder;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.inject.Inject;
import javax.inject.Provider;
import javax.inject.Singleton;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.context.FieldValueResolver;
import com.google.common.collect.Sets;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.data.rdf.RioUtils;
import com.metaphacts.data.rdf.container.LDPImplManager;
import com.metaphacts.data.rdf.container.UserMetadataContainer;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.FromStorageLoader;
import com.metaphacts.vocabulary.LDP;

import io.buji.pac4j.subject.Pac4jPrincipal;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.subject.support.DelegatingSubject;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFParseException;
import org.pac4j.core.profile.CommonProfile;

/**
 * @author Denis Ostapenko
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@Singleton
public class SecurityService {
    private static final Logger logger = LogManager.getLogger(SecurityService.class);

    private final RioUtils rioUtils;
    private final PlatformStorage platformStorage;
    private final Provider<NamespaceRegistry> ns;

    @Inject
    public SecurityService(
        RioUtils rioUtils,
        PlatformStorage platformStorage,
        Provider<NamespaceRegistry> ns
    ) {
        this.rioUtils = rioUtils;
        this.platformStorage = platformStorage;
        this.ns = ns;
    }

    public String renderUsersMetadataToTurtle(UserMetadataProvider userMetadataProvider) throws IOException {
        class UserMetadataGroupOpts {
            public String dn;
            public String cn;
            public String dn_encoded;
            public UserMetadataGroupOpts(String dn, String cn) {
                this.dn = dn;
                this.cn = cn;
                try {
                    this.dn_encoded = URLEncoder.encode(dn, "UTF-8");
                } catch (UnsupportedEncodingException e) { }
            }
        }
        class UserMetadataOpts {
            public String USER_NAME;
            public String USER_IRI;
            public Set<UserMetadataGroupOpts> USER_GROUPS;
            public Set<String> USER_ROLES;
            public UserMetadataOpts(String userName, Set<UserMetadata.GroupProps> userGroups, Set<String> userRoles) {
                USER_NAME = userName;
                USER_IRI = "<" + ns.get().getUserIRI(userName).stringValue() + ">";
                USER_GROUPS = new HashSet<>();
                for (UserMetadata.GroupProps userGroup : userGroups) {
                    USER_GROUPS.add(new UserMetadataGroupOpts(userGroup.dn, userGroup.cn));
                }
                USER_ROLES = userRoles;
            }
        }
        List<UserMetadata> users = userMetadataProvider.getUsersMetadata();
        Template userMetadataTemplate = new Handlebars()
            .with(new FromStorageLoader(platformStorage) {
                @Override
                protected StoragePath resolveLocation(String location) {
                    return ObjectKind.CONFIG.resolve(location).addExtension(".hbs");
                }
            })
            .compile("userMetadata");
        StringBuilder response = new StringBuilder();
        for (UserMetadata user : users) {
            Object model = new UserMetadataOpts(user.name, user.groups, user.roles);
            String record = userMetadataTemplate.apply(Context.newBuilder(model).resolver(FieldValueResolver.INSTANCE).build());
            response.append(record);
        }
        return response.toString();
    }

    public void saveUsersMetadataTurtleInContainer(String turtle, MpRepositoryProvider repositoryProvider) throws Exception {
        UserMetadataContainer userMetadataContainer = (UserMetadataContainer) LDPImplManager.getLDPImplementation(
            UserMetadataContainer.IRI,
            Sets.newHashSet(LDP.Container, LDP.Resource),
            repositoryProvider
        );
        InputStream input = new ByteArrayInputStream(turtle.getBytes());
        try {
            IRI root = UserMetadataContainer.IRI_ROOT;
            Model model = rioUtils.parse(input, root.stringValue(), RDFFormat.TURTLE);
            userMetadataContainer.update(new PointedGraph(root, model));
        } catch (RDFParseException exception) {
            logger.debug("Generated from userMetadata.hbs Turtle is not valid, it will not be added to database", exception);
        }
    }
    
    public static String getUserName() {
        Object subject = SecurityUtils.getSubject();
        String userName = "unknown";
        if (subject instanceof String) {
            userName = (String) subject;
        } else if (subject instanceof DelegatingSubject) {
            Object principal = ((DelegatingSubject) subject).getPrincipal();

            if (principal instanceof Pac4jPrincipal) {
                userName = ((Pac4jPrincipal) principal).getName();
            } else if (principal instanceof String) {
                userName = (String) principal;
            }
        }
        if (StringUtils.isEmpty(userName)) {
            userName = "unknown";
        }
        return userName;
    }

    /**
     * Return additional user attributes. 
     * 
     * <p>
     * User attributes may be any additional information, e.g. first and 
     * last name, email address, etc.
     * </p>
     * <p>
     * The actually provided information depends on the underlying authentication system. 
     * </p>
     * 
     * @return map of user attributes. May be empty if there is no additional data.
     */
    public static Map<String, Object> getUserAttributes() {
        Map<String, Object> attributes = Collections.emptyMap();
        Object principal = SecurityUtils.getSubject().getPrincipal();
        if (principal instanceof Pac4jPrincipal) {
            // SSO systems supported by Pac4j typically provide additional
            // information in the corresponding user profile
            Pac4jPrincipal pac4jPrincipal = (Pac4jPrincipal) principal;
            CommonProfile profile = pac4jPrincipal.getProfile();
            Map<String, Object> attributeMap = profile.getAttributes();
            if (attributeMap != null && !attributeMap.isEmpty()) {
                // clone attribute map
                attributes = new HashMap<>(attributeMap);
            }
        }
        // open: handle LDAP and local accounts
        
        return attributes;
    }
}
