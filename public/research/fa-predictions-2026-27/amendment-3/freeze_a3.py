import json, csv, sys
d=json.load(open('pred_a3.json')); sel=json.load(open('sel_a3.json')); U={r['name']:r for r in json.load(open('season_update_report.json'))}
rows={r['name']:r for r in d['rows']}
FLAGS={
 'Tarik Skubal':('below on AAV',"No pitcher has signed for more than $43.3M a year (Scherzer, Verlander). Expect the AAV below the model; a longer term or deferrals could keep the total close."),
 'Teruaki Sato':('below',"The signing team also pays Hanshin a release fee (20% of the first $25M, 17.5% of the next $25M, 15% above $50M), which should push his own contract below his value. His projection is an NPB translation fit on six Japanese hitters and is the least certain in the set."),
 'Sandy Alcantara':('condition',"Assumes Miami declines his $21M club option ($2M buyout), which the model expects because his 2027 market value is below the net cost."),
 'Clay Holmes':('condition',"Assumes he opts out of the $12M left on his deal, which the model expects by a narrow margin."),
 'Gavin Lux':('below',"He did not play in the majors in 2026, so his projection is unchanged from spring ZiPS and does not reflect the lost season."),
 'Hunter Harvey':('below',"He pitched fewer than 20 innings in 2026, so his projection is unchanged from spring ZiPS and does not reflect the lost season."),
}
GEN="If a player receives a qualifying offer (decided within five days of the World Series), the draft-pick cost should push his contract below the model; scored only for players who receive one."
preds=[]
for i,(n,term,total,aav) in enumerate(sel['list'],1):
    r=rows[n]; u=U.get(r['dbName'] or n,{})
    fd,fl=FLAGS.get(n,('',''))
    preds.append({"rank":i,"player":n,"team_2026":r['team'],"position":r['listPos'] if r['listPos'] else r['dbPos'],"age_2027":r['age27'],"role":"reliever" if r['reliever'] else r['role'],"war_2026":round(u['war26'],1) if u else None,"war_2027":r['war'][0],"war_path":" / ".join(str(w) for w in r['war'][:r['term']]),"years":r['term'],"total_musd":r['total'],"aav_musd":r['aav'],"contract_note":r['note'] or '',"flag_direction":fd,"flag":fl})
exc=[{"player":n,"reason":reason,"model_total_musd":rows[n]['total'],"years":rows[n]['term'],"note":note,**({"market_value_remaining_years_musd":round(sum(rows[n]['mvPath'][:int(note.split()[1][:-1])]),1)} if note.startswith('optout') else {})} for n,reason,tot,note in sel['excluded']]
out={"model_version":"2026-10-25.1","amendment":"Amendment 3 (2026-10-26): 2026 season update to projections, pitcher roles from 2026 usage, opt-out rule on the remaining years, NPB translation k=0.17, half credit for fielding runs (non-catcher hitters).",
 "settings":{"dollarsPerWar":11,"starPremium":20,"starThreshold":2,"relieverPremium":50,"relieverPremiumMinWar":0.8,"inflation":3,"timingPreference":10,"regularRosterWar":0.5,"relieverRosterWar":0.2,"fieldingCredit":0.5},
 "general_flag":GEN,"list_rule":"30 highest predicted totals among MLB free agents expected to reach the market, plus Teruaki Sato; ties broken by AAV, then by surname.",
 "generated_utc":d['generated'],"predictions":preds,"excluded":exc}
json.dump(out,open('predictions_frozen_a3.json','w'),indent=1,ensure_ascii=False)
with open('predictions_frozen_a3.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(preds[0].keys())); w.writeheader(); [w.writerow(p) for p in preds]
for p in preds: print(p['rank'],p['player'],p['position'],p['age_2027'],p['role'],p['war_2026'],p['war_2027'],p['years'],p['total_musd'],p['aav_musd'],p['flag_direction'])
print([(e['player'],e['reason'],e.get('market_value_remaining_years_musd')) for e in exc])
