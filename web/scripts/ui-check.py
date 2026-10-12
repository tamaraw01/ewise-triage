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
            assert not js("document.body.innerText.includes('Foto langsung dikirim ke E-WISE dan Hugging Face')"), 'Removed notice returned'
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
            wait("!!document.querySelector('.cluster-field canvas')")
            for selector in ['.dossier-detail', '.research-method']:
                assert js(f"!document.querySelector('{selector}').open"), selector
                js(f"document.querySelector('{selector} summary').click()")
                assert js(f"document.querySelector('{selector}').open"), selector
                js(f"document.querySelector('{selector} summary').click()")
            for cluster in range(14):
                js(f"document.querySelectorAll('.cluster-key')[{cluster}].click()")
                assert js(f"document.querySelector('.dossier-id').textContent==='C{cluster}'")
                assert js(f"document.querySelector('.field-label').textContent==='C{cluster}'")
                assert js("(()=>{const a=document.querySelector('.field-label').getBoundingClientRect(),b=document.querySelector('.cluster-field').getBoundingClientRect();return a.bottom<=b.top && a.left>=0 && a.right<=innerWidth})()"), 'Label overlaps plot or clips'
                assert js("[...document.querySelectorAll('.cluster-key')].length===14 && [...document.querySelectorAll('.cluster-key')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44 && r.height>=44})"), 'Cluster tap targets'
                assert js("document.querySelector('.dossier-action p').textContent.length>0 && document.querySelector('.dossier-note').textContent.length>0 && document.querySelectorAll('.dossier-detail dd').length===3"), 'Incomplete selected detail'
            if width <= 390:
                assert js("[...document.querySelectorAll('.cluster-atlas .spec,.dossier-title .spec,.facts dt,figcaption,.dossier-note')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=14)"), 'Small mobile metadata'
                assert js("getComputedStyle(document.querySelector('.facts > div')).display==='grid'"), 'Mobile facts did not reflow'
            call('Page.bringToFront')
            js("document.querySelectorAll('.cluster-key')[12].focus()")
            assert js("document.activeElement.textContent==='C12'"), 'Cluster focus failed'
            call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Enter', 'code': 'Enter', 'text': '\r', 'windowsVirtualKeyCode': 13})
            call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13})
            wait("document.querySelector('.dossier-id').textContent==='C12'")
            assert js("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), 'Keyboard focus missing'
            js("document.querySelectorAll('.cluster-key')[13].click();document.activeElement.blur();scrollTo(0,0)")
            time.sleep(.4)
            assert js("document.querySelectorAll('.cluster-key[aria-pressed=true]').length === 1 && document.querySelectorAll('.c-row[aria-pressed=true]').length === 1")
            wait("getComputedStyle(document.querySelector('.cluster-key[aria-pressed=true]')).backgroundColor === 'rgb(167, 186, 131)'")
            assert js("[...document.querySelectorAll('.dossier-title, .dossier-action')].every(e => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(e).transform))"), 'Dossier motion did not settle'
            shot = call('Page.captureScreenshot', {'format': 'png'})['data']
            with open(f'/tmp/ewise-webgl-{width}.png', 'wb') as image:
                image.write(base64.b64decode(shot))
            assert not js('document.documentElement.scrollWidth > innerWidth')
            assert js("(()=>{const css=getComputedStyle(document.documentElement), lum=n=>{const c=css.getPropertyValue(n).trim().slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722},ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);return ratio('--bone-dim','--iron')>=4.5 && ratio('--bone','--void')>=4.5 && ratio('--green','--void')>=4.5 && ratio('--edge','--iron')>=3})()"), 'Text/control contrast'
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
            time.sleep(.4)  # Workspace transform must settle before screen-coordinate hit testing.
            js("document.querySelector('.cluster-field canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
            wait("!document.querySelector('.cluster-field canvas')")
            assert js("!!document.querySelector('#panel-1 svg')")
            assert js("(()=>{const a=document.querySelector('.field-label').getBoundingClientRect(),b=document.querySelector('.cluster-map').getBoundingClientRect();return a.bottom<=b.top && a.right<=innerWidth})()"), 'Fallback label overlaps plot'
            assert js("document.querySelectorAll('#panel-1 svg text').length===0"), 'Scaled SVG label returned'
            for cluster in range(14):
                js(f"document.querySelectorAll('.cluster-key')[{cluster}].click()")
                wait(f"document.querySelector('.dossier-id').textContent==='C{cluster}' && document.querySelector('.field-label').textContent==='C{cluster}'")
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
