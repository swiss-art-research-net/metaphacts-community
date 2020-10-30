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
package com.metaphacts.security;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.Sets;

public class WildcardPermissionTest {

    @Test
    public void permissionIriEscapeTest( ) {
        WildcardPermission perm = new WildcardPermission("api:<http://example.com>:create");
        Assert.assertEquals(permissionParts("api", "<http://example.com>", "create"), perm.getParts());
    }
    
    @Test
    public void permissionMultipleIriEscapeTest( ) {
        WildcardPermission perm = new WildcardPermission("api:<http://example.com>:create:<http://example.com/2>");
        Assert.assertEquals(permissionParts("api", "<http://example.com>", "create", "<http://example.com/2>"), perm.getParts());
    }
    
    @Test
    public void permissionIriNoEscapeTest( ) {
        WildcardPermission perm = new WildcardPermission("api:test:create");
        Assert.assertEquals(permissionParts("api", "test", "create"), perm.getParts());
    }
    
    @Test
    public void permissionRegexTest() {
        WildcardPermission mine = new WildcardPermission("pages:edit:save:regex(<http://www.metaphacts.com/resource/admin/.*>)");
        WildcardPermission other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/admin/RepositoryManager>");
        Assert.assertTrue(mine.implies(other));
    }
    
    @Test
    public void permissionRegexLocalnameTest() {
        WildcardPermission mine = new WildcardPermission("pages:edit:save:regex(<.*(EphedraServices)>)");
        WildcardPermission other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/admin/EphedraServices>");
        Assert.assertTrue(mine.implies(other));
        other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/admin/SomethingElse>");
        Assert.assertFalse(mine.implies(other));
    }
    
    
    @Test
    public void permissionRegexNoTemplatesTest() {
        // Regex permissions must only apply for the templates domain
        WildcardPermission mine = new WildcardPermission("dummy:edit:save:regex(<http://www.metaphacts.com/resource/admin/.*>)");
        WildcardPermission other = new WildcardPermission("dummy:edit:save:<http://www.metaphacts.com/resource/admin/RepositoryManager>");
        Assert.assertFalse(mine.implies(other));
    }
    
    @Test
    public void permissionRegexWrongPartTest() {
        // Regex permissions must only apply for the last (instance) part of the permission string
        WildcardPermission mine = new WildcardPermission("pages:regex(<http://www.metaphacts.com/resource/admin/.*>):edit");
        WildcardPermission other = new WildcardPermission("pages:<http://www.metaphacts.com/resource/admin/RepositoryManager>:edit");
        Assert.assertFalse(mine.implies(other));
    }
    
    @Test
    public void permissionRegexAndIriTest() {
        WildcardPermission mine = new WildcardPermission("pages:<http://www.metaphacts.com/resource/permitted/ThisShouldBeAccepted>:save:regex(<http://www.metaphacts.com/resource/admin/.*>)");
        Assert.assertEquals(permissionParts("pages", "<http://www.metaphacts.com/resource/permitted/ThisShouldBeAccepted>", "save", "regex(<http://www.metaphacts.com/resource/admin/.*>)"), mine.getParts());
        WildcardPermission other = new WildcardPermission("pages:<http://www.metaphacts.com/resource/permitted/ThisShouldBeAccepted>:save:<http://www.metaphacts.com/resource/admin/ThisShouldBeAccepted>");
        Assert.assertTrue(mine.implies(other));
        other = new WildcardPermission("pages:<http://www.metaphacts.com/resource/permitted/ThisShouldNotBeAccepted>:save:<http://www.metaphacts.com/resource/admin/ThisShouldBeAccepted>");
        Assert.assertFalse(mine.implies(other));
        other = new WildcardPermission("pages:<http://www.metaphacts.com/resource/permitted/ThisShouldBeAccepted>:save:<http://www.metaphacts.com/resource/test/ThisShouldNotBeAccepted>");
        Assert.assertFalse(mine.implies(other));
    }
    
    @Test
    public void permissionRegexBlacklistTest() {
        WildcardPermission mine = new WildcardPermission("pages:edit:save:regex(<((?!(http://www.metaphacts.com/resource/admin/)|(http://www.metaphacts.com/resource/test/)).)*>)");
        Assert.assertEquals(permissionParts("pages", "edit", "save", "regex(<((?!(http://www.metaphacts.com/resource/admin/)|(http://www.metaphacts.com/resource/test/)).)*>)"), mine.getParts());
        WildcardPermission other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/admin/RepositoryManager>");
        Assert.assertEquals(permissionParts("pages", "edit", "save", "<http://www.metaphacts.com/resource/admin/RepositoryManager>"), other.getParts());
        Assert.assertFalse(mine.implies(other));
        other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/test/SomeTest>");
        Assert.assertFalse(mine.implies(other));
        other = new WildcardPermission("pages:edit:save:<http://www.metaphacts.com/resource/permitted/ThisShouldBeAccepted>");
        Assert.assertTrue(mine.implies(other));
    }
    
    @Test
    public void permissionRegexBlacklistViewTest() {
        WildcardPermission mine = new WildcardPermission("pages:view:regex(<((?!(http://www.metaphacts.com/resource/admin/)).)*>)");
        Assert.assertEquals(permissionParts("pages", "view", "regex(<((?!(http://www.metaphacts.com/resource/admin/)).)*>)"), mine.getParts());
        WildcardPermission other = new WildcardPermission("pages:view:<http://www.metaphacts.com/resource/admin/RepositoryManager>");
        Assert.assertEquals(permissionParts("pages", "view","<http://www.metaphacts.com/resource/admin/RepositoryManager>"), other.getParts());
        Assert.assertFalse(mine.implies(other));
        other = new WildcardPermission("pages:view:<http://www.metaphacts.com/resource/test/SomeTest>");
        Assert.assertTrue(mine.implies(other));
    }
    
    @Test
    public void permissionCaseSensitiveTest() {
        WildcardPermission mine = new WildcardPermission("api:config:environment:resourceUrlMapping:read");
        WildcardPermission other = new WildcardPermission("api:config:environment:resourceurlmapping:read");
        // ensure that these two permissions match both ways, i.e. that case really doesn't matter in both directions
        Assert.assertTrue(mine.implies(other));
        Assert.assertTrue(other.implies(mine));
    }
    
    private List<HashSet<String>> permissionParts(String... parts) {
        return Arrays.asList(parts).stream().map(Sets::newHashSet).collect(Collectors.toList());
    }
}
