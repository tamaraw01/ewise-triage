"""Run against a fresh Next production server: python3 scripts/implementation-check.py URL."""
import base64
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
import websocket

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
    chrome = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-allow-origins=*', '--remote-debugging-port=9468', f'--user-data-dir={profile}', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(240):
            try:
                tabs = json.load(urllib.request.urlopen('http://localhost:9468/json', timeout=1))
                break
            except OSError:
                time.sleep(.25)
        else:
            raise RuntimeError('Chrome CDP unavailable')
        ws = websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in tabs if t['type'] == 'page'), timeout=60)
        counter = 0
        errors = []
        def call(method, params=None):
            global counter
            counter += 1
            ws.send(json.dumps({'id': counter, 'method': method, 'params': params or {}}))
            while True:
                result = json.loads(ws.recv())
                if result.get('method') == 'Runtime.exceptionThrown':
                    errors.append(result)
                if result.get('id') == counter:
                    assert 'error' not in result, result
                    return result.get('result', {})
        def js(expression):
            result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
            assert 'exceptionDetails' not in result, result
            return result['result'].get('value')
        def wait(expression):
            for _ in range(150):
                if js(f'Boolean({expression})'):
                    return
                time.sleep(.1)
            print('FAILED STATE:', js("JSON.stringify({text:document.body.innerText, scripts:[...document.scripts].map(s=>s.src)})"), 'ERRORS:', errors, flush=True)
            raise AssertionError(expression)
        call('Runtime.enable')
        call('Page.enable')
        for width in [1440, 768, 390, 320]:
            call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 950, 'deviceScaleFactor': 1, 'mobile': False})
            call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]})
            call('Page.navigate', {'url': sys.argv[1]})
            wait("document.querySelector('#tab-4')")
            wait("Object.keys(document.querySelector('#tab-4')).some(k => k.startsWith('__reactProps'))")
            js("document.querySelector('#tab-4').click()")
            wait("document.querySelector('.impl')")
            print(f'{width}px: tab hydrated and opened', flush=True)
            wait("document.querySelector('.impl canvas')")
            wait("document.querySelector('.impl').dataset.reduced === 'true'")
            assert not js("document.querySelector('.impl-limits').open")
            assert js("document.querySelector('.impl-head p').textContent.includes('belum terhubung ke perangkat')")
            for i in range(6):
                js(f"document.querySelectorAll('.impl-rail button')[{i}].click()")
                wait(f"document.querySelectorAll('.impl-rail button')[{i}].getAttribute('aria-current') === 'step'")
                assert js("[...document.querySelectorAll('.impl-rail button')].every(b => b.getBoundingClientRect().height >= 44)")
                if width in [1440, 390]:
                    js("document.querySelector('.impl-stage').scrollIntoView()")
                    time.sleep(.2)
                    image = call('Page.captureScreenshot', {'format': 'png'})['data']
                    with open(f'/tmp/ewise-implementation-r3-{width}-step-{i + 1}.png', 'wb') as out:
                        out.write(base64.b64decode(image))
            for i, name in enumerate(['PCB', 'Baterai Li-ion', 'Tidak yakin']):
                js(f"document.querySelectorAll('.impl-scenarios button')[{i}].click()")
                wait(f"document.querySelector('.impl-result li').textContent.includes('{name}')")
                assert js("document.querySelectorAll('.impl-result li').length === 1 && document.querySelector('.impl-result li').dataset.selected === 'true'")
            js("document.querySelector('.impl-limits summary').click()")
            assert js("document.querySelector('.impl-limits').open")
            assert not js('document.documentElement.scrollWidth > innerWidth'), width
            js("document.querySelectorAll('.impl-rail button')[3].click();document.querySelector('.impl-stage').scrollIntoView()")
            time.sleep(.3)
            image = call('Page.captureScreenshot', {'format': 'png'})['data']
            with open(f'/tmp/ewise-implementation-r3-{width}.png', 'wb') as out:
                out.write(base64.b64decode(image))
            print(f'{width}px: six stages, three scenarios, disclosure, no document overflow, OS reduced motion PASS')
        call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]})
        wait("document.querySelector('.impl').dataset.reduced === 'false'")
        for i in range(6):
            js(f"document.querySelectorAll('.impl-rail button')[{i}].click()")
            wait(f"document.querySelectorAll('.impl-rail button')[{i}].getAttribute('aria-current') === 'step'")
            time.sleep(.7)
        before = js('location.href')
        js("document.querySelector('.impl-head button').click()")
        wait("document.querySelector('.impl').dataset.reduced === 'true'")
        assert js('location.href') == before
        print('Scroll-driven stages, manual motion toggle, unchanged URL PASS')
        js("document.querySelector('.impl canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
        wait("!!document.querySelector('.impl-fail')")
        js("document.querySelectorAll('.impl-rail button')[0].click()")
        wait("document.querySelectorAll('.impl-rail button')[0].getAttribute('aria-current') === 'step'")
        print('WebGL context loss: fallback and stage controls PASS')
        assert not errors, errors
        print('Runtime exceptions: 0')
    finally:
        chrome.terminate()
        chrome.wait(timeout=10)
