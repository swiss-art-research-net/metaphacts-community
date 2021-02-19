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
import '../../scss/main.scss';

import * as React from 'react';
import { NavItem, NavLink, NavDropdown, Dropdown } from 'react-bootstrap';
import * as SecurityService from 'platform/api/services/security';
import { ResourceLinkContainer } from 'platform/components/navigation';

interface UserAuthenticate {
  user: SecurityService.UserI;
}

export class NavAccountComponentClass extends React.Component<{}, UserAuthenticate> {
  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      user: {
        isAuthenticated: false,
        isAnonymous: false,
        userURI: undefined,
        principal: undefined
      },
    };
  }

  componentWillMount() {
    SecurityService.Util.getUser(
      (userObject) => this.setState({
        user: userObject,
      })
    );
  }

  render() {
    const { user } = this.state;
    if (user.isAuthenticated && !user.isAnonymous) {
      // Using Dropdown instead of NavDropdown, as the alignRight prop is not available there
      return (
        <Dropdown alignRight as={NavItem}>
          <Dropdown.Toggle id='main-header-dropdown' as={NavLink}></Dropdown.Toggle>
          <Dropdown.Menu>
            <ResourceLinkContainer iri='http://www.metaphacts.com/ontologies/platform#UserProfile'
              propagateLink={true}>
              <Dropdown.Item title='User Profile'>{user.principal}</Dropdown.Item>
            </ResourceLinkContainer>
            <Dropdown.Divider></Dropdown.Divider>
            <Dropdown.Item title='logout' href='/logout'>Logout</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      );
    } else {
      return <NavItem title='login'><NavLink href='/login'>Login</NavLink></NavItem>;
    }
  }

}

export default NavAccountComponentClass;
