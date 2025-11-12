const { ancestor, base } = require('acorn-walk');

function matchesPath(node, segments) {
  let idx = segments.length - 1;
  let cur = node;
  while (idx >= 0 && cur) {
    if (cur.type === 'MemberExpression' && cur.property.name === segments[idx]) {
      cur = cur.object;
      idx--;
    } else if (cur.type === 'Identifier' && idx === 0 && cur.name === segments[0]) {
      return true;
    } else {
      return false;
    }
  }
  return idx < 0;
}


// @ts-ignore
function hasIdentifier(node, name) {
  let found = false;
  ancestor(
    node,
    {
      Identifier(inner) {
        if (inner.name === name) found = true;
      },
    },
    base
  );
  return found;
}


// @ts-ignore
function containsWrapperSourceCall(node, wrapperSources) {
  if (!node) return false;
  let found = false;
  ancestor(
    node,
    {
      CallExpression(c) {
        if (c.callee.type === 'Identifier' && wrapperSources.has(c.callee.name)) {
          found = true;
        }
      },
    },
    base
  );
  return found;
}


function containsTainted(node, taintedVars) {
  if (!node) return false;
  let found = false;
  ancestor(
    node,
    {
      Identifier(inner) {
        if (taintedVars.has(inner.name)) found = true;
      },
    },
    base
  );
  return found;
}


// @ts-ignore
function getFirstTaintedInfo(node, taintedVars) {
  if (!node) return {};
  let found = {};
  ancestor(
    node,
    {
      Identifier(inner) {
        if (taintedVars.has(inner.name) && Object.keys(found).length === 0) {
          found = taintedVars.get(inner.name);
        }
      },
    },
    base
  );
  return found;
}


function nodeToString(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const obj = nodeToString(node.object);
    const prop = node.property.name;
    return obj ? `${obj}.${prop}` : prop;
  }
  if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier') return `${node.callee.name}(…)`;
    if (node.callee.type === 'MemberExpression') return `${nodeToString(node.callee)}(…)`;
  }
  return node.type;
}

// @ts-ignore
function isSafeLiteral(node) {
  if (!node) return false;
  if (node.type === 'Literal' && typeof node.value === 'string') return true;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return true;
  return false;
}

function isSanitized(node, sanitizers) {
  if (!node) return false;
  let cleaned = false;
  ancestor(
    node,
    {
      CallExpression(c) {
        if (sanitizers.some((fn) => fn(c))) cleaned = true;
      },
    },
    base
  );
  return cleaned;
}


const allLocPaths = [
  ['location'],
  ['location', 'href'],
  ['location', 'search'],
  ['location', 'hash'],
  ['window', 'location'],
  ['window', 'location', 'href'],
  ['window', 'location', 'search'],
  ['window', 'location', 'hash'],
];

// @ts-ignore
function isLocationSink(node) {
  if (!node) return false;
  if (node.type === 'Identifier' && node.name === 'location') return true;
  if (node.type === 'MemberExpression') {
    for (const path of allLocPaths) {
      if (matchesPath(node, path)) return true;
    }
  }
  return false;
}

function isDirectSource(node) {
  if (!node) return false;
  const docProps = ['cookie', 'URL', 'baseURI', 'referrer'];
  for (const prop of docProps) {
    if (matchesPath(node, ['document', prop]) || matchesPath(node, ['window', 'document', prop])) {
      return true;
    }
  }
  if (node.type === 'MemberExpression' && node.property.name === 'value') return true;
  for (const path of allLocPaths) {
    if (matchesPath(node, path)) return true;
  }
  if (matchesPath(node, ['window', 'name'])) return true;
  return false;
}


const Taint = {
  id: 'taint-flow',
  description: 'Detect flow of untrusted input into dangerous sinks without sanitization.',
  severity: 'high',

  sinks: [
    (n) =>
      n.type === 'AssignmentExpression' &&
      n.left.type === 'MemberExpression' &&
      ['innerHTML', 'outerHTML'].includes(n.left.property.name),
    (n) =>
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      n.callee.property.name === 'insertAdjacentHTML',
    (n) =>
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      n.callee.object.name === 'document' &&
      n.callee.property.name === 'write',
    (n) => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'eval',
    (n) =>
      n.type === 'AssignmentExpression' &&
      n.left.type === 'MemberExpression' &&
      n.left.object.name === 'document' &&
      n.left.property.name === 'cookie',
    (n) =>
      n.type === 'AssignmentExpression' &&
      n.left.type === 'MemberExpression' &&
      n.left.object.name === 'window' &&
      n.left.property.name === 'name',
    (n) =>
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      matchesPath(n.callee, ['window', 'open']),
    (n) =>
      n.type === 'AssignmentExpression' &&
      ((n.left.type === 'Identifier' && n.left.name === 'location') ||
        (n.left.type === 'MemberExpression' &&
          allLocPaths.some((path) => matchesPath(n.left, path)))),
    (n) =>
      n.type === 'NewExpression' &&
      n.callee.type === 'Identifier' &&
      n.callee.name === 'Function',
  ],

  sanitizers: [
    (n) =>
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      n.callee.property.name === 'sanitize',
  ],

  check(ast, meta) {
    const issues = [];
    const taintedVars = new Map();


    ancestor(
      ast,
      {
        AssignmentExpression(node) {
          const { left, right } = node;
          if (!left || !right) return;

          const isSink = Taint.sinks.some((fn) => fn(node));
          const tainted = isDirectSource(right) || containsTainted(right, taintedVars);

          if (isSink && tainted && !isSanitized(right, Taint.sanitizers)) {
            issues.push({
              ruleId: Taint.id,
              description: Taint.description,
              severity: Taint.severity,
              type: 'AssignmentExpression',
              sourceName: nodeToString(right),
              sinkName: nodeToString(left),
              location: node.loc,
              // @ts-ignore
              file: left.sourceFile || meta.file,
            });
          }

          if (left.type === 'Identifier' && (isDirectSource(right) || containsTainted(right, taintedVars))) {
            taintedVars.set(left.name, {
              loc: left.loc,
              // @ts-ignore
              file: left.sourceFile || meta.file,
            });
          }
        },
      },
      base
    );

    ancestor(
      ast,
      {
        CallExpression(node) {
          const isSink = Taint.sinks.some((fn) => fn(node));
          if (!isSink) return;
          const arg = node.arguments?.[0];
          const tainted = isDirectSource(arg) || containsTainted(arg, taintedVars);

          if (tainted && !isSanitized(arg, Taint.sanitizers)) {
            issues.push({
              ruleId: Taint.id,
              description: Taint.description,
              severity: Taint.severity,
              type: 'CallExpression',
              sourceName: nodeToString(arg),
              sinkName: nodeToString(node.callee),
              location: node.loc,
              // @ts-ignore
              file: node.callee.sourceFile || meta.file,
            });
          }
        },
      },
      base
    );

    return issues;
  },
};

module.exports = [Taint];
