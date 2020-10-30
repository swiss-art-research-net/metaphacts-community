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
import { ReactElement, createFactory, createElement, Component, FormEvent } from 'react';
import * as D from 'react-dom-factories';
import * as Kefir from 'kefir';
import {isEmpty, isNull} from 'lodash';
import * as maybe from 'data.maybe';
import * as ReactBootstrap from 'react-bootstrap';

import { Util as SecurityService, Account } from 'platform/api/services/security';
import { Spinner } from 'platform/components/ui/spinner';
import { Error, Alert, AlertType, AlertConfig} from 'platform/components/ui/alert';
import RoleMultiSelector from './RoleMultiSelectorComponent';

import './RealmManager.scss';

const Input = createFactory(ReactBootstrap.FormControl);
const FormGroup = createFactory(ReactBootstrap.FormGroup);
const ControlLabel = createFactory(ReactBootstrap.ControlLabel);
const Btn = createFactory(ReactBootstrap.Button);
const Panel = createFactory(ReactBootstrap.Panel);

interface State {
  principal?: string;
  password?: string;
  passwordrepeat?: string;
  roles?: string;
  isLoading: boolean;
  updateAccount?: Data.Maybe<Account>;
  alert?: Data.Maybe<AlertConfig>;
}

const INITIAL_NULL_VALUE: string | null = null;

type PoolName = 'principal' | 'password' | 'passwordrepeat' | 'roles' | 'accountStream';

class AccountStore {
  private principal: Kefir.Pool<string>;
  private password: Kefir.Pool<string>;
  private passwordrepeat: Kefir.Pool<string>;
  private roles: Kefir.Pool<string>;
  private accountStream: Kefir.Pool<any>;

  constructor() {
    this.principal = Kefir.pool<string>();
    this.password = Kefir.pool<string>();
    this.passwordrepeat = Kefir.pool<string>();
    this.roles = Kefir.pool<string>();
    this.accountStream = Kefir.pool<any>();
    // TODO think of on how to solve this better with e.g. .filter(p=>p !== INITIAL_NULL_VALUE),
    Kefir.combine([this.principal, this.password, this.passwordrepeat, this.roles],
      (principal: string, password: string, passwordrepeat: string, roles: string) => {
        if (principal === INITIAL_NULL_VALUE || roles === INITIAL_NULL_VALUE) {
          return this.accountStream.plug(
            Kefir.constant<Data.Maybe<Account>>(maybe.Nothing<Account>())
          );
        }
        const errors = [];
        if (isEmpty(principal)) {
          errors.push('Principal must not be empty.');
        }if (isEmpty(roles) || isNull(roles)) {
            errors.push('Roles must not be empty.');
        }if (
          (password !== INITIAL_NULL_VALUE) && (isEmpty(password) || isEmpty(passwordrepeat))
          ) {
            errors.push('Passwords must not be empty.');
        }else if (password !== passwordrepeat) {
          errors.push('Passwords must be equal.');
        }
        if (!isEmpty(errors)) {
          return this.accountStream.plug(Kefir.constantError<string>(errors.join('<br>')));
        }

        this.accountStream.plug(Kefir.constant<Data.Maybe<Account>>(maybe.Just<Account>({
          principal: principal,
          password: password,
          roles: roles,
        })));
    }).onValue((obs) => obs);

    // logging for debugging only
    // this.principal.log(); this.password.log(); this.passwordrepeat.log();
    // this.roles.log(); this.accountStream.log()
  }
  public getAccountStream = (): Kefir.Pool<any> => {
    return this.accountStream;
  }

  public getPool = (propertyName: PoolName): Kefir.Pool<string> => {
    return <Kefir.Pool<string>>this[propertyName];
  }
}

interface Props {
  selectedAccount: Data.Maybe<Account>;
  refreshCallback: () => void;
}

class AccountFormComponent extends Component<Props, State> {
    private accountStore: AccountStore;

    constructor(props: Props) {
      super(props);
      this.state = {
        isLoading: false,
        updateAccount: maybe.Nothing<Account>(),
        alert: maybe.Nothing<AlertConfig>(),
        principal: '',
        password: '',
        passwordrepeat: '',
      };
    }

    public render() {
      return this.state.isLoading
        ? createElement(Spinner)
        : this.renderNewAccountForm(this.props.selectedAccount);
    }

    public componentDidMount() {
      this.initStore();
      this.plugInitialValuesIntoAccountStore(this.props.selectedAccount);
    }

    public componentWillReceiveProps(nextProps: Props) {
      this.plugInitialValuesIntoAccountStore(nextProps.selectedAccount);
    }

    private initStore = (): void => {
      this.accountStore = new AccountStore();
      this.accountStore.getAccountStream().onError((error: string) => {
        this.setState({
          isLoading: false,
          updateAccount: maybe.Nothing<Account>(),
          alert: maybe.Just(Error(error)),
        });
      }).onValue((account: Data.Maybe<Account>) => {
        this.setState({
          isLoading: false,
          updateAccount: account,
          alert: maybe.Nothing<AlertConfig>(),
        });
      });

      this.accountStore.getPool('principal').onValue(val => {
        this.setState({isLoading: false, principal: val});
      });
      this.accountStore.getPool('password').onValue(val => {
        this.setState({isLoading: false, password: val});
      });
      this.accountStore.getPool('passwordrepeat').onValue(val => {
        this.setState({isLoading: false, passwordrepeat: val});
      });
      this.accountStore.getPool('roles').onValue(val => {
        this.setState({isLoading: false, roles: val});
      });

    }

    private onChangeAccount = (e: FormEvent<ReactBootstrap.FormControl>) => {
      const el = (e.target as any);
      this.plugValueToAccountStore(el.name, el.value);
    }

    private plugValueToAccountStore = (poolName: PoolName, value: any): void => {
      this.accountStore.getPool(poolName).plug(Kefir.constant(value));
    }

    private plugInitialValuesIntoAccountStore = (account: Data.Maybe<Account>): void => {
        this.accountStore.getPool('principal').plug(
          Kefir.constant<string>(account.isNothing ? INITIAL_NULL_VALUE : account.get().principal)
        );
        this.accountStore.getPool('password').plug(
          Kefir.constant<string>(INITIAL_NULL_VALUE)
        );
        this.accountStore.getPool('passwordrepeat').plug(
          Kefir.constant<string>(INITIAL_NULL_VALUE)
        );
        this.accountStore.getPool('roles').plug(
          Kefir.constant<string>(account.isNothing ? INITIAL_NULL_VALUE : account.get().roles)
        );
    }

    private renderNewAccountForm = (
      existingAccount: Data.Maybe<Account>
    ): ReactElement<any> => {

      const create = existingAccount.isNothing;
      return D.div(
        { className: 'account-manager-component__create-account-panel' },
        Panel(
          {header: create ? 'New Account' : 'Update Account'},
          D.form(
            {
              key: 'account-panel',
              onSubmit: create ? this.onSubmitCreateAccount : this.onSubmitUpdateAccount,
            },
            FormGroup(
              {controlId: 'principal'},
              ControlLabel({}, 'Principal'),
              Input({
                name: 'principal', type: 'text', placeholder: 'Unique username',
                disabled: !create, value: this.state.principal, onChange: this.onChangeAccount,
              })
            ),
            FormGroup(
              {controlId: 'password'},
              ControlLabel({}, 'Password'),
              Input({
                name: 'password', type: 'password', placeholder: 'Password',
                value: this.state.password, onChange: this.onChangeAccount,
              })
            ),
            FormGroup(
              {controlId: 'passwordrepeat'},
              ControlLabel({}, 'Repeat Password'),
              Input({
                name: 'passwordrepeat', type: 'password', placeholder: 'Repeat Password',
                value: this.state.passwordrepeat, onChange: this.onChangeAccount,
              })
            ),
            D.div({
                key: 'role-selector-container',
                className: 'account-manager-component__role-multi-selector',
              },
              [
                D.label({ key: 'control-label', className: 'control-label' }, 'Roles'),
                D.div({ key: 'role-multi-selector'},
                  RoleMultiSelector({
                    initialRoles: maybe.Just(this.state.roles),
                    inputName: 'roles',
                    onChangeCallback:
                      this.plugValueToAccountStore as (poolName: string, value: string) => void,
                  })
                ),
              ]
            ),
            D.div({ key: 'alert'}, createElement(Alert,
                this.state.alert.map(config => config).getOrElse(
                  { alert: AlertType.NONE, message: '' }
                )
              )
            ),
            D.div({
                key: 'create-account-btn',
                className: 'account-manager-component__create-account-btn',
              },
              Btn({
                  type: 'submit', bsSize: 'small',
                  bsStyle: 'primary', disabled: this.submitDisabled(),
                },
                create ? 'Create' : 'Update'
              )
            )
        ), // end of form
          (create
            ? null
            : Btn({
                key: 'delete-account-btn',
                type: 'submit', bsSize: 'small',
                bsStyle: 'primary', onClick: this.onClickDeleteAccount,
                }, 'Delete'
              )
          )
        ) // end of panel
      );
    }

    private submitDisabled = (): boolean => {
      return this.state.updateAccount.isNothing;
    }

    private onClickDeleteAccount = (): void => {
      SecurityService.deleteAccount(this.props.selectedAccount.get())
      .onValue((val: boolean) => this.props.refreshCallback())
      .onError((err: string) =>
            this.setState({
              isLoading: false,
              alert: maybe.Just(Error(err)),
            })
        );
    }

    private onSubmitUpdateAccount = (e: FormEvent<HTMLFormElement>) => {
      e.stopPropagation();
      e.preventDefault();
      this.state.updateAccount.map(account =>
        SecurityService.updateAccount(account)
        .onValue((val: boolean) => this.props.refreshCallback())
        .onError((err: string) =>
            this.setState({
              isLoading: false,
              alert: maybe.Just(Error(err)),
            })
        )
      );

    }

    private onSubmitCreateAccount = (e: FormEvent<HTMLFormElement>) => {
      e.stopPropagation();
      e.preventDefault();
      this.state.updateAccount.map(account =>
        SecurityService.createAccount(account)
        .onValue((val: boolean) => this.props.refreshCallback())
        .onError((err: string) =>
            this.setState({
              isLoading: false,
              alert: maybe.Just(Error(err)),
            })
        )
      );
    }

}

const AccountForm = createFactory(AccountFormComponent);

export default AccountForm;
