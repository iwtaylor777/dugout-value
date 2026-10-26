import json, numpy as np
rows=json.load(open('fa_rows.json'))
def run(R,target,use_years,label):
    yrs=sorted({r['t'] for r in R})
    def X(R): return np.array([[r['off']/10,r['fld']/10,r['ps']/10,r['age']-29]+([np.log(r['yrs'])] if use_years else [])+[1.0*(r['t']==y) for y in yrs] for r in R])
    def y(R): return np.log([r['aav'] if target=='aav' else r['aav']*r['yrs'] for r in R])
    f=lambda R: np.linalg.lstsq(X(R),y(R),rcond=None)[0]
    b=f(R); rng=np.random.default_rng(5); bs=np.array([(lambda bb:(bb[1]/bb[0],bb[2]/bb[0]))(f([R[i] for i in rng.integers(0,len(R),len(R))])) for _ in range(1500)])
    print(f'{label:40s} n={len(R)} off {b[0]:.3f} fld {b[1]:.3f} pos {b[2]:.3f} | fld/off {b[1]/b[0]:.2f} {np.round(np.percentile(bs[:,0],[2.5,97.5]),2)} pos/off {b[2]/b[0]:.2f} {np.round(np.percentile(bs[:,1],[2.5,97.5]),2)}')
run(rows,'aav',False,'log AAV, no term control')
run(rows,'tot',False,'log total value, no term control')
run(rows,'aav',True,'log AAV, with log(years)')
run([r for r in rows if r['war']>=2],'tot',False,'log total, 3-yr WAR >= 2')
