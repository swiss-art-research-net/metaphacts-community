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
package com.metaphacts.secrets;

import java.util.Optional;

/**
 * This interface is used to resolve secrets from a concrete store, such as a password safe or
 * external source like system properties or environment variables.
 * 
 * <p>
 * A secret can be any kind of information and is identified by a key. Examples are passwords, tokens,
 * user names, but also streams of data, e.g. to load a certificate or keystore.
 * </p>
 * 
 * <p>
 * Interpreting the key e.g. to derive some additional information regarding the source is left to each 
 * implementation of a {@link SecretResolver}. Keys might contain hints to a filename or be interpreted as 
 * (part of) a property name or environment variable. 
 * </p>
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface SecretResolver {
    /**
     * Resolve secret. Secrets are only resolved if the {@link SecretLookup}'s key has placeholder markers,
     * i.e. something like <code>${key}</code> or <code>${key:defaultValue}</code>.
     * 
     * @param lookup secret lookup to resolve
     * @@return resolved secret. If the secret could not be resolved an empty {@link Optional} is returned
     */
    public Optional<Secret> resolveSecret(SecretLookup lookup);
}
