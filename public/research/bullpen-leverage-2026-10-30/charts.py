import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt, pandas as pd, numpy as np
SURF="#f7f3e9"; INK="#172d3d"; INK2="#52514e"; MUTE="#8a8780"; GRID="#ddd6c6"; A="#2a78d6"; B="#eb6834"
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":12,"axes.edgecolor":MUTE,"axes.labelcolor":INK2,"xtick.color":INK2,"ytick.color":INK,"figure.facecolor":SURF,"axes.facecolor":SURF,"savefig.facecolor":SURF})
out="/home/claude/dugout-value/public/analysis/teams-save-their-best-relievers-for-the-wrong-inning/"
d=pd.read_csv("inning_chart.csv",index_col=0)
labels=["5th or\nearlier","6th","7th","8th","9th","Extras"]
x=np.arange(len(d)); w=0.38
fig,ax=plt.subplots(figsize=(10,4.8),dpi=160)
b1=ax.bar(x-w/2,d["share_of_high_lev"]*100,w,color=B,label="Share of high-leverage relief batters (LI 2+)")
b2=ax.bar(x+w/2,d["share_of_top2_PAs"]*100,w,color=A,label="Share of the top two relievers' batters")
for bars in (b1,b2):
    for r in bars: ax.text(r.get_x()+r.get_width()/2,r.get_height()+0.6,f"{r.get_height():.0f}%",ha="center",fontsize=10,color=INK)
ax.set_xticks(x); ax.set_xticklabels(labels); ax.set_ylabel("Percent"); ax.set_ylim(0,44)
ax.legend(frameon=False,loc="upper left",fontsize=10.5)
ax.grid(axis="y",color=GRID,lw=0.8); ax.set_axisbelow(True)
for s in ["top","right"]: ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig(out+"leverage-by-inning.png"); plt.close(fig)
M=pd.read_csv("team_metrics.csv"); m=M[M.season==2026].sort_values("eff")
fig,ax=plt.subplots(figsize=(10,8.2),dpi=160)
cols=[B if t in ("MIL","TB") else A for t in m.team]
ax.hlines(np.arange(len(m)),40,m["eff"]*100,color=GRID,lw=1.5); ax.scatter(m["eff"]*100,np.arange(len(m)),color=cols,s=70,zorder=3)
for i,(t,e) in enumerate(zip(m.team,m.eff)): ax.text(e*100+0.8,i,f"{e*100:.0f}",va="center",fontsize=9.5,color=INK)
ax.set_yticks(np.arange(len(m))); ax.set_yticklabels(m.team,fontsize=10)
ax.set_xlim(40,80); ax.set_xlabel("Leverage efficiency, 2026 (0 = worst possible assignment of its relievers, 100 = best)")
ax.grid(axis="x",color=GRID,lw=0.8); ax.set_axisbelow(True)
for s in ["top","right","left"]: ax.spines[s].set_visible(False)
ax.tick_params(axis="y",length=0)
fig.tight_layout(); fig.savefig(out+"team-efficiency-2026.png"); plt.close(fig)
print("ok")
