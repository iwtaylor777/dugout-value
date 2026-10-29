import json, sys, datetime
from dvp import project
from score import score
res={}
for T in (2023,2024):
    pb=project('bat',T); pp=project('pit',T)
    for m in ('wOBA','K','BB','ISO','WAR600'): res[f'{T} bat {m}']=score('bat',T,pb[m],m,boot=1000)
    for m in ('FIP','ERA','K','BB','WAR180'): res[f'{T} pit {m}']=score('pit',T,pp[m],m,boot=1000)
for k,v in res.items():
    if v: print(k,'n',v['n'],{s:round(x,4) for s,x in v['rmse'].items()},{s:[round(a,4),round(b,4)] for s,(a,b) in v['diff_ci'].items()})
json.dump(res,open('../dev_'+sys.argv[1]+'.json','w'),indent=1)
