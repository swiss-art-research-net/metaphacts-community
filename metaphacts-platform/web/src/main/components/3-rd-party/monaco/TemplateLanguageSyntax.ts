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
// Based on https://github.com/microsoft/monaco-languages/blob/master/src/html/html.ts
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { languages } from './MonacoBundle';

const EMPTY_ELEMENTS: string[] = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export const languageConfiguration: languages.LanguageConfiguration = {
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,

  comments: {
    blockComment: ['<!--', '-->']
  },

  brackets: [
    ['<!--', '-->'],
    ['<', '>'],
    ['{', '}'],
    ['(', ')'],
    ['[[', ']]'],
  ],

  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],

  surroundingPairs: [
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
  ],

  onEnterRules: [
    {
      beforeText: new RegExp(
        `<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
        'i'
      ),
      afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
      action: {
        indentAction: languages.IndentAction.IndentOutdent
      }
    },
    {
      beforeText: new RegExp(
        `<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
        'i'
      ),
      action: { indentAction: languages.IndentAction.Indent }
    },
  ],

  folding: {
    markers: {
      start: new RegExp('^\\s*<!--\\s*#region\\b.*-->'),
      end: new RegExp('^\\s*<!--\\s*#endregion\\b.*-->')
    }
  }
};

export const languageGrammar = <languages.IMonarchLanguage>{
  defaultToken: '',
  tokenPostfix: '.html',
  ignoreCase: true,

  // The main tokenizer for our languages
  tokenizer: {
    root: [
      [/<!DOCTYPE/, 'metatag', '@doctype'],
      [/<!--/, 'comment', '@comment'],
      [/\[\[!--/, 'comment', '@backendComment'],
      [/\[\[/, 'metatag', '@backendHandlebars'],
      [/(<)((?:[\w\-]+:)?[\w\-]+)(\s*)(\/>)/, ['delimiter', 'tag', '', 'delimiter']],
      [/(<)(style)/, ['delimiter', { token: 'tag', next: '@style' }]],
      [/(<)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter', { token: 'tag', next: '@otherTag' }]],
      [/(<\/)((?:[\w\-]+:)?[\w\-]+)/, ['delimiter', { token: 'tag', next: '@otherTag' }]],
      [/</, 'delimiter'],
      [/\[/], // text
      [/[^<\[]+/], // text
    ],

    doctype: [
      [/[^>]+/, 'metatag.content'],
      [/>/, 'metatag', '@pop'],
    ],

    comment: [
      [/-->/, 'comment', '@pop'],
      [/[^-]+/, 'comment.content'],
      [/./, 'comment.content'],
    ],

    backendHandlebars: [
      [/\]\]/, 'metatag', '@pop'],
      [/[^\]]+/, 'metatag.content'],
      [/./, 'metatag.content'],
    ],

    backendComment: [
      [/--\]\]/, 'comment', '@pop'],
      [/[^-]+/, 'comment.content'],
      [/./, 'comment.content'],
    ],

    otherTag: [
      [/\/?>/, 'delimiter', '@pop'],
      [/\[\[!--/, 'comment', '@backendComment'],
      [/\[\[/, 'metatag', '@backendHandlebars'],
      // avoid tokenizing attr="{{var}}" or attr="[[helper]]" as JSON
      [/(")(\[\[|\{\{)/, [
        'attribute.value',
        {token: '@rematch', next: '@doubleQValue'},
      ]],
      [/(')(\[\[|\{\{)/, [
        'attribute.value',
        {token: '@rematch', next: '@singleQValue'},
      ]],
      // tokenize attr="{"key": 42}" or attr="[1, 2, 3]" as JSON
      [/(")([\{\[])/, [
        'attribute.value',
        {token: '@rematch', next: '@doubleQJSON', nextEmbedded: 'application/json'},
      ]],
      [/(')([\{\[])/, [
        'attribute.value',
        {token: '@rematch', next: '@singleQJSON', nextEmbedded: 'application/json'},
      ]],
      // otherwise tokenize attribute value as plain string
      [/"/, 'attribute.value', '@doubleQValue'],
      [/'/, 'attribute.value', '@singleQValue'],
      [/[\w\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/[ \t\r\n]+/], // whitespace
    ],

    doubleQValue: [
      [/"/, 'attribute.value', '@pop'],
      [/\[\[/, 'metatag', '@backendHandlebars'],
      [/[^"]*/, 'attribute.value'],
    ],

    singleQValue: [
      [/'/, 'attribute.value', '@pop'],
      [/\[\[/, 'metatag', '@backendHandlebars'],
      [/[^']*/, 'attribute.value'],
    ],

    doubleQJSON: [
      [/"/, {token: 'attribute.value', next: '@pop', nextEmbedded: '@pop'}],
      [/[^"]/, 'attribute.value'],
    ],

    singleQJSON: [
      [/'/, {token: 'attribute.value', next: '@pop', nextEmbedded: '@pop'}],
      [/[^']/, 'attribute.value'],
    ],

    // -- BEGIN <style> tags handling

    // After <style
    style: [
      [/type/, 'attribute.name', '@styleAfterType'],
      [/"([^"]*)"/, 'attribute.value'],
      [/'([^']*)'/, 'attribute.value'],
      [/[\w\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [
        />/,
        {
          token: 'delimiter',
          next: '@styleEmbedded',
          nextEmbedded: 'text/css'
        },
      ],
      [/[ \t\r\n]+/], // whitespace
      [/(<\/)(style\s*)(>)/, ['delimiter', 'tag', { token: 'delimiter', next: '@pop' }]],
    ],

    // After <style ... type
    styleAfterType: [
      [/=/, 'delimiter', '@styleAfterTypeEquals'],
      [
        />/,
        {
          token: 'delimiter',
          next: '@styleEmbedded',
          nextEmbedded: 'text/css'
        },
      ], // cover invalid e.g. <style type>
      [/[ \t\r\n]+/], // whitespace
      [/<\/style\s*>/, { token: '@rematch', next: '@pop' }],
    ],

    // After <style ... type =
    styleAfterTypeEquals: [
      [
        /"([^"]*)"/,
        {
          token: 'attribute.value',
          switchTo: '@styleWithCustomType.$1'
        },
      ],
      [
        /'([^']*)'/,
        {
          token: 'attribute.value',
          switchTo: '@styleWithCustomType.$1'
        },
      ],
      [
        />/,
        {
          token: 'delimiter',
          next: '@styleEmbedded',
          nextEmbedded: 'text/css'
        },
      ], // cover invalid e.g. <style type=>
      [/[ \t\r\n]+/], // whitespace
      [/<\/style\s*>/, { token: '@rematch', next: '@pop' }],
    ],

    // After <style ... type = $S2
    styleWithCustomType: [
      [
        />/,
        {
          token: 'delimiter',
          next: '@styleEmbedded.$S2',
          nextEmbedded: '$S2'
        },
      ],
      [/"([^"]*)"/, 'attribute.value'],
      [/'([^']*)'/, 'attribute.value'],
      [/[\w\-]+/, 'attribute.name'],
      [/=/, 'delimiter'],
      [/[ \t\r\n]+/], // whitespace
      [/<\/style\s*>/, { token: '@rematch', next: '@pop' }],
    ],

    styleEmbedded: [
      [/<\/style/, { token: '@rematch', next: '@pop', nextEmbedded: '@pop' }],
      [/[^<]+/, ''],
    ]

    // -- END <style> tags handling
  }
};
