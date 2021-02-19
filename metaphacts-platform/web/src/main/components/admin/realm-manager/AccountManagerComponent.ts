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
import { Component, createFactory, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as maybe from 'data.maybe';

import { Util as SecurityService, Account } from 'platform/api/services/security';
import { Table, TableLayout } from 'platform/components/semantic/table';
import { Spinner } from 'platform/components/ui/spinner';
import { TemplateItem } from 'platform/components/ui/template';
import { default as AccountForm } from './AccountFormComponent';

import'./RealmManager.scss';

interface State {
  isLoading: boolean;
  data?: Data.Maybe<any[]>;
  selectedAccount?: Data.Maybe<Account>;
  err?: Data.Maybe<string>;
}

class AccountManagerComponent extends Component<{}, State> {
    constructor(props: {}) {
      super(props);
      this.state = {
        isLoading: true,
        data: maybe.Nothing<any[]>(),
        selectedAccount: maybe.Nothing<Account>(),
        err: maybe.Nothing<string>(),
      };
    }

    public render() {
      if (this.state.err.isJust) {
        return createElement(TemplateItem, {template: {source: this.state.err.get()}});
      }
      if (this.state.isLoading) {
        return createElement(Spinner);
      }

      return D.div({},
          this.renderAccountTable(),
          AccountForm({
            selectedAccount: this.state.selectedAccount,
            refreshCallback: this.fetchAccounts,
          })
        );
    }

    public componentWillMount() {
      this.fetchAccounts();
    }

    private getRowClass = (account: Account): string => {
      if (this.state.selectedAccount.isNothing) {
        return '';
      }

      return account.principal === this.state.selectedAccount.get().principal ? 'bg-success' : '';
    }

    private renderAccountTable() {
      const griddleOptions = {
        onRowClick: this.onRowClick.bind(this),
        rowMetadata: { 'bodyCssClassName' : this.getRowClass },
      };

      return  D.div({}, createElement(Table, {
         layout: {options: griddleOptions as TableLayout['options']},
         numberOfDisplayedRows: 10,
         data: this.state.data.get(),
         columnConfiguration: [
           {variableName: 'principal', displayName: 'User Principal'},
           {variableName: 'roles', displayName: 'Roles'},
           {variableName: 'permissions', displayName: 'Permissions', cellTemplate: '<ul class="account-manager-component__account-permissions-ul">{{#each this.permissions as |permission|}}<li class="account-manager-component__account-permissions-li">{{ permission }} </li>{{/each}}</ul>'},
         ],
       }));
    }

    private onRowClick = (e: Component<{ data: Account }, {}>): void => {
      const account = e.props['data'];
      const stateAccount = this.state.selectedAccount.map(currentSelected =>
        currentSelected.principal === account.principal
          ? maybe.Nothing<Account>()
          : maybe.Just<Account>(account)
      ).getOrElse(maybe.Just<Account>(account));

      this.setState({
        isLoading: false,
        selectedAccount: stateAccount,
      });
    }

    private fetchAccounts = (): void => {
      this.setState({
        isLoading: true,
        selectedAccount: maybe.Nothing<Account>(),
      });

      SecurityService.getAllAccounts().onValue(
        (accounts) =>
          this.setState({
             isLoading: false,
             data: maybe.Just(accounts),
           })
      ).onError(err =>
        this.setState({
             isLoading: false,
             err: maybe.Just(err),
           })
      );
  }

} // end component

const AccountManager = createFactory(AccountManagerComponent);
export default AccountManager;
