"""Render the primary comparison from the independently replayed current scores."""
import argparse,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();D=json.loads(args.input.read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':13,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,2,figsize=(16,7.6),dpi=100);fig.patch.set_facecolor('#faf8f2')
for ax,key,title in zip(axes,['bat_pooled','pit_pooled'],['Hitters · wOBA','Pitchers · FIP']):
    ax.set_facecolor('#faf8f2')
    for i,(system,label,color) in enumerate([('zips','Compared with ZiPS','#175c51'),('steamer','Compared with Steamer','#ba5e31')]):
        r=D[key]['scores']['dv']['comparisons'][system];value=r['percent_error_reduction'];lo,hi=r['percent_error_reduction_ci']
        ax.errorbar(value,i,xerr=[[value-lo],[hi-value]],fmt='o',color=color,markersize=10,capsize=5,linewidth=2.5)
        ax.text(value,i-.16,f'{value:+.1f}%',ha='center',va='bottom',fontweight='bold',color=color)
    ax.axvline(0,color='#64748b',linestyle='--',linewidth=1.2);ax.set_yticks([0,1],['Compared with ZiPS','Compared with Steamer']);ax.invert_yaxis();ax.set_ylim(1.55,-.55);ax.set_xlim(-5,9);ax.set_xticks([-4,-2,0,2,4,6,8]);ax.grid(axis='x',alpha=.15)
    ax.set_title(title,loc='left',fontweight='bold',fontsize=18,pad=25);ax.set_xlabel('DV reduction in forecast error (%)\nPositive = lower error for DV',labelpad=15)
fig.suptitle('How DV compares with preseason ZiPS and Steamer',x=.055,ha='left',fontweight='bold',fontsize=22)
fig.text(.055,.045,'2025–26 pooled, on the same eligible players. Playing-time-weighted RMSE.\nBars show paired 95% intervals resampling players; observations from both seasons stay together. Zero means equal error.',fontsize=12,color='#475569')
fig.subplots_adjust(left=.16,right=.98,top=.79,bottom=.24,wspace=.48)
fig.savefig(args.output,facecolor=fig.get_facecolor())
