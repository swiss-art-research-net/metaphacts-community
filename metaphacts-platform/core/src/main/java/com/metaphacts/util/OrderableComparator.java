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

import java.util.Comparator;

/**
 * A {@link Comparator} for sorting objects according to the following rules.
 * 
 * <ul>
 * <li>If object instance of {@link Orderable}, return
 * {@link Orderable#getOrder()}</li>
 * <li>If object is a {@link Number}, return {@link Number#intValue()}.</li>
 * <li>Otherwise, determine the order using the ASCII number arithmetics with
 * base 27. Note that all characters are represented as values between 0 and 26,
 * "a" corresponding to "1", "z" corresponding to "26". For sorting the first
 * {@link #N_CHARACTERS} of the simple class name are considered.</li>
 * </ul>
 * 
 * <p>
 * <b>Note:</b> this implementation is experimental and subject to change in a
 * future version.
 * </p>
 * 
 * @author Andreas Schwarte
 *
 * @param <T>
 */
public class OrderableComparator<T> implements Comparator<T> {

    public static final OrderableComparator<Object> INSTANCE = new OrderableComparator<Object>();


    /**
     * number of characters to use for sorting
     */
    private static final int N_CHARACTERS = 4;

    public static final int EARLY = 1;
    public static final int VERY_END = Integer.MAX_VALUE;
    public static final int MIDDLE = (int) (13 * Math.pow(27, N_CHARACTERS));

    @Override
    public int compare(T o1, T o2) {
        return Integer.compare(determineOrder(o1), determineOrder(o2));
    }

    /**
     * Determine an integer representing the order of the object.
     * 
     * <ul>
     * <li>If object instance of {@link Orderable}, return
     * {@link Orderable#getOrder()}</li>
     * <li>If object is a {@link Number}, return {@link Number#intValue()}.</li>
     * <li>Otherwise, determine the order using the ASCII number arithmetics with
     * base 27. Note that all characters are represented as values between 0 and 26,
     * "a" corresponding to "1", "z" corresponding to "26". For sorting the first
     * {@link #N_CHARACTERS} of the simple class name are considered.</li>
     * </ul>
     * 
     * @param o
     * @return a numeric representation of the objects order
     */
    protected int determineOrder(Object o) {
        if (o == null) {
            return Integer.MAX_VALUE;
        }
        if (o instanceof Orderable) {
            return ((Orderable) o).getOrder();
        }
        if (o instanceof Number) {
            return ((Number) o).intValue();
        }

        // TODO introduce functionality for externalized configuration (e.g. using
        // a properties file) to define order for a class / instance of a class

        // fallback: sorting on normalized ASCII arithmetics by mapping
        // the first N characters of the classes' simple name to a number
        String simpleName = o.getClass().getSimpleName().toLowerCase();

        int order = 0;
        for (int i = 0; i < N_CHARACTERS; i++) {
            char c = simpleName.length() > i ? simpleName.charAt(i) : 0;
            // map characters to a number between 0 and 26
            // a=1, z=26, ascii<'a'=0, ascii>'z'=26
            int factor = c < 'a' ? 0 : c - 'a' + 1;
            if (factor > 26) {
                factor = 26; // only consider characters
            }
            order += factor * Math.pow(27, N_CHARACTERS - i);
        }
        return order;
    }

}
