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
import { EventSource, Events } from '../viewUtils/events';

export interface Command {
    readonly title?: string;
    readonly invoke: CommandAction;
}

/** @returns Inverse command */
export type CommandAction = () => Command;

export namespace Command {
    export function create(title: string, action: CommandAction): Command {
        return {title, invoke: action};
    }

    export function effect(title: string, body: () => void): Command {
        const perform = {
            title,
            invoke: () => {
                body();
                return skip;
            }
        };
        const skip = {
            title: 'Skipped effect: ' + title,
            invoke: () => perform,
        };
        return perform;
    }
}

export interface CommandHistoryEvents {
    historyChanged: { hasChanges: boolean };
}

export interface CommandHistory {
    readonly events: Events<CommandHistoryEvents>;
    readonly undoStack: ReadonlyArray<Command>;
    readonly redoStack: ReadonlyArray<Command>;
    reset(): void;
    undo(): void;
    redo(): void;
    execute(command: Command): void;
    registerToUndo(command: Command): void;
    startBatch(title?: string): Batch;
}

export interface Batch {
    readonly history: CommandHistory;
    store(): void;
    discard(): void;
}

export class NonRememberingHistory implements CommandHistory {
    private readonly source = new EventSource<CommandHistoryEvents>();
    readonly events: Events<CommandHistoryEvents> = this.source;

    readonly undoStack: ReadonlyArray<Command> = [];
    readonly redoStack: ReadonlyArray<Command> = [];

    reset() {
        this.source.trigger('historyChanged', {hasChanges: false});
    }
    undo() {
        throw new Error('Undo is unsupported');
    }
    redo() {
        throw new Error('Redo is unsupported');
    }

    execute(command: Command) {
        command.invoke();
        this.source.trigger('historyChanged', {hasChanges: true});
    }
    registerToUndo(command: Command) {
        this.source.trigger('historyChanged', {hasChanges: true});
    }
    startBatch(title?: string): Batch {
        return {
            history: this,
            store: this.storeBatch,
            discard: this.discardBatch,
        };
    }
    private storeBatch = () => {/* nothing */};
    private discardBatch = () => {/* nothing */};
}
