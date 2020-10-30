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

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.commons.lang3.AnnotationUtils;

/**
 * This class provides some utility methods for reflection.
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class ReflectionUtil {
    /**
     * Get value of specified field from provided instance. The field is found even if it is not public.
     * @param <T> target type of the field. The value will be casted to this type, using {@link Object} works for all types.
     * @param instance instance from whch to get the field value
     * @param name field name
     * @return field value
     * @throws NoSuchFieldException in case that the instance does not have a field of that name 
     * @throws IllegalAccessException if the field cannot be accessed
     * @throws IllegalArgumentException if the specified instance is not an instance of the appropriate class
     */
    public static <T> T getFieldValue(final Object instance, final String name) throws NoSuchFieldException, IllegalArgumentException, IllegalAccessException {
        Optional<Field> f = findField(instance.getClass(), name);
        if (!f.isPresent()) {
            throw new NoSuchFieldException("no such field: " + name);
        }
        Field field = f.get();
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        T value = (T) field.get(instance);
        return value;
    }

    /**
     * Find field within class or parent classes. The field is found even if it is not public.
     * @param clazz clazz to search
     * @param name field name
     * @return field or empty {@link Optional}
     */
    public static Optional<Field> findField(final Class<?> clazz, final String name) {
        try {
            Field field = clazz.getDeclaredField(name);
            return Optional.of(field);
        } catch (NoSuchFieldException e) {
            // try parent class
            Class<?> parent = clazz.getSuperclass();
            if (parent != null) {
                return findField(parent, name);
            }
        }
        return Optional.empty();
    }
    
    /**
     * Returns all public methods in the given class and its super classes using
     * {@link Class#getMethods()} that are annotated with the provided annotation.
     * For retrieval of methods {@link Class#getMethods()} is used.
     * 
     * @param <A>
     * @param clazz      the class
     * @param annotation the annotation
     * @return collection of {@link Method}s
     */
    public static <A extends Annotation> Collection<Method> findMethodsWithAnnotation(Class<?> clazz,
            Class<A> annotation) {
        return Arrays.asList(clazz.getMethods()).stream()
                .filter(m -> m.getAnnotationsByType(annotation).length > 0)
                .collect(Collectors.toList());
    }

    /**
     * Mock the given annotation with data provided in the given properties.
     * 
     * @param <A>
     * @param annotationClass
     * @param properties
     * @return
     */
    @SuppressWarnings("unchecked")
    public static <A extends Annotation> A mockAnnotation(Class<A> annotationClass, Map<String, Object> properties) {
        
        // see https://stackoverflow.com/questions/16299717/how-to-create-an-instance-of-an-annotation/16326389#16326389
        
        return (A) Proxy.newProxyInstance(annotationClass.getClassLoader(), new Class<?>[] { annotationClass },
                new InvocationHandler() {
                    
                    @Override
                    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                            Annotation annotation = (Annotation) proxy;
    
                        switch (method.getName()) {
                        case "toString":
                            return AnnotationUtils.toString(annotation);
                        case "hashCode":
                            return AnnotationUtils.hashCode(annotation);
                        case "equals":
                            return AnnotationUtils.equals(annotation, (Annotation) args[0]);
                        case "annotationType":
                            return annotationClass;
                        default:
                            if (!properties.containsKey(method.getName())) {
                                throw new NoSuchMethodException(
                                        "No value defined for mocked annotation method: " + method.getName());
                            }
                            return properties.get(method.getName());
                        }
                    }
                });
    }
}
