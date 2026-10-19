"""Live regression: production server :3334, Chromium CDP :9334; stdlib + websocket-client."""
import base64
import json
import time
import urllib.request
import websocket
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/analysis-flow.json').read_text())['points']
ids = sorted({p[5] for p in data})
ws = websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in json.load(urllib.request.urlopen('http://localhost:9334/json')) if t['type'] == 'page'), timeout=30)
seq = 0

def call(method, params=None):
    global seq
    seq += 1
    ws.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
    while True:
        result = json.loads(ws.recv())
        if result.get('id') == seq:
            assert 'error' not in result, result
            return result.get('result', {})

def js(expression):
    result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    assert 'exceptionDetails' not in result, result
    return result.get('result', {}).get('value')

def wait(expression):
    for _ in range(300):
        if js(expression):
            return
        time.sleep(.1)
    raise AssertionError(expression)

def click(text):
    js(f"[...document.querySelectorAll('button')].find(b=>b.textContent==={json.dumps(text)}).click()")

def screenshot(name):
    path = f'/tmp/ewise-{name}.png'
    Path(path).write_bytes(base64.b64decode(call('Page.captureScreenshot', {'format': 'png'})['data']))
    return path

call('Runtime.enable')
call('Page.enable')
call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]})
results = []
for width in [1440, 390, 320]:
    call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 1100, 'deviceScaleFactor': 1, 'mobile': width < 500})
    call('Page.navigate', {'url': 'http://127.0.0.1:3334'})
    time.sleep(2)
    wait("!!document.querySelector('#tab-1')")
    js("document.querySelector('#tab-1').click()")
    wait(f"document.querySelectorAll('[aria-label^=\"Fokus kelompok C\"]').length==={len(ids)}")
    js("document.querySelector('[data-zoom]').scrollIntoView({block:'center'})")
    labels = js("[...document.querySelectorAll('[aria-label^=\"Fokus kelompok C\"]')].map(b=>({id:+b.textContent.slice(1),x:b.getBoundingClientRect().x,y:b.getBoundingClientRect().y,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))")
    assert sorted(p['id'] for p in labels) == ids
    for i, p in enumerate(labels):
        assert p['x'] >= 0 and p['x'] + p['w'] <= width
        for q in labels[i+1:]:
            assert p['x'] + p['w'] <= q['x'] or q['x'] + q['w'] <= p['x'] or p['y'] + p['h'] <= q['y'] or q['y'] + q['h'] <= p['y']
    overview = screenshot(f'overview-{width}')
    for _ in range(3):
        js("document.querySelector('[aria-label=\"Perbesar peta\"]').click()")
    wait("+document.querySelector('[data-zoom]').dataset.zoom>=3")
    wait("(()=>{let d=document.querySelector('[data-photo-layer]').dataset;return d.eligible && JSON.parse(d.eligible).length>0 && d.eligible===d.rendered})()")
    state = js("({...document.querySelector('[data-photo-layer]').dataset})")
    camera = json.loads(state['camera'])
    eligible = []
    for index, p in enumerate(data):
        x = camera['width']/2 + (p[0]-camera['x'])/camera['spanX']*camera['width']*camera['zoom']
        y = camera['height']/2 - (-p[1]-camera['y'])/camera['spanY']*camera['height']*camera['zoom']
        if x+32 >= 0 and x-32 <= camera['width'] and y+32 >= 0 and y-32 <= camera['height']:
            eligible.append(index)
    assert eligible == json.loads(state['eligible']) == json.loads(state['rendered'])
    assert len(eligible) > 70
    dense = screenshot(f'dense-{width}')
    results.append({'width': width, 'labels': len(labels), 'eligible': len(eligible), 'rendered': len(json.loads(state['rendered'])), 'loadedPages': int(state['loadedPages']), 'camera': camera, 'screenshots': [overview, dense]})
print(json.dumps(results, indent=2))
Path('/tmp/ewise-coverage-results.json').write_text(json.dumps(results, indent=2))
ws.close()
