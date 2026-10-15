"""Run against fresh production server; Chrome CDP 9349, websocket-client required.
Usage: python3 scripts/result_qa.py http://localhost:3159
Real upload uses repository logo; later responses are explicit UI test fixtures.
"""
import json,time,urllib.request,websocket,sys,base64
from pathlib import Path
base=sys.argv[1]
image=str(Path(__file__).resolve().parents[1]/'public'/'ewise-mark.png')
import os
cdp=os.environ.get('CDP_URL','http://localhost:9349').rstrip('/')
tabs=json.load(urllib.request.urlopen(cdp+'/json'))
ws=websocket.create_connection(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'),origin=cdp)
i=0; errors=[]
def call(method,params=None):
 global i
 i+=1; ws.send(json.dumps({'id':i,'method':method,'params':params or {}}))
 while True:
  r=json.loads(ws.recv())
  if r.get('method')=='Runtime.exceptionThrown': errors.append(r['params'])
  if r.get('id')==i:
   if 'error' in r: raise RuntimeError(r['error'])
   return r.get('result',{})
def js(s):
 r=call('Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':True})
 if 'exceptionDetails' in r: raise RuntimeError(r['exceptionDetails'])
 return r.get('result',{}).get('value')
def until(s,seconds=120):
 end=time.time()+seconds
 while time.time()<end:
  if js(s): return
  time.sleep(.25)
 raise AssertionError('Timeout: '+s+' '+str(js('document.body.innerText')))
def upload():
 root=call('DOM.getDocument')['root']['nodeId']
 node=call('DOM.querySelector',{'nodeId':root,'selector':'input[type=file]'})['nodeId']
 call('DOM.setFileInputFiles',{'nodeId':node,'files':[image]})
def click(text):
 assert js('(function(){const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()=='+json.dumps(text)+');if(!b)return false;b.click();return true})()'),text
call('Runtime.enable');call('Page.enable')
call('Emulation.setDeviceMetricsOverride',{'width':1280,'height':1100,'deviceScaleFactor':1,'mobile':False})
call('Page.navigate',{'url':base});until('!!document.querySelector("input[type=file]")');time.sleep(2)
# Real backend request, captured unmodified as evidence.
js('window.__actual=null;window.__fetch=window.fetch;window.fetch=async(...args)=>{const r=await window.__fetch(...args);if(String(args[0]).includes("predict")){window.__actual=await r.clone().json()}return r}')
if '--fixtures-only' in sys.argv:
 fixture={'status':'classified','margin':.15,'threshold':.1,'cluster':{'id':3,'label':'PCB','route':'P2','handling':'Fixture only','contested':False}}
 js('window.fetch=async()=>new Response('+json.dumps(json.dumps(fixture))+',{status:200,headers:{"Content-Type":"application/json"}})')
 upload();until('document.body.innerText.includes("Triase barang berikutnya")')
 print('FIXTURES ONLY: real backend upload NOT tested')
else:
 upload();until('document.body.innerText.includes("Triase barang berikutnya")')
 actual=js('window.__actual');assert actual
 open('/tmp/ewise-result-actual.json','w').write(json.dumps(actual,indent=2))
 print('PASS real upload',actual.get('status'),actual.get('cluster',{}).get('id'))
for width in [1280,390]:
 call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1100,'deviceScaleFactor':1,'mobile':width==390});time.sleep(1)
 assert js('document.documentElement.scrollWidth<=innerWidth'),('overflow',width)
 shot=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True})['data'];open(f'/tmp/ewise-result-{width}.png','wb').write(base64.b64decode(shot))
 print('PASS responsive',width)
# Test-only API fixtures exercise manual guards, signed candidates and optional absence.
for cluster,status,margin in [(9,'classified',.15),(11,'classified',.15),(999,'classified',.15),(0,'review',.15),(0,'classified',.15),(3,'classified',.15),(2,'classified',.15),(4,'classified',.15),(0,'review',-.15)]:
 click('Triase barang berikutnya')
 data={'status':status,'margin':margin,'threshold':.1,'cluster':{'id':cluster,'label':'Fixture','route':'P2','handling':'Periksa barang secara manual.','contested':False},'runner_up':{'id':1,'label':'Pembanding'},'ranking':[{'cluster':cluster,'label':'Fixture','similarity':.3},{'cluster':1,'label':'Negatif','similarity':-.2}],'zero_shot':[],'disclaimer':''}
 js('window.fetch=async()=>new Response('+json.dumps(json.dumps(data))+',{status:200,headers:{"Content-Type":"application/json"}})')
 upload();until('document.body.innerText.includes("Triase barang berikutnya")');time.sleep(.6)
 if cluster in [9,11,999] or status=='review': assert js('document.body.innerText.includes("Periksa barang secara manual")')
 assert js('document.documentElement.scrollWidth<=innerWidth')
 assert js('[...document.querySelectorAll("[style]")].every(e=>!e.style.width.startsWith("-"))')
 assert js('[...document.querySelectorAll(".candidate-row")].some(e=>e.textContent.includes("-0,2000"))')
 assert js('[...document.querySelectorAll(".signed-bar i")].some(e=>e.style.left==="40%" && e.style.width==="10%")')
 if margin < 0: assert js('document.querySelector(".meter .fill").style.width==="0%"')
 if cluster==4 and status=='classified': assert js('!!document.querySelector(".hazard-note")')
 shot=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':True})['data'];open(f'/tmp/ewise-fixture-{cluster}-{status}-{margin}.png','wb').write(base64.b64decode(shot))
 print('PASS fixture',cluster,status,margin)
click('Triase barang berikutnya');call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
upload();until('document.body.innerText.includes("Triase barang berikutnya")')
assert js('matchMedia("(prefers-reduced-motion: reduce)").matches')
assert js('[...document.querySelectorAll(".evidence-column")].every(e=>getComputedStyle(e).opacity==="1")');print('PASS reduced motion and reset')
click('Triase barang berikutnya')
js('window.fetch=async()=>new Response(JSON.stringify({error:"QA forced failure"}),{status:503,headers:{"Content-Type":"application/json"}})')
upload();until('document.body.innerText.includes("QA forced failure")');click('Tutup')
assert js('document.body.innerText.includes("Menunggu foto")');print('PASS prediction error and dismiss')
assert not errors,errors
print('PASS no uncaught browser exceptions')
