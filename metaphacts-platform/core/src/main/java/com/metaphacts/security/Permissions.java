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

package com.metaphacts.security;

import org.eclipse.rdf4j.model.IRI;

import com.metaphacts.api.sparql.SparqlUtil.SparqlOperation;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class Permissions {
    public enum APIUsageMode { read, write }

    /**
     * Utility methods for configuration permissions
     *
     * @author Michael Schmidt <ms@metaphacts.com>
     */
    public static class CONFIGURATION {
        /**
         * Returns the required permission string for using the API in usageMode.
         * This is a SHIRO permission string of the following form:
         * api:<configGroup>:<configIdInGroup>:[read|write].
         */
        public static String getPermissionString(
            String configGroup, String configIdInGroup, APIUsageMode usageMode
        ) {
            return "api:config:" + configGroup + ":" + configIdInGroup + ":" + usageMode;
        }
    }

    public static class PAGES{
        public static enum Action {
            EDIT_VIEW("edit:view"), 
            EDIT_SAVE("edit:save"),
            INFO_EXPORT("info:export"),
            INFO_VIEW("info:view"),
            INFO_DELETE("info:delete"),
            VIEW("view");
            
            final String action;
            
            private Action(String action) {
                this.action = action;
            }

            @Override
            public String toString() {
                return action;
            }
        }
        
        public static final String DOMAIN = "pages";
        private static final String PREFIX = DOMAIN + ":";
        
        public static String templateOperationDefaultPermission(Action action) {
            return PREFIX + action.toString();
        }
        
        public static String templateOperationPermission(IRI iri, Action action) {
            return PREFIX + action.toString() + ":<" + iri.stringValue() + ">";
        }
    }

    public static class ACCOUNTS{
        // right to query account informations
        public static final String QUERY = "accounts:users:query";
        // right to create new accounts
        public static final String CREATE = "accounts:users:create";
        // right to delete accounts
        public static final String DELETE = "accounts:users:delete";
        // right to query LDAP users metadata
        public static final String LDAP_SYNC = "accounts:ldap:sync";
    }

    public static class PERMISSIONS{
        // right to query permissions for others
        public static final String QUERY = "accounts:permissions:query";
        // right to assign permissions to users
        public static final String ASSIGN_TO_USERS = "accounts:permissions:assign:user";
        // right to assign permissions to roles
        public static final String ASSIGN_TO_ROLES = "accounts:permissions:assign:roles";
    }

    public static class ROLES{
        public static final String QUERY = "accounts:roles:query";
        // right to create new roles
        public static final String CREATE = "accounts:roles:create";
        // right to assign roles to user
        public static final String ASSIGN_TO_USER = "accounts:roles:assign";
    }

    public static class NAMESPACES{
        public static final String DELETE = "namespaces:delete";
        public static final String CREATE = "namespaces:create";
        public static final String CHANGE = "namespaces:change";
    }

    public static class SPARQL{
        public static final String PREFIX = "sparql:";
        public static final String QUERY_SELECT_POSTFIX = "query:select";
        public static final String QUERY_ASK_POSTFIX = "query:ask";
        public static final String QUERY_DESCRIBE_POSTFIX = "query:describe";
        public static final String QUERY_CONSTRUCT_POSTFIX = "query:construct";
        public static final String UPDATE_POSTFIX = "update";
        
        private static final String QUERY_SELECT_DEFAULT = PREFIX + QUERY_SELECT_POSTFIX;
        private static final String QUERY_ASK_DEFAULT = PREFIX + QUERY_ASK_POSTFIX;
        private static final String QUERY_DESCRIBE_DEFAULT = PREFIX + QUERY_DESCRIBE_POSTFIX;
        private static final String QUERY_CONSTRUCT_DEFAULT = PREFIX + QUERY_CONSTRUCT_POSTFIX;
        private static final String UPDATE_DEFAULT = PREFIX + UPDATE_POSTFIX;

        public static final String sparqlOperationPermission(String repositoryId, SparqlOperation operationType) {
            StringBuilder builder = new StringBuilder(PREFIX);
            builder.append(repositoryId);
            builder.append(":");
            switch (operationType) {
                case CONSTRUCT:
                    builder.append(QUERY_CONSTRUCT_POSTFIX);
                    break;
                case SELECT:
                    builder.append(QUERY_SELECT_POSTFIX);
                    break;
                case ASK:
                    builder.append(QUERY_ASK_POSTFIX);
                    break;
                case DESCRIBE:
                    builder.append(QUERY_DESCRIBE_POSTFIX);
                    break;
                case UPDATE:
                    builder.append(UPDATE_POSTFIX);
                    break;
                default:
                    throw new IllegalArgumentException("Unknown operation type " + operationType.toString());
            }
            return builder.toString();
        }
        
        public static final String sparqlOperationDefaultPermission(SparqlOperation operationType) {
            switch (operationType) {
                case CONSTRUCT:
                    return QUERY_CONSTRUCT_DEFAULT;
                case SELECT:
                    return QUERY_SELECT_DEFAULT;
                case ASK:
                    return QUERY_ASK_DEFAULT;
                case DESCRIBE:
                    return QUERY_DESCRIBE_DEFAULT;
                case UPDATE:
                    return UPDATE_DEFAULT;
                default:
                    throw new IllegalArgumentException("Unknown operation type " + operationType.toString());
            }
        }
        
        public static final String GRAPH_STORE_HEAD = "sparql:graphstore:head";
        public static final String GRAPH_STORE_GET = "sparql:graphstore:get";
        public static final String GRAPH_STORE_CREATE = "sparql:graphstore:create";
        public static final String GRAPH_STORE_UPDATE = "sparql:graphstore:update";
        public static final String GRAPH_STORE_DELETE = "sparql:graphstore:delete";
    }

    public static class CONTAINER {
        /**
         * Helper to build LDP Container/Resource permission strings:
         *
         * api:ldp:container|type:<container_iri|type>:create|update|delete:any|owner
         *
         * @param resource IRI of the LDPResource or LDPContainer resource in case of
         *                 identity based permission or type IRI in case of type based permission
         * @param base {@link CONTAINER#IDENTITY_BASED} or {@link CONTAINER#TYPE_BASED}}
         * @param action {@link CONTAINER#CREATE} or {@link CONTAINER#UPDATE} or
         *   {@link CONTAINER#DELETE} or {@link CONTAINER#EXPORT} or {@link CONTAINER#IMPORT}
         * @param ownership {@link CONTAINER#ANY} or {@link CONTAINER#OWNER}
         * @return LDP Container/Resource action permission string
         */
        public static final String resourcePermission(
            IRI resource, String base, String action, String ownership
        ) {
            return "api:ldp:" + base + ":<" + resource.stringValue() + ">:" + action + ":" + ownership;
        }
        public static final String IDENTITY_BASED =  "container";
        public static final String TYPE_BASED = "type";
        public static final String READ = "read";
        public static final String CREATE = "create";
        public static final String UPDATE = "update";
        public static final String DELETE = "delete";
        public static final String EXPORT = "export";
        public static final String IMPORT = "import";
        public static final String ANY = "any";
        public static final String OWNER = "owner";
    }

    public static class FORMS_LDP{
    	public static final String CREATE = "forms:ldp:create";
    	public static final String UPDATE = "forms:ldp:update";
    	public static final String DELETE = "forms:ldp:delete";
    }

    public static class FORMS_SPARQL{
        public static final String CREATE = "forms:sparql:insert";
        public static final String UPDATE = "forms:sparql:delete";
    }

    public static class CACHES{
        public static final String INVALIDATE_ALL = "caches:*:invalidate";
    }

    public static class SERVICES {
        public static final String URL_MINIFY = "services:url-minify";
    }

    public static class QAAS {
        public static final String CREATE = "qaas:create";
        public static final String UPDATE = "qaas:update";
        public static final String DELETE = "qaas:delete";
        public static final String INFO = "qaas:info";
        public static final String PREFIX_EXECUTE = "qaas:execute:";
        public static final String EXECUTE_ALL = "qaas:execute:*";
    }


    public static class REPOSITORY_CONFIG {
        public static final String PREFIX_UPDATE = "repository-config:update:";
        public static final String PREFIX_DELETE = "repository-config:delete:";
        public static final String PREFIX_VIEW = "repository-config:view:";
        public static final String CREATE = "repository-config:create";
    }
    
    public static class EPHEDRA_SERVICE_CONFIG {
        public static final String PREFIX_UPDATE = "ephedra-service-config:update:";
        public static final String PREFIX_DELETE = "ephedra-service-config:delete:";
        public static final String PREFIX_VIEW = "ephedra-service-config:view:";
        public static final String CREATE = "ephedra-service-config:create";
    }

    public static class APP {
    	public static final String PREFIX_CONFIG_VIEW = "app:view-config:";
    }

    public static class STORAGE {
    	public static final String PREFIX_VIEW_CONFIG = "storage:view-config:";
    	public static final String PREFIX_ZIP_EXPORT = "storage:zip-export:";
    	public static final String PREFIX_WRITE = "storage:upload:";
    }

    public static class FILE {
        public static final String PREFIX_READ = "file:read:";
        public static final String PREFIX_WRITE = "file:write:";
    }

    public static class JOBS {
        public static final String DATA_QUALITY_CREATE = "job:create:data-quality";
        public static final String DATA_QUALITY_INFO = "job:info:data-quality";
    }

    public static class PROXY {
        public static final String PREFIX = "proxy:";
    }

}
