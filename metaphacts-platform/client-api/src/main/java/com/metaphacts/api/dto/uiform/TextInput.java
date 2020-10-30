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
package com.metaphacts.api.dto.uiform;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.vocabulary.QF;

/**
 * Class representing a form element providing free-text input capabilities,
 * such as one-line input elements or text areas.
 * 
 * @author msc
 */
public class TextInput extends UIFormInputElement {
	
	private static final long serialVersionUID = 203607751312165341L;

	public enum InputType {
		LINE,
		TEXTAREA
	}
	
	// the type of the free-text input field (one line vs. text area)
	InputType inputType;
	
	public TextInput(final InputType inputType) {
		
		super(QF.UI_TEXT_INPUT_INDIVIDUAL, "Text Input", "Element for plain text input.");
		
		this.inputType = inputType;
		
	}

	public InputType getInputType() {
		return inputType;
	}

	public void setInputType(InputType inputType) {
		this.inputType = inputType;
	}
	
    @Override
    public void assertConsistency() throws InconsistentDtoException {
        
        super.assertConsistency();
        
        // only the ID is mandatory
        if (inputType==null) {
            throw new InconsistentDtoException(this.getClass(), "inputType is null", getId());
        }
        
    }
}