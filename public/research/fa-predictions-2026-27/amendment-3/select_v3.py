import json,re,sys
d=json.load(open(sys.argv[1]))
fa=[];exc=[]
for r in d['rows']:
    n=r['note'] or ''; reason=None
    if r['name']=='Emmanuel Clase': reason='excluded: legal case'
    m=re.match(r'club ([\d.]+)(?: buyout ([\d.]+))?',n)
    if m and not reason:
        X=float(m.group(1)); Y=float(m.group(2) or 0)
        if r['mv27']>=X-Y: reason='club option likely exercised'
    m=re.match(r'(?:optout (\d+)y |playeroption )([\d.]+)',n)
    if m and not reason:
        yrs=int(m.group(1)) if m.group(1) else 1
        # Amendment 3: opt out only if his market value over the years left beats the money left
        if sum(r['mvPath'][:yrs])<=float(m.group(2)): reason='likely stays'
    (exc if reason else fa).append((r,reason))
fa=[r for r,_ in fa]
sato=[r for r in fa if r['name']=='Teruaki Sato']; mlb=[r for r in fa if r['name']!='Teruaki Sato']
surname=lambda n:n.split(' ',1)[1] if ' ' in n else n
mlb.sort(key=lambda r:(-r['total'],-r['aav'],surname(r['name'])))
top=mlb[:30]
order=sorted(top+sato,key=lambda r:(-r['total'],-r['aav'],surname(r['name'])))
print(json.dumps({'list':[(r['name'],r['term'],r['total'],r['aav']) for r in order],'cut_next':[(r['name'],r['total']) for r in mlb[30:33]],'excluded':[(r['name'],reason,r['total'],r['note']) for r,reason in exc if r['total']>=15]}))
