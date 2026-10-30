"""Fixed ablations, official targets, portable batting, and identity diagnostics."""
import hashlib
import json
import pickle
from pathlib import Path
from functools import lru_cache

import numpy as np
import pandas as pd

from runtime import COMP, CACHE, HASHES, HERE, ROOT, attrib, split, fg, reference

SEED = 20261029
DEV = [2016,2017,2018,2019,2021]
EVAL = [2022,2023,2024,2025,2026]
PAIRS = [(2021,2022),(2022,2023),(2023,2024),(2024,2025),(2025,2026)]
PARAMETERS = json.load(open(HERE/'reference_parameters.json'))
V1 = PARAMETERS['v1']['params']
V2 = PARAMETERS['v2']['params']
SYSTEMS = ['fip','ra9','v1','v2','contact_only','distributed_outs','fip_balanced','contact_balanced']
official = pd.read_csv(reference('official_standings_2016_2026.csv'))
official['G'] = official.W + official.L
_cache = {}


def load(y,s=None,h=None):
    k=(y,s,h)
    if k not in _cache:
        n=f'{y}_full' if s is None else f'{y}_{s}_{h}'
        with open(COMP/(n+'.pkl'),'rb') as f:_cache[k]=pickle.load(f)
    return _cache[k]


def credit(c,name):
    if name in ['fip','ra9','fip_balanced']:
        b,p,f=attrib.credit(c,'fip' if name=='fip_balanced' else name)
    else:
        q=dict(V1 if name=='v1' else V2)
        if name in ['contact_only','distributed_outs','contact_balanced']:q['lam_f']=1
        cc=c
        if name=='distributed_outs':
            cc=dict(c,fld=c['fld'].assign(r=c['fld']['soft']))
        b,p,f=attrib.credit(cc,'dv',q)
    if name in ['fip_balanced','contact_balanced']:p=p-c['pit']['frm']
    return b,p,f


def rates(c,name):
    b,p,f=credit(c,name)
    return (b/c['bat'].PA,p/c['pit'].BF,(f/c['fld'].outs.replace(0,np.nan)).fillna(0))


def target(y):
    o=official[official.y==y].set_index('team').copy()
    o.index=o.index.str.replace('ATH','OAK')
    return o


def team_value(r,pt,actual=None):
    b,p,f=r
    tb=pt['bat'].reset_index();tp=pt['pit'].reset_index();tf=pt['fld'].reset_index()
    for table,col in [(tb,'bat_team'),(tp,'fld_team'),(tf,'fld_team')]:
        table[col]=table[col].replace({'ATH':'OAK'})
    tb['v']=tb.batter.map(b).fillna(0)*tb.PA
    tp['v']=tp.pitcher.map(p).fillna(0)*tp.BF
    tf['v']=tf.id.map(f).fillna(0)*tf.outs
    t=pt['team'].copy()
    t.index=t.index.str.replace('ATH','OAK')
    if actual is not None:t=actual.reindex(t.index).copy()
    t['off']=tb.groupby('bat_team').v.sum().reindex(t.index).fillna(0)/t.G
    t['def']=(tp.groupby('fld_team').v.sum().reindex(t.index).fillna(0)+tf.groupby('fld_team').v.sum().reindex(t.index).fillna(0))/t.G
    t['a_off']=t.RS/t.G-(t.RS/t.G).mean()
    t['a_def']=(t.RA/t.G).mean()-t.RA/t.G
    t['pred_rd']=t.off+t['def'];t['a_rd']=t.a_off+t.a_def
    return t


def published(y,kind):
    c=load(y);b=fg.fg('bat',y).copy();p=fg.fg('pit',y).copy()
    rb=b.RAR.sum()/b.WAR.sum();rp=p.RAR.sum()/p.WAR.sum()
    delta=-.5*c['bat'].r
    delta=delta-c['bat'].PA*(delta.sum()/c['bat'].PA.sum())
    war=b.WAR.copy()
    if kind in ['batting_only','both']:war=war+delta.reindex(b.index).fillna(0)/rb
    if kind in ['fielding_only','both']:war=war-.5*(b.Fielding.fillna(0)-b.CFraming.fillna(0))/rb
    # Aggregate numerators and denominators before division (also safe for stints).
    hb=pd.DataFrame({'runs':war*rb,'opp':b.PA}).groupby(level=0).sum()
    hp=pd.DataFrame({'runs':p.WAR*rp,'opp':p.TBF}).groupby(level=0).sum()
    return ((hb.runs/hb.opp.replace(0,np.nan)).fillna(0),
            (hp.runs/hp.opp.replace(0,np.nan)).fillna(0),pd.Series(dtype=float))


def corr(d,p,a,w=None):
    x=d[p].to_numpy();y=d[a].to_numpy()
    if w is None:w=np.ones(len(x))
    w=w/w.sum();xm=x-np.sum(w*x);ym=y-np.sum(w*y)
    return float(np.sum(w*xm*ym)/np.sqrt(np.sum(w*xm*xm)*np.sum(w*ym*ym)))


def loso(d,p,a):
    errors=[]
    for y in sorted(d.y.unique()):
        tr=d.y!=y
        co=np.polyfit(d.loc[tr,p],d.loc[tr,a],1)
        errors.extend(np.polyval(co,d.loc[~tr,p])-d.loc[~tr,a])
    return float(np.sqrt(np.mean(np.square(errors))))


def season_rows(name,kind='transfer',pub=False,pairs=PAIRS):
    out=[]
    for t,u in pairs:
        r=published(t,name) if pub else rates(load(t),name)
        b=team_value(r,load(u)['pt'],target(u))
        if kind=='churn':
            a=team_value(r,load(t)['pt'],target(t))
            b=b[['off','def','a_off','a_def','pred_rd','a_rd']]-a[['off','def','a_off','a_def','pred_rd','a_rd']]
        b['y']=u;b['team']=b.index
        out.append(b.reset_index(drop=True))
    return pd.concat(out,ignore_index=True)


def churn_prior_control(D):
    """LOSO next-season RD, controlling prior RD to break the shared subtraction."""
    out={}
    for n,d0 in D.items():
        d=d0.copy();prior=[]
        for _,row in d.iterrows():
            t=target(int(row.y)-1)
            rr=(t.RS-t.RA)/t.G
            prior.append(float(rr.loc[row.team]-rr.mean()))
        d['prior']=prior;d['future']=d.prior+d.a_rd
        errors={'prior_only':[],'prior_plus_churn':[]}
        for y in sorted(d.y.unique()):
            tr=d.y!=y
            for label,cols in [('prior_only',['prior']),('prior_plus_churn',['prior','pred_rd'])]:
                X=np.c_[np.ones(len(d)),d[cols].to_numpy()]
                coef=np.linalg.lstsq(X[tr],d.loc[tr,'future'],rcond=None)[0]
                errors[label].extend(X[~tr]@coef-d.loc[~tr,'future'])
        out[n]={k:float(np.sqrt(np.mean(np.square(e)))) for k,e in errors.items()}
    return out


def summarize(D):
    out={}
    for name,d in D.items():
        assert len(d)==150, (name,len(d))
        assert not d[['y','team']].duplicated().any(),name
        assert np.isfinite(d[['off','def','a_off','a_def','pred_rd','a_rd']].to_numpy()).all(),name
        out[name]={}
        for p,a in [('pred_rd','a_rd'),('off','a_off'),('def','a_def')]:
            out[name][p]=dict(corr=corr(d,p,a),loso_rmse=loso(d,p,a),
                yearly={str(y):corr(s,p,a) for y,s in d.groupby('y')})
    return out


def paired_intervals(D,base='fip',B=2000):
    d0=D[base];teams=sorted(d0.team.unique());years=sorted(d0.y.unique())
    rng=np.random.default_rng(SEED)
    out={n:{'team_cluster':[],'season_block':[]} for n in D if n!=base}
    for _ in range(B):
        tw=dict(zip(teams,np.bincount(rng.integers(0,len(teams),len(teams)),minlength=len(teams))))
        yw=dict(zip(years,np.bincount(rng.integers(0,len(years),len(years)),minlength=len(years))))
        for lab,mp,col in [('team_cluster',tw,'team'),('season_block',yw,'y')]:
            w=d0[col].map(mp).to_numpy(dtype=float)
            for n in out:
                out[n][lab].append(corr(D[n],'pred_rd','a_rd',w)-corr(d0,'pred_rd','a_rd',w))
    return {n:{k:list(np.percentile(v,[2.5,97.5])) for k,v in s.items()} for n,s in out.items()}


def primary_teams(c,kind):
    tab=c['pt'][kind].reset_index()
    pid,team,opp={'bat':('batter','bat_team','PA'),'pit':('pitcher','fld_team','BF'),'fld':('id','fld_team','outs')}[kind]
    return tab.sort_values([opp,team]).drop_duplicates(pid,keep='last').set_index(pid)[team].replace({'ATH':'OAK'})


def permute(r,c,rng,mean=False):
    out=[]
    for rate,kind,opp in zip(r,['bat','pit','fld'],['PA','BF','outs']):
        src=primary_teams(c,kind).reindex(rate.index)
        count=c[kind][opp].reindex(rate.index)
        group=pd.DataFrame({'rate':rate,'opp':count,'team':src})
        # Broad volume bins retain roles/usage while scrambling individual credit.
        cuts=[0,50,200,500,np.inf] if kind=='bat' else [0,75,250,600,np.inf] if kind=='pit' else [0,300,1000,2500,np.inf]
        group['bin']=pd.cut(count,cuts,include_lowest=True)
        v=rate.copy()
        for _,g in group.groupby(['team','bin'],observed=True):
            if mean:v.loc[g.index]=np.average(g.rate,weights=g.opp)
            else:v.loc[g.index]=rng.permutation(g.rate.to_numpy())
        out.append(v)
    return tuple(out)


@lru_cache(maxsize=None)
def half_target(y,s,h):
    d=pd.read_parquet(CACHE/f'pitches_{y}.parquet',columns=['game_pk','home_team','away_team','post_home_score','post_away_score'])
    g=d.groupby('game_pk').agg(home=('home_team','first'),away=('away_team','first'),hr=('post_home_score','max'),ar=('post_away_score','max'))
    g=g.loc[split.half_of(g.index,s)==h]
    both=pd.concat([g.rename(columns={'home':'team','hr':'RS','ar':'RA'})[['team','RS','RA']],
                    g.rename(columns={'away':'team','ar':'RS','hr':'RA'})[['team','RS','RA']]])
    both['team']=both.team.replace({'ATH':'OAK'})
    return both.groupby('team').agg(G=('RS','size'),RS=('RS','sum'),RA=('RA','sum'))


def split_rows(years=[2023,2024,2025],permutation_seed=None,mean=False):
    names=SYSTEMS if permutation_seed is None and not mean else ['fip','v2','contact_only']
    out={n:[] for n in names}
    rng=np.random.default_rng(permutation_seed or SEED)
    for y in years:
        for s in range(3):
            for h in [0,1]:
                c=load(y,s,h);t=load(y,s,1-h);actual=half_target(y,s,1-h)
                for n in names:
                    r=rates(c,n)
                    if permutation_seed is not None or mean:r=permute(r,c,rng,mean)
                    d=team_value(r,t['pt'],actual);d['y']=y;d['team']=d.index;d['s']=s;d['h']=h
                    out[n].append(d.reset_index(drop=True))
    return {n:pd.concat(v,ignore_index=True) for n,v in out.items()}


def split_summary(D):
    result={}
    for n,d in D.items():
        result[n]={}
        for p,a in [('pred_rd','a_rd'),('off','a_off'),('def','a_def')]:
            cs=[corr(g,p,a) for _,g in d.groupby(['s','h'])]
            ls=[loso(g,p,a) for _,g in d.groupby(['s','h'])]
            result[n][p]=dict(corr=float(np.mean(cs)),loso_rmse=float(np.mean(ls)),
                yearly={str(y):float(np.mean([corr(g,p,a) for _,g in v.groupby(['s','h'])])) for y,v in d.groupby('y')})
    return result


def split_intervals(D,B=2000):
    M={}
    for n,d in D.items():
        z=d.copy();z['key']=z.y.astype(str)+'-'+z.team;z['k']=z.s*2+z.h
        p=z.pivot(index='k',columns='key',values='pred_rd')
        a=z.pivot(index='k',columns='key',values='a_rd')
        M[n]=(p.to_numpy(),a.to_numpy())
    keys=list(p.columns);teams=sorted({k.split('-',1)[1] for k in keys});years=sorted({k.split('-',1)[0] for k in keys})
    tidx=np.array([teams.index(k.split('-',1)[1]) for k in keys]);yidx=np.array([years.index(k.split('-',1)[0]) for k in keys])
    def score(n,w):
        x,y=M[n];w=w/w.sum();xx=x-(x*w).sum(1,keepdims=True);yy=y-(y*w).sum(1,keepdims=True)
        return float(np.mean((xx*yy*w).sum(1)/np.sqrt((xx*xx*w).sum(1)*(yy*yy*w).sum(1))))
    out={n:{'team_cluster':[],'season_block':[]} for n in D if n!='fip'};rng=np.random.default_rng(SEED)
    for _ in range(B):
        for label,groups,index in [('team_cluster',teams,tidx),('season_block',years,yidx)]:
            counts=np.bincount(rng.integers(0,len(groups),len(groups)),minlength=len(groups));w=counts[index].astype(float)
            cb=score('fip',w)
            for n in out:out[n][label].append(score(n,w)-cb)
    return {n:{k:list(np.percentile(v,[2.5,97.5])) for k,v in s.items()} for n,s in out.items()}


def prior_speed_rows():
    out=[]
    for y in [2023,2024,2025]:
        for s in range(3):
            for h in [0,1]:
                c=load(y,s,h)
                with open(COMP/f'{y}_{s}_{h}_prior_speed.pkl','rb') as f:prior=pickle.load(f)
                bat=c['bat'].copy()
                for col in ['x','r']:bat[col]=prior[col].reindex(bat.index).fillna(0)
                r=rates(dict(c,bat=bat),'contact_only')
                d=team_value(r,load(y,s,1-h)['pt'],half_target(y,s,1-h))
                d['y']=y;d['team']=d.index;d['s']=s;d['h']=h
                out.append(d.reset_index(drop=True))
    return pd.concat(out,ignore_index=True)


def portable_batting(B=2000):
    rows=[]
    for t,u in PAIRS:
        a,b=load(t),load(u);ta,tb=primary_teams(a,'bat'),primary_teams(b,'bat')
        actual=(b['bat'].nonbip+b['bat'].x+b['bat'].r-b['bat'].park)/b['bat'].PA
        rr={n:rates(a,n)[0] for n in ['fip','contact_only']}
        ids=a['bat'].index.intersection(b['bat'].index)
        ids=ids[(a['bat'].PA.reindex(ids)>=200)&(b['bat'].PA.reindex(ids)>=200)]
        d=pd.DataFrame({'id':ids,'y':u,'actual':actual.reindex(ids).to_numpy(),
            'weight':b['bat'].PA.reindex(ids).to_numpy(),'mover':(ta.reindex(ids)!=tb.reindex(ids)).to_numpy()})
        for n,r in rr.items():d[n]=r.reindex(ids).to_numpy()
        rows.append(d)
    R=pd.concat(rows,ignore_index=True);out={}
    for label,sub in [('all',R),('movers',R[R.mover]),('stayers',R[~R.mover])]:
        def metric(w):
            return {n:float(np.sqrt(np.average((sub[n]-sub.actual)**2,weights=w))) for n in ['fip','contact_only']}
        m=metric(sub.weight);rng=np.random.default_rng(SEED);ids=sorted(sub.id.unique());ci=[]
        for _ in range(B):
            counts=dict(zip(ids,np.bincount(rng.integers(0,len(ids),len(ids)),minlength=len(ids))))
            z=metric(sub.weight*sub.id.map(counts));ci.append(100*(1-z['contact_only']/z['fip']))
        out[label]=dict(n=len(sub),distinct_players=len(ids),rmse=m,
           reduction_pct=100*(1-m['contact_only']/m['fip']),player_cluster_ci=list(np.percentile(ci,[2.5,97.5])),
           yearly={str(y):{n:float(np.sqrt(np.average((s[n]-s.actual)**2,weights=s.weight))) for n in ['fip','contact_only']} for y,s in sub.groupby('y')})
    R.to_csv(INPUT_PRIVATE/'portable_batting_rows.csv',index=False)
    return out


INPUT_PRIVATE=COMP.parent/'evaluation'
INPUT_PRIVATE.mkdir(exist_ok=True)


def main():
    result={'scope':'Exploratory reconstruction; all evaluation seasons previously examined',
       'systems':SYSTEMS,'source_hashes':HASHES,'coverage':pd.read_csv(HERE/'input_coverage.csv').to_dict('records')}
    for kind in ['transfer','churn']:
        D={n:season_rows(n,kind) for n in SYSTEMS}
        result[kind]=summarize(D);result[kind+'_ci_vs_fip']=paired_intervals(D)
        if kind=='churn':result['churn_control_prior_rd']=churn_prior_control(D)
        for n,d in D.items():d.to_csv(INPUT_PRIVATE/f'{kind}_{n}.csv',index=False)
        P={n:season_rows(n,kind,True) for n in ['fwar','batting_only','fielding_only','both']}
        result['published_'+kind]=summarize(P);result['published_'+kind+'_ci_vs_fwar']=paired_intervals(P,'fwar')
        if kind=='churn':result['published_churn_control_prior_rd']=churn_prior_control(P)
        for n,d in P.items():d.to_csv(INPUT_PRIVATE/f'published_{kind}_{n}.csv',index=False)
    result['portable_batting']=portable_batting()
    (HERE/'season_results.json').write_text(json.dumps(result,indent=2))
    print('SEASON RESULTS SAVED',flush=True)
    return result


def finish_splits(result):
    # Avoid requiring incomplete split files to obtain the full-season audit.
    if all((COMP/f'{y}_{s}_{h}.pkl').exists() for y in [2023,2024,2025] for s in range(3) for h in [0,1]):
        D=split_rows();result['split_three_seasons']=split_summary(D)
        result['split_three_seasons_ci_vs_fip']=split_intervals(D)
        strict=prior_speed_rows()
        result['prior_season_speed_sensitivity']=split_summary({'prior_speed_contact_only':strict})
        M=split_rows(mean=True);result['identity_group_mean']=split_summary(M)
        # Null distribution: same team and usage bins, scrambled individual credit.
        sh=[]
        for seed in range(100):sh.append(split_summary(split_rows(permutation_seed=SEED+seed)))
        result['identity_permutation']={n:{p:list(np.percentile([x[n][p]['corr'] for x in sh],[2.5,50,97.5]))
            for p in ['pred_rd','off','def']} for n in ['fip','v2','contact_only']}
        for n,d in D.items():d.to_csv(INPUT_PRIVATE/f'split_{n}.csv',index=False)
        (HERE/'results.json').write_text(json.dumps(result,indent=2))
        print('ALL RESULTS SAVED',flush=True)


if __name__=='__main__':
    import sys
    result=json.loads((HERE/'season_results.json').read_text()) if '--split-only' in sys.argv else main()
    finish_splits(result)
