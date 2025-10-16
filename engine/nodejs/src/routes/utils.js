function isSelectOrAsk(query) {
  const q = String(query || '').trim().toUpperCase();
  return q.startsWith('SELECT') || q.startsWith('ASK');
}

function isUpdate(query) {
  const q = String(query || '');

  const noComments = q.replace(/(^|\n)\s*#.*(?=\n|$)/g, '$1');

  const stripped = noComments
    .replace(/^\s*(?:PREFIX\s+\w+:\s*<[^>]+>\s*|BASE\s*<[^>]+>\s*)+/ig, '')
    .trim()
    .toUpperCase();

  return /^(INSERT|DELETE|LOAD|CLEAR|CREATE|DROP|MOVE|COPY|ADD|WITH|MODIFY)\b/.test(stripped);
}

module.exports = {
  isSelectOrAsk,
  isUpdate
};