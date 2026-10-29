import sys, json, numpy as np, dvp_site
from data import seasons, bench
from feat_pit import fnum
T=int(sys.argv[1]); D=seasons('bat')
a=dvp_site.fit('bat',T,1,'v1'); b=dvp_site.fit('bat',T,1,'v3'); Z=bench(T,'zips','bat') or {}; S=bench(T,'steamer','bat') or {}
rows=[]
for pid in a:
    if pid not in b or pid not in Z or pid not in S: continue
    r=D[pid].get(T)
    if not r or (r['PA'] or 0)<200: continue
    try: z=float(Z[pid]['WAR'])/float(Z[pid]['PA'])*600; s=float(S[pid]['WAR'])/float(S[pid]['PA'])*600
    except: continue
    prev=D[pid].get(T-1) or {}; fl=float(np.nan_to_num(fnum(prev.get("Fielding")) or 0))/max(1,(prev.get('PA') or 1))*600
    rows.append((a[pid]['rate'],b[pid]['rate'],z,s,r['WAR']/r['PA']*600,r['PA'],fl))
A=np.array(rows); w=A[:,5]
rm=lambda j: np.sqrt(np.average((A[:,j]-A[:,4])**2,weights=w))
print(T,'n',len(A),'WAR600 RMSE v1 %.3f v3 %.3f zips %.3f steamer %.3f'%(rm(0),rm(1),rm(2),rm(3)))
q=A[:,6]>=np.quantile(A[:,6],0.8); A=np.nan_to_num(A)
print('   top-fielding quintile mean err (pred-actual): v1 %.2f v3 %.2f zips %.2f steamer %.2f'%tuple(np.average(A[q,j]-A[q,4],weights=w[q]) for j in range(4)))
json.dump({'T':T,'rows':A.tolist()},open(f'/tmp/v3_{T}.json','w'))
