// Tests for the web chat widget: socket messages must be rendered as text, not HTML (XSS)
import * as fs from 'fs';
import * as path from 'path';

const html = fs.readFileSync(path.join(__dirname, '../src/addons/web/index.html'), 'utf8');

// Minimal DOM stand-in that records how content is written.
function fakeElement(): any {
  const el: any = { children: [], scrollTop: 0, scrollHeight: 0 };
  el.appendChild = (child: any) => el.children.push(child);
  Object.defineProperty(el, 'innerHTML', {
    set: () => { throw new Error('innerHTML must not be used'); },
  });
  return el;
}

function loadHandleMsg(messages: any): (type: string, msg: string) => void {
  const match = html.match(/let handleMsg = (function \(type, msg\) \{[\s\S]*?\n {4}\})/);
  if (!match) throw new Error('handleMsg not found in index.html');
  const document = { createElement: () => fakeElement() };
  // eslint-disable-next-line no-new-func
  return new Function('document', 'messages', `return ${match[1]};`)(document, messages);
}

describe('web widget handleMsg', () => {
  it('renders message payloads as text', () => {
    const messages = fakeElement();
    const handleMsg = loadHandleMsg(messages);
    const payload = '<img src=x onerror=alert(1)>';
    handleMsg('staff', payload);
    const item = messages.children[0].children[0];
    expect(item.textContent).toBe(payload);
  });

  it('does not use innerHTML anywhere in the widget', () => {
    expect(html).not.toMatch(/innerHTML|insertAdjacentHTML|document\.write/);
  });
});
