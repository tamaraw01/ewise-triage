"""Chrome fake camera, real React UI, explicit mocked prediction responses.
Start Chrome CDP9362 with --use-fake-device-for-media-stream --use-fake-ui-for-media-stream.
Usage: python3 scripts/auto-camera-check.py http://localhost:3222
"""
import json, sys, time, urllib.request, websocket
base=sys.argv[1]; cdp='http://localhost:9362'
tabs=json.load(urllib.request.urlopen(cdp+'/json'))
ws=websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'),origin=cdp,timeout=30)
i=0

def call(method,params=None):
 global i
 i+=1; ws.send(json.dumps({'id':i,'method':method,'params':params or {}}))
 while True:
  r=json.loads(ws.recv())
  if r.get('id')==i:
   assert 'error' not in r,r
   return r.get('result',{})

def js(s):
 r=call('Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':True})
 assert 'exceptionDetails' not in r,r
 return r.get('result',{}).get('value')

def until(s):
 end=time.time()+20
 while time.time()<end:
  if js(s): return
  time.sleep(.1)
 raise AssertionError(s+' '+str(js('document.body.innerText')))

def click(label):
 assert js('(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()=='+json.dumps(label)+');if(!b||b.disabled)return false;b.click();return true})()'),label

call('Page.bringToFront')
js('window.__previousDocument=true')
call('Page.navigate',{'url':base}); until('!window.__previousDocument && !!document.querySelector("input[type=file]")')
until('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Kamera"&&!b.disabled)')
time.sleep(.5)
fixture={'status':'classified','margin':.15,'threshold':.1,'cluster':{'id':3,'label':'PCB','route':'P2','handling':'Test fixture','contested':False}}
js('window.__count=0;window.__live=0;window.__max=0;window.__fail=false;window.__originalFetch=fetch;window.fetch=async(...args)=>{if(!String(args[0]).includes("/api/predict"))return window.__originalFetch(...args);window.__count++;window.__live++;window.__max=Math.max(window.__max,window.__live);await new Promise(r=>setTimeout(r,400));window.__live--;return new Response(window.__fail?JSON.stringify({error:"QA inference failure"}):'+json.dumps(json.dumps(fixture))+',{status:window.__fail?503:200,headers:{"Content-Type":"application/json"}})}')
click('Kamera');until('document.querySelector("video")?.videoWidth>0')
click('Mulai otomatis');until('window.__count>=3')
assert js('window.__max===1 && !!document.querySelector(".inspection-verdict")'), 'Sequential loop and last result visible'
click('Hentikan otomatis'); count=js('window.__count');time.sleep(1)
assert js('window.__count')==count,'Stopped loop still capturing'
print('PASS 3 cycles, sequential, result visible, explicit stop')
click('Kamera');until('document.querySelector("video")?.videoWidth>0');js('window.__fail=true');click('Mulai otomatis')
until('document.body.innerText.includes("QA inference failure")');count=js('window.__count');time.sleep(1)
assert js('window.__count')==count and js('!document.querySelector("video")')
print('PASS inference error stops loop')
click('Tutup');js('window.__fail=false');click('Kamera');until('document.querySelector("video")?.videoWidth>0');click('Mulai otomatis');until('window.__count>'+str(count))
js('document.querySelector("#tab-2").click()');count=js('window.__count');time.sleep(1)
assert js('window.__count')==count and js('!document.querySelector("video")')
print('PASS console tab change stops loop')
js('document.querySelector("#tab-0").click()');until('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Kamera"&&!b.disabled)');click('Kamera');until('document.querySelector("video")?.videoWidth>0');click('Ambil foto');until('!!document.querySelector(".inspection-verdict")');assert js('!document.querySelector("video")')
print('PASS manual capture retained; synthetic camera and mocked inference only')
