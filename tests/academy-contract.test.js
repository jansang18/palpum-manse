const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const academyPath = path.join(__dirname, '..', 'academy', 'index.html');
const html = fs.readFileSync(academyPath, 'utf8');

test('academy exposes every approved section and mockup disclosure', () => {
  for (const id of [
    'academyHome',
    'academyCourses',
    'academyManse',
    'academyCases',
    'academyBoard',
    'academyPlans'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /현재는 시연 화면이고 결제가 발생하지 않습니다/);
  assert.match(html, /prefers-reduced-motion/);
});
