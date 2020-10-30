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
package com.metaphacts.repository;

import java.io.File;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.query.Update;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.event.NotifyingRepository;
import org.eclipse.rdf4j.repository.event.NotifyingRepositoryConnection;
import org.eclipse.rdf4j.repository.event.RepositoryConnectionListener;
import org.eclipse.rdf4j.repository.event.RepositoryListener;
import org.eclipse.rdf4j.repository.event.base.NotifyingRepositoryWrapper;

import com.metaphacts.cache.CacheManager;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class RepositoryUtils {
    
    @SuppressWarnings("unused")
    private void wrapDefaultAsNotifyingRepository(Repository defaultRepository, CacheManager cacheManager){
        // wrap into NotifyingRepository without reporting deltas
        final Repository wrappedRepository = new NotifyingRepositoryWrapper(defaultRepository, false);
        ((NotifyingRepositoryWrapper)wrappedRepository).addRepositoryListener(new RepositoryListener(){

            @Override
            public void getConnection(NotifyingRepository repo, NotifyingRepositoryConnection conn) {
               // TODO we may hook in here for namespace service
                conn.addRepositoryConnectionListener(new RepositoryConnectionListener() {
                    
                    @Override
                    public void setNamespace(RepositoryConnection conn, String prefix, String name) {
                    }
                    
                    @Override
                    public void setAutoCommit(RepositoryConnection conn, boolean autoCommit) {
                    }
                    
                    @Override
                    public void rollback(RepositoryConnection conn) {
                    }
                    
                    @Override
                    public void removeNamespace(RepositoryConnection conn, String prefix) {
                    }
                    
                    @Override
                    public void remove(RepositoryConnection conn, Resource subject, IRI predicate, Value object,
                            Resource... contexts) {
                    }
                    
                    @Override
                    public void execute(RepositoryConnection conn, QueryLanguage ql, String update, String baseURI,
                            Update operation) {
                        cacheManager.invalidateAll();
                    }
                    
                    @Override
                    public void commit(RepositoryConnection conn) {
                        cacheManager.invalidateAll();
                    }
                    
                    @Override
                    public void close(RepositoryConnection conn) {
                        
                    }
                    
                    @Override
                    public void clearNamespaces(RepositoryConnection conn) {
                        
                    }
                    
                    @Override
                    public void clear(RepositoryConnection conn, Resource... contexts) {
                        
                    }
                    
                    @Override
                    public void begin(RepositoryConnection conn) {
                        
                    }
                    
                    @Override
                    public void add(RepositoryConnection conn, Resource subject, IRI predicate, Value object,
                            Resource... contexts) {
                        
                    }
                });
            }

            @Override
            public void initialize(NotifyingRepository repo) {
                
            }

            @Override
            public void setDataDir(NotifyingRepository repo, File dataDir) {
                
            }

            @Override
            public void shutDown(NotifyingRepository repo) {
                // TODO Auto-generated method stub
                
            }
            
        });
    }
}