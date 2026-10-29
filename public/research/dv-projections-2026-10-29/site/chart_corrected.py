import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

import argparse
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,default=Path(__file__).with_name('horizon_backtest_summary.json'));parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
rows=json.loads(args.input.read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,2,figsize=(16,7.2),dpi=100)
fig.patch.set_facecolor('#faf8f2')
for ax,kind,label in zip(axes,('bat','pit'),('Hitters · WAR per 600 PA','Pitchers · WAR per 180 IP')):
    ax.set_facecolor('#faf8f2')
    for key,title,color,style in [('rmse_one_year_plus_aging_curve','One-year forecast + aging curve','#64748b','--'),('rmse_horizon_model','Separate horizon model','#ba5e31',':'),('rmse_blend_70_30','70/30 blend','#175c51','-')]:
        values=[]
        for h in range(2,6):
            group=[r for r in rows if r['kind']==kind and r['years_ahead']==h]
            values.append(sum(r[key] for r in group)/len(group))
        ax.plot(range(2,6),values,label=title,color=color,linestyle=style,marker='o',linewidth=2.4)
    ax.set_title(label,loc='left',fontweight='bold',pad=20)
    ax.set_xlabel('Years ahead'); ax.set_xticks(range(2,6)); ax.set_ylabel('Weighted RMSE · lower is better')
    ax.grid(axis='y',alpha=.2); ax.set_ylim(1.55,2.2)
    ax.legend(loc='upper left',frameon=False,fontsize=10)
fig.suptitle('Long-range rate tests, corrected for information timing',x=.06,ha='left',fontweight='bold',fontsize=20)
fig.text(.06,.055,'All training outcomes stop at the forecast date. Reused 2024–26 target seasons; no retuning.\nEach point averages available season tests; later horizons have fewer tests. Final smoothing and workloads are not scored here.',fontsize=11,color='#475569')
fig.subplots_adjust(left=.06,right=.98,top=.80,bottom=.19,wspace=.24)
path=args.output
fig.savefig(path,facecolor=fig.get_facecolor())
print(path)
