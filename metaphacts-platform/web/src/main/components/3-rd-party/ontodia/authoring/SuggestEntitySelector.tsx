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
import * as Kefir from 'kefir';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactSelect, { Option, OnChangeSingleHandler } from 'react-select';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';

import * as Forms from 'platform/components/forms';

interface SuggestEntitySelectorProps {
  value: Forms.LabeledValue | undefined;
  onSelect: (value: Forms.LabeledValue | undefined) => void;
  loadSuggestions: (token: string) => Kefir.Property<Forms.LabeledValue[]>;
}

export function SuggestEntitySelector(props: SuggestEntitySelectorProps) {
  const loadOperation = useOperationCancellation();

  const option = props.value ? makeOptionFromLabelledValue(props.value) : undefined;
  const [loadedOptions, setLoadedOptions] = useState<Option<string>[] | undefined>();

  const onChange = useCallback<OnChangeSingleHandler<string>>(selected => {
    props.onSelect(
      selected
        ? {value: Rdf.iri(selected.value), label: selected.label}
        : undefined
    );
  }, [props.onSelect]);

  const fetchSuggestions = useCallback((token: string) => {
    loadOperation.reset();
    loadOperation.cancellation.map(
      props.loadSuggestions('')
    ).observe({
      value: suggestions => {
        setLoadedOptions(suggestions.map(makeOptionFromLabelledValue));
      },
    });
  }, [props.loadSuggestions]);

  const onOpen = useCallback(() => fetchSuggestions(''), [fetchSuggestions]);
  const onClose = useCallback(() => {
    loadOperation.cancel();
    setLoadedOptions(undefined);
  }, []);

  return (
    <ReactSelect
      placeholder='Type to search...'
      value={option}
      options={loadedOptions}
      onChange={onChange}
      isLoading={false}
      noResultsText={loadedOptions ? 'No results found' : 'Loading...'}
      onOpen={onOpen}
      onClose={onClose}
    />
  );
}

function makeOptionFromLabelledValue(v: Forms.LabeledValue): Option<string> {
  return {value: v.value.value, label: v.label};
}

interface EditEntityButtonProps {
  entityIri: Rdf.Iri;
  entityLabel: string;
  loadCanEdit: (cancellation: Cancellation) => Promise<boolean>;
  onEdit: () => void;
}

export function EditEntityButton(props: EditEntityButtonProps) {
  const queryCanEdit = useOperationCancellation();
  const [editAllowed, setEditAllowed] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    queryCanEdit.reset();
    props.loadCanEdit(queryCanEdit.cancellation).then(allowed => {
      if (queryCanEdit.cancellation.aborted) { return; }
      setEditAllowed(allowed);
    });
    return () => queryCanEdit.cancel();
  }, [props.entityIri]);

  return (
    <a href='#'
      style={editAllowed ? undefined : {display: 'none'}}
      onClick={e => {
        e.preventDefault();
        if (editAllowed) {
          props.onEdit();
        }
      }}>
      <span className='fa fa-pencil' /> Edit {props.entityLabel}
    </a>
  );
}

interface OperationCancellation {
  readonly cancellation: Cancellation;
  cancel(): void;
  reset(): void;
}

function useOperationCancellation(): OperationCancellation {
  const ref = useRef<OperationCancellation>();
  if (!ref.current) {
    let instance = {
      cancellation: Cancellation.cancelled,
      cancel: () => {
        instance.cancellation.cancelAll();
      },
      reset: () => {
        instance.cancellation.cancelAll();
        instance.cancellation = new Cancellation();
      },
    };
    ref.current = instance;
  }
  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.cancellation.cancelAll();
      }
    };
  }, []);
  return ref.current;
}
