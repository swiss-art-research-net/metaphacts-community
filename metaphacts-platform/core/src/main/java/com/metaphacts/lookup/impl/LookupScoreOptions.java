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
package com.metaphacts.lookup.impl;

import javax.validation.constraints.NotNull;
import java.util.Objects;

/**
 * Part of Lookup configuration options which defines
 * how the score parameter should be modified for results ({@link com.metaphacts.lookup.model.LookupCandidate})
 * of execution lookup with specific lookupImplementation.
 */
public class LookupScoreOptions {
    private @NotNull double scoreFactor;
    private @NotNull double scoreOffset;

    public LookupScoreOptions(@NotNull double scoreFactor, @NotNull double scoreOffset) {
        this.scoreFactor = scoreFactor;
        this.scoreOffset = scoreOffset;
    }

    public double getScoreFactor() {
        return scoreFactor;
    }

    public void setScoreFactor(@NotNull double scoreFactor) {
        this.scoreFactor = scoreFactor;
    }

    public double getScoreOffset() {
        return scoreOffset;
    }

    public void setScoreOffset(@NotNull double scoreOffset) {
        this.scoreOffset = scoreOffset;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        LookupScoreOptions that = (LookupScoreOptions) o;
        return Double.compare(that.scoreFactor, scoreFactor) == 0 && Double.compare(that.scoreOffset, scoreOffset) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(scoreFactor, scoreOffset);
    }
}
