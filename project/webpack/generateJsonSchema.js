/*
 * Copyright (C) 2015-2018, metaphacts GmbH
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

const path = require('path');
const fs = require('fs');
const os = require('os');
const TJS = require('typescript-json-schema');
const jsonStableStringify = require('json-stable-stringify');

if (process.argv.length < 4) {
  const scriptName = path.basename(process.argv[1]);
  console.error(
    `Invalid arguments for ${scriptName}:\n` +
    `$ ${scriptName} <project-name> [--all] (<interface-name>)*`
  );
  process.exit(1);
}

const [nodePath,, projectName, ...otherArgs] = process.argv;
const repositoryRoot = path.normalize(`${__dirname}/../..`);
const buildJsonPath = path.join(repositoryRoot, projectName, 'web/platform-web-build.json');

if (!fs.existsSync(buildJsonPath)) {
  console.error(`Project "${projectName}" does not exists.`);
  process.exit(2);
}

// --all
let flagAllInterfaces = false;

// handle script flags
while (otherArgs.length > 0) {
  const [flag] = otherArgs;
  if (flag.startsWith('--')) {
    otherArgs.shift();
    switch (flag) {
      case '--all':
        flagAllInterfaces = true;
        break;
      default:
        console.error(`Unknown flag "${flag}"`);
        process.exit(2);
        break;
    }
  } else {
    break;
  }
}

/** @type {import('./defaults').WebProject} */
const buildJson = JSON.parse(fs.readFileSync(buildJsonPath, {encoding: 'utf8'}));

// optionally pass argument to schema generator
/** @type {TJS.PartialArgs} */
const settings = {
  required: true,
  propOrder: true,
};

const program = TJS.programFromConfig(path.join(repositoryRoot, 'tsconfig.json'));
const generator = TJS.buildGenerator(program, settings);

const interfaces = flagAllInterfaces
  ? (buildJson.generatedJsonSchemas || [])
  : otherArgs;

/** @type {Array<{ typeName: string; error: any }>} */
const errors = [];
let generatedSchemaCount = 0;

/**
 * @param {import('typescript-json-schema').JsonSchemaGenerator} gen
 */
function resetGenerator(gen) {
  for (const key in generator.ReffedDefinitions) {
    if (Object.prototype.hasOwnProperty.call(generator.ReffedDefinitions, key)) {
      delete generator.ReffedDefinitions[key];
    }
  }
  generator.setSchemaOverride('JSX.Element', {"type": "object"});
  generator.setSchemaOverride('CSSProperties', {"type": "string"});
}

/**
 * Normalizes line ending to LF on Windows
 * @param {string} key
 * @param {*} value
 */
function lineEndingReplacer(key, value) {
  if (typeof value === 'string' && value.indexOf('\r\n') >= 0) {
    return value.replace(/\r\n/g, '\n');
  } else {
    return value;
  }
}

/**
 * @param {import('typescript-json-schema').Definition} schema
 */
function postProcessSchema(schema) {
  if (!schema.definitions) { return; }
  const referenced = new Set();
  JSON.stringify(schema, (key, value) => {
    if (key === "$ref" && typeof value === 'string' && value.startsWith("#/definitions/")) {
      referenced.add(value.substring("#/definitions/".length));
    }
    return value;
  });
  let hasReferencedDefinition = false;
  for (const name in schema.definitions) {
    if (Object.prototype.hasOwnProperty.call(schema.definitions, name)) {
      if (referenced.has(name)) {
        hasReferencedDefinition = true;
      } else {
        // remove non-referenced definition (e.g. from schema override)
        delete schema.definitions[name];
      }
    }
  }
  if (!hasReferencedDefinition) {
    delete schema.definitions;
  }
}

for (const typeName of interfaces) {
  resetGenerator(generator);
  try {
    if (!buildJson.generatedJsonSchemas || buildJson.generatedJsonSchemas.indexOf(typeName) < 0) {
      throw new Error(`Cannot find interface "${typeName}" in platform-web-build.json`);
    }
    const schema = generator.getSchemaForSymbol(typeName, true);
    postProcessSchema(schema);
    let schemaJson = jsonStableStringify(schema, {space: 4, replacer: lineEndingReplacer}) + '\n\n';
    schemaJson = schemaJson.replace(/\n/g, os.EOL);
    fs.writeFileSync(
      path.join(repositoryRoot, projectName, `web/schemas/${typeName}.json`),
      schemaJson,
      {flag: 'w', encoding: 'utf8'}
    );
    console.log('✅ ' + typeName);
    generatedSchemaCount++;
  } catch (err) {
    console.log('❌' + typeName);
    errors.push({typeName, error: err});
  }
}

console.log(`\nGenerated schemas for ${generatedSchemaCount} interfaces.`);

if (errors.length > 0) {
  console.log('\nFailed to generate schemas for the following interfaces:');
  for (const {typeName, error} of errors) {
    console.log('\n❌' + typeName + ':');
    console.error(error);
  }
  process.exit(3);
}
