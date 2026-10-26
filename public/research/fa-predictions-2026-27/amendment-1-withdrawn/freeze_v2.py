import json,csv,sys
src=sys.argv[1]; d=json.load(open(src)); v1=json.load(open('predictions_frozen_v1.json'))
rows={r['name']:r for r in d['rows']}
sel=json.load(open('recal/sel_v7.json'))
surname=lambda n:n.split(' ',1)[1] if ' ' in n else n
names=[x[0] for x in sel['list']]
names.sort(key=lambda n:(-rows[n]['total'],-rows[n]['aav'],surname(n)))
old={p['player']:p for p in v1['predictions']}
preds=[]
for i,n in enumerate(names,1):
    r=rows[n]; o=old[n]
    p=dict(o); p.update(rank=i,years=r['term'],total_musd=r['total'],aav_musd=r['aav'],war_2027=r['war'][0],war_path=" / ".join(str(w) for w in r['war'][:r['term']]))
    preds.append(p)
sk=preds[0]; assert sk['player']=='Tarik Skubal'
sk['flag']=f"No pitcher has signed for more than $43.3M a year (Scherzer, Verlander). Expect the AAV below ${sk['aav_musd']}M; a longer term or deferrals could keep the total close."
exc=[]
for n,reason,tot,note in sel['excluded']:
    r=rows[n]; exc.append({"player":n,"reason":reason,"model_total_musd":r['total'],"years":r['term'],"note":note})
known={e['player'] for e in exc}
for e in v1['excluded']:
    if e['player'] not in known:
        r=rows.get(e['player']); e=dict(e)
        if r: e.update(model_total_musd=r['total'],years=r['term'])
        exc.append(e)
out=dict(v1); out.update(model_version="2026-10-25.2",predictions=preds,excluded=exc,generated_utc=d['generated'])
out['settings']=dict(v1['settings'],dollarsPerWar=10.5,starPremium=10)
out['amendment']="Amendment 1 (2026-10-25): re-frozen with model 2026-10-25.2 ($10.5M per WAR, 10% star premium) before free agency opened; supersedes the 2026-10-25.1 freeze kept in superseded/."
json.dump(out,open('predictions_frozen.json','w'),indent=1,ensure_ascii=False)
with open('predictions_frozen.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(preds[0].keys())); w.writeheader(); [w.writerow(p) for p in preds]
for p in preds: print(p['rank'],p['player'],p['years'],p['total_musd'],p['aav_musd'],p['war_path'])
print(len(exc))
