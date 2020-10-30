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

import org.pf4j.util.StringUtils;

public class BrowserDetector {
    // Returns Browsers ID. It can be one of the following values:
    // Edge, Opera, Safari, Chrome, IE11, Firefox, Other.
    public static String detectBrowser(String userAgent) {
        if (StringUtils.isNotNullOrEmpty(userAgent)) {
            if (userAgent.indexOf("Edg") > -1 && userAgent.indexOf("Chrome") > -1) {
                return "Edge";
            } else if ((userAgent.indexOf("OPR") > -1 || userAgent.indexOf("Presto") > -1) && userAgent.indexOf("Chrome") > -1) {
                return "Opera";
            } else if (userAgent.indexOf("Chrome") > -1) {
                return "Chrome";
            } else if (userAgent.indexOf("Safari") > -1) {
                return "Safari";
            } else if ((userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("rv:") > -1) && userAgent.indexOf("Firefox") == -1) {
                return "IE11";
            } else if (userAgent.indexOf("Firefox") > -1) {
                return "Firefox";
            }
        }
        return "Other";
    }
}
