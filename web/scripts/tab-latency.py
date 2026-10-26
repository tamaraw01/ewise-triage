"""Production CDP tab checks. Usage: python3 scripts/tab-latency.py URL LABEL."""
import base64
import json
import pathlib
import subprocess
import sys
import tempfile
import time
import urllib.request
import websocket

out = pathlib.Path('/tmp/ewise-tab-perf-evidence')
out.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as profile:
    chrome = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-allow-origins=*', '--remote-debugging-port=9477', f'--user-data-dir={profile}', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen('http://localhost:9477/json', timeout=1))
                break
            except OSError:
                time.sleep(.1)
        ws = websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in tabs if t['type'] == 'page'), timeout=120)
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
        def js(expression, await_promise=False):
            result = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': await_promise})
            assert 'exceptionDetails' not in result, result
            return result['result'].get('value')
        def wait(expression):
            for _ in range(300):
                if js(f'Boolean({expression})'):
                    return
                time.sleep(.05)
            raise AssertionError(expression)
        call('Runtime.enable')
        call('Page.enable')
        call('Network.enable')
        call('Network.setCacheDisabled', {'cacheDisabled': True})
        # Observe actual draw calls without changing application code.
        call('Page.addScriptToEvaluateOnNewDocument', {'source': "window.__draws=0;for(const C of [WebGLRenderingContext,WebGL2RenderingContext])for(const n of ['drawElements','drawArrays']){const f=C.prototype[n];C.prototype[n]=function(...a){window.__draws++;return f.apply(this,a)}}"})
        rows = []
        checks = []
        for width in [1440, 390]:
            call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 950, 'deviceScaleFactor': 1, 'mobile': False})
            call('Page.navigate', {'url': sys.argv[1]})
            wait("document.querySelector('#tab-4') && Object.keys(document.querySelector('#tab-4')).some(k=>k.startsWith('__reactProps'))")
            assert js("document.querySelectorAll('.motion-scene').length") == 0
            for visit in ['cold', 'return-1', 'return-2']:
                for index in [4, 1, 2, 3, 0]:
                    expression = """new Promise(resolve=>{const start=performance.now();document.querySelector('#tab-INDEX').click();function check(){const p=document.querySelector('#panel-INDEX');if(!p.hidden&&p.children.length&&(INDEX!==4||p.querySelectorAll('canvas').length===2)){requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-start)))}else requestAnimationFrame(check)}check()})""".replace('INDEX',str(index))
                    elapsed = js(expression, True)
                    rows.append({'width': width, 'visit': visit, 'tab': index, 'ms': round(elapsed, 2)})
                    print(width, visit, index, round(elapsed,2), flush=True)
                    if visit == 'cold':
                        time.sleep(.3)
                        if index == 4:
                            js("document.querySelector('.motion-heading button').click();document.querySelectorAll('.motion-scene').forEach(el=>el.dispatchEvent(new CustomEvent('factory-seek',{detail:12})))")
                            time.sleep(.3)
                        png = call('Page.captureScreenshot', {'format':'png'})['data']
                        (out / f'{sys.argv[2]}-{width}-tab-{index}.png').write_bytes(base64.b64decode(png))
                        if index == 4:
                            js("document.querySelector('.motion-heading button').click()")
            js("document.querySelector('#tab-4').click();window.scrollTo(0,0)")
            wait("document.querySelector('.motion-scene')?.dataset.running==='true'")
            time.sleep(.3)
            js("window.__savedCanvas=document.querySelector('.motion-scene canvas');document.querySelector('.motion-heading button').click()")
            wait("document.querySelector('.motion-heading button').getAttribute('aria-pressed')==='true'")
            before=js("document.querySelector('.motion-scene').dataset.elapsed")
            js("document.querySelector('#tab-0').click()")
            time.sleep(.3)
            draws=js('window.__draws')
            time.sleep(.3)
            hidden_draws=js('window.__draws')-draws
            js("document.querySelector('#tab-4').click()")
            wait("document.querySelector('.motion-scene canvas')")
            state=js("({sameCanvas:window.__savedCanvas===document.querySelector('.motion-scene canvas'),paused:document.querySelector('.motion-heading button').getAttribute('aria-pressed')==='true',before:'"+before+"',after:document.querySelector('.motion-scene').dataset.elapsed,hiddenDraws:"+str(hidden_draws)+"})")
            checks.append({'width':width, **state})
            if sys.argv[2] == 'fixed':
                assert state['sameCanvas'] and state['paused'] and state['before']==state['after'] and hidden_draws==0, state
                js("document.querySelector('.motion-heading button').click()")
            call('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
            wait("document.querySelector('.motion-preference')")
            wait("document.querySelector('.motion-scene').dataset.running==='false'")
            call('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
        assert not errors, errors
        result={'url':sys.argv[1], 'label':sys.argv[2], 'renderer':'headless Chrome SwiftShader; DPR 1; cache disabled; no CPU/network throttling', 'metric':'click to panel content + two RAF; Implementation includes two canvas constructions, not GPU paint completion', 'timings':rows,'checks':checks,'runtimeExceptions':len(errors)}
        (out / f'{sys.argv[2]}.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result,indent=2))
    finally:
        chrome.terminate()
        chrome.wait(timeout=15)
