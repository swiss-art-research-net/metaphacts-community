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
import { expect, use } from 'chai';
import * as chaiString from 'chai-string';
// import { RAW_STYLE_ATTRIBUTE } from '../../../../main/common/ts/modules/Registry';
use(chaiString);

// mock registerElement function
// document.registerElement = (elem) => () => elem;

// import * as Registry from '../../../../main/common/ts/modules/Registry';
// Registry.init();

// interface ComponentProps extends Props<any> {
//   text: string;
//   style?: CSSProperties;
//   '__style'?: string;
// }

// describe('React Web-Components Registry', () => {
//   it('parse simple html into react tree', () => {
//     const html = '<div class="test"><a href="test"><b>Text</b></a></div>';

//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.deep.equal(html);
//   });

//   it('parse custom component into react tree', () => {
//     const component: SFC<ComponentProps> =
//       props => D.div({}, D.p({}, props.text, props.children));
//     Registry.registerReactComponent('my-component', component);

//     const html =
//       `
//        <div class="test">
//          <a href="test"><b>Text</b></a><my-component data-text="Test"></my-component>
//        </div>
//       `;
//     const expected =
//       '<div class="test"><a href="test"><b>Text</b></a><div><p>Test</p></div></div>';
//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.equalIgnoreSpaces(expected);
//   });

//   it('parse nested custom components into react tree', () => {
//     const component: SFC<ComponentProps> =
//       props => D.div({}, D.span({}, props.text, props.children));
//     Registry.registerReactComponent('my-component', component);

//     const html =
//       `
//         <div class="test">
//           <my-component data-text="Test">
//             <my-component data-text="Test2"></my-component>
//           </my-component>
//         </div>
//       `;
//     const expected =
//       `
//         <div class="test">
//           <div>
//             <span>
//               Test  <div><span>Test2</span></div>
//             </span>
//           </div>
//         </div>
//       `;
//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.equalIgnoreSpaces(expected);
//   });

//   it('preserves html for natively registered components', () => {
//     document.registerElement('my-custom-component');

//     const html =
//       `
//         <div class="tes">
//           <my-custom-component data-x="{&quot;hello&quot;: &quot;world&quot;}">
//             <b>Test</b>
//           </my-custom-component>
//         </div>
//       `;
//     const expected =
//       `
//         <div class="tes">
//           <div>
//             <my-custom-component data-x="{&quot;hello&quot;: &quot;world&quot;}">
//               <b>Test</b>
//             </my-custom-component>
//           </div>
//         </div>
//       `;
//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.equalIgnoreSpaces(expected);
//   });

//   it('properly parse style attribute to react format', () => {
//     const component: SFC<ComponentProps> =
//       props => D.div({}, D.p({style: props.style}, props.text));
//     Registry.registerReactComponent('my-component', component);

//     const html =
//       `
//        <div class="test">
//          <my-component data-text="Test" style="color: black; border: none;"></my-component>
//        </div>
//       `;
//     const expected =
//       `
//         <div class="test">
//           <div><p style="color: black; border: none;">Test</p></div>
//         </div>
//       `;
//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.equalIgnoreSpaces(expected);
//   });

//   it('preserves original style value', () => {
//     const component: SFC<ComponentProps> = props =>
//       D.div(
//         {
//           dangerouslySetInnerHTML: {
//             __html: `<p style="${props[RAW_STYLE_ATTRIBUTE]}">${props.text}</p>`,
//           },
//         }
//       );
//     Registry.registerReactComponent('my-component', component);

//     const html =
//       `
//        <div class="test">
//          <my-component data-text="Test" style="color: black; border: none;"></my-component>
//        </div>
//       `;

//     /**
//      * The final semicolon in the style value is removed because we minify html when
//      * parsing it into react, we should get rid of this minification when we switch to
//      * react 0.15
//      */
//     const expected =
//       `
//         <div class="test">
//           <div><p style="color: black; border: none">Test</p></div>
//         </div>
//       `;
//     const rendered = Registry.parseHtmlToReact(html);
//     expect(renderToStaticMarkup(rendered[0])).to.be.equalIgnoreSpaces(expected);
//   });
// });
