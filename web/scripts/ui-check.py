"""Browser regression check. Start Next on 3313; requires Chrome + websocket."""
import base64
import sys
import json
import subprocess
import tempfile
import time
import urllib.request
import websocket

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
    chrome = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-allow-origins=*', '--remote-debugging-port=9454', f'--user-data-dir={profile}', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(80):
            try:
                tabs = json.load(urllib.request.urlopen('http://localhost:9454/json', timeout=1))
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
            for _ in range(100):
                if js(expression):
                    return
                time.sleep(.1)
            raise AssertionError(expression)
        call('Runtime.enable')
        call('Page.enable')
        call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.fieldFrames=0;const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...args){window.fieldFrames++;return draw.apply(this,args)};"})
        for width in [1440, 390, 320]:
            call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
            call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference' if width == 390 else 'reduce'}]})
            call('Page.navigate', {'url': sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3313'})
            wait("document.querySelector('#tab-0') && document.querySelector('.brand-mark').complete")
            time.sleep(2)
            assert not js('document.documentElement.scrollWidth > innerWidth')
            assert js("document.querySelector('.scan-note').textContent.includes('Hugging Face belum diketahui')"), 'Retention disclosure missing'
            assert js("document.querySelector('#input-title').textContent === 'Foto barang' && document.querySelector('#verdict-title').textContent === 'Hasil triase'")
            assert not js("document.body.innerText.includes('Tentukan jalur barang.') || document.body.innerText.includes('14 centroid · CLIP ViT-H/14')"), 'Redundant copy returned'
            shot = call('Page.captureScreenshot', {'format': 'png'})['data']
            with open(f'/tmp/ewise-console-{width}.png', 'wb') as image:
                image.write(base64.b64decode(shot))
            # Invalid file stays local; valid image and preview survive tab changes.
            js("document.querySelector('input[type=file]').dispatchEvent(new Event('focus'))")
            js("(()=>{const i=document.querySelector('input[type=file]'),d=new DataTransfer();d.items.add(new File(['bad'],'bad.txt',{type:'text/plain'}));i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()")
            wait("!!document.querySelector('[role=alert]')")
            assert not js("!!document.querySelector('.drop img')")
            js("(()=>{const c=document.createElement('canvas');c.width=c.height=16;c.toBlob(b=>{const i=document.querySelector('input[type=file]'),d=new DataTransfer();d.items.add(new File([b],'sample.png',{type:'image/png'}));i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));});})()")
            wait("!!document.querySelector('.drop img')")
            preview = js("document.querySelector('.drop img').src")
            js("document.querySelector('#tab-0').focus()")
            call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'ArrowRight', 'code': 'ArrowRight'})
            call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'ArrowRight', 'code': 'ArrowRight'})
            wait("document.querySelector('#tab-1').getAttribute('aria-selected')==='true' && !!document.querySelector('.cluster-key')")
            assert js("document.activeElement.id === 'tab-1'")
            for selector in ['.dossier-detail', '.research-method']:
                assert js(f"!document.querySelector('{selector}').open"), selector
                js(f"document.querySelector('{selector} summary').click()")
                assert js(f"document.querySelector('{selector}').open"), selector
                js(f"document.querySelector('{selector} summary').click()")
            for cluster in range(14):
                js(f"document.querySelectorAll('.cluster-key')[{cluster}].click()")
                assert js(f"document.querySelector('.dossier-id').textContent==='C{cluster}'")
            assert not js('document.documentElement.scrollWidth > innerWidth')
            assert js("[...document.querySelectorAll('.c-row')].every(b=>/jalur .+, \d+ citra, kemurnian .+ persen, margin nama/.test(b.getAttribute('aria-label')))")
            js("document.querySelector('.cluster-field').dispatchEvent(new PointerEvent('pointermove',{clientX:40,clientY:40}));document.querySelector('.cluster-field').dispatchEvent(new PointerEvent('pointerleave'))")
            for motion in ['reduce', 'no-preference']:
                call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': motion}]})
                time.sleep(2)
                frames = js('window.fieldFrames')
                assert frames > 0, 'WebGL draw instrumentation inactive'
                time.sleep(.5)
                assert js('window.fieldFrames') == frames, (motion, frames, js('window.fieldFrames'))
            js("document.querySelector('#tab-0').click()")
            assert js("document.querySelector('.drop img').src") == preview
            js("document.querySelector('#tab-1').click()")
            wait("!!document.querySelector('.cluster-field canvas')")
            js("document.querySelector('.cluster-field canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
            wait("!document.querySelector('.cluster-field canvas')")
            assert js("!!document.querySelector('#panel-1 svg')")
            point = js("(()=>{for(const p of document.querySelectorAll('#panel-1 circle')){if(p.dataset.cluster==='13')continue;const q=new DOMPoint(+p.getAttribute('cx'),+p.getAttribute('cy')).matrixTransform(p.getScreenCTM());if(document.elementFromPoint(q.x,q.y)===p)return {x:q.x,y:q.y,id:p.dataset.cluster};}})()")
            assert point, 'No visible SVG point hit target'
            call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': point['x'], 'y': point['y'], 'button': 'left', 'clickCount': 1})
            call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': point['x'], 'y': point['y'], 'button': 'left', 'clickCount': 1})
            wait(f"document.querySelector('.dossier-id').textContent==='C{point['id']}'")
            shot = call('Page.captureScreenshot', {'format': 'png'})['data']
            path = f'/tmp/ewise-checked-{width}.png'
            with open(path, 'wb') as image:
                image.write(base64.b64decode(shot))
            print(width, 'PASS: no overflow; invalid file rejected; preview preserved; keyboard tabs; all 14 clusters; labeled index; idle RAF stopped (reduce/normal); WebGL fallback; SVG point click', path)
        assert not errors, errors
        print('Runtime exceptions: 0')
        ws.close()
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chrome.kill()
            chrome.wait()
