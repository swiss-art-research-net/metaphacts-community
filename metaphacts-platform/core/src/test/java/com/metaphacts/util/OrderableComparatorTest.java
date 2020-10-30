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
package com.metaphacts.util;

import java.util.Collections;
import java.util.List;

import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.Lists;

public class OrderableComparatorTest {

    @Test
    public void testOrdering() throws Exception {

        Object o1 = new OrderableElement(OrderableComparator.EARLY);
        Object o2 = new OrderableElement(OrderableComparator.VERY_END);
        Object o3 = new Integer(42); // sort by number value
        Object o3a = new Double(12); // sort by number value
        Object o4 = new String("Hello World"); // sort by class name
        Object o5 = new ABCDEF();
        Object o6 = new AABC();
        Object o7 = new AaBb();
        Object o8 = new AaB();
        Object o9 = new AaBDe();
        Object o10 = new I();
        Object o11 = new HZZZZZZ();
        Object o12 = new A();
        Object o13 = new Z();

        List<Object> objects = Lists.newArrayList(o1, o2, o3, o3a, o4, o5, o6, o7, o8, o9, o10, o11, o12, o13);

        Collections.sort(objects, OrderableComparator.INSTANCE);

        Assert.assertEquals(Lists.newArrayList(o1, o3a, o3, o12, o8, o7, o6, o9, o5, o11, o10, o4, o13, o2), objects);
    }

    static class OrderableElement implements Orderable {

        private final int order;

        OrderableElement(int order) {
            super();
            this.order = order;
        }

        @Override
        public int getOrder() {
            return order;
        }
    }
    
    static class ABCDEF {}
    static class AABC {}
    static class AaBb {}
    static class AaB {}
    static class AaBDe {}
    static class A {};
    static class Z {};
    static class I {};
    static class HZZZZZZ {}
}
