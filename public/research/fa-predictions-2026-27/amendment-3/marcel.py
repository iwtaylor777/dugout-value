import json, numpy as np, os
YEARS=range(2015,2027)
H={}; P={}
for y in YEARS:
    for r in json.load(open(f'raw/fg_bat_{y}.json'))['data']:
        H.setdefault(str(r['playerid']),{})[y]=dict(pa=r.get('PA') or 0,war=r.get('WAR') or 0,age=r.get('Age'))
    for r in json.load(open(f'raw/fg_pit_{y}.json'))['data']:
        P.setdefault(str(r['playerid']),{})[y]=dict(ip=r.get('IP') or 0,war=r.get('WAR') or 0,gs=r.get('GS') or 0,g=r.get('G') or 0,age=r.get('Age'))
def rate_mean(D,key,y):
    w=sum(v[y]['war'] for v in D.values() if y in v); t=sum(v[y][key] for v in D.values() if y in v); return w/t
MEAN={'pa':np.mean([rate_mean(H,'pa',y) for y in YEARS if y!=2020]),'ip':np.mean([rate_mean(P,'ip',y) for y in YEARS if y!=2020])}
def marcel(hist,key,last,ahead,ballast,base_pt):
    """projection for season last+ahead from seasons last, last-1, last-2"""
    ws=[5,4,3]; num=0; den=0
    for i,w in enumerate(ws):
        s=hist.get(last-i)
        if s: num+=w*s['war']; den+=w*s[key]
    rate=(num+ballast*MEAN[key])/(den+ballast) if den+ballast>0 else MEAN[key]
    pt=0.5*(hist.get(last,{}).get(key,0))+0.1*(hist.get(last-1,{}).get(key,0))+base_pt
    return rate*pt, rate, pt
def features(hist,key,t,ballast,base_pt):
    fresh,_,_=marcel(hist,key,t,1,ballast,base_pt)
    stale,_,_=marcel(hist,key,t-1,2,ballast,base_pt)
    return fresh,stale
rows=[]
for kind,D,key,ball,bpt,minw in (('bat',H,'pa',1200,200,100),('pit',P,'ip',300,30,20)):
    for pid,h in D.items():
        for t in range(2018,2026):
            if t==2020 or t+1==2020: continue
            if t not in h or h[t][key]<minw: continue
            age=h[t]['age'] or 29
            if age+1>38: continue
            fresh,stale=features(h,key,t,ball,bpt)
            actual=h.get(t+1,{}).get('war',0.0)
            rows.append((kind,pid,t,age+1,stale,fresh,actual,h[t]['war']))
json.dump(rows,open('hist_rows.json','w'))
for kind in ('bat','pit'):
    R=np.array([(r[4],r[5],r[3],r[6],r[7]) for r in rows if r[0]==kind],float)
    X=np.c_[R[:,0],R[:,1],np.ones(len(R))]; y=R[:,3]
    for name,XX in (('stale only',R[:,[0]]),('fresh only',R[:,[1]]),('stale+fresh',R[:,[0,1]]),('stale+fresh+age',np.c_[R[:,0],R[:,1],R[:,2]-29])):
        XX=np.c_[XX,np.ones(len(R))]; b,*_=np.linalg.lstsq(XX,y,rcond=None); res=y-XX@b
        print(kind,name,'n',len(R),'coef',np.round(b,3),'rmse',round(float(np.sqrt((res**2).mean())),3))
    # surprise-carry form: A_{t+1}-stale_{t+1} on (A_t - stale_t)
print('mean rates',MEAN)
