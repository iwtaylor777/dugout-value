import numpy as np
from data import seasons, league
from score import score
def marcel_bat(T):
    D=seasons('bat'); L=league('bat'); out={}
    for pid,h in D.items():
        num=den=0
        for w,y in ((5,T-1),(4,T-2),(3,T-3)):
            r=h.get(y)
            if r and r['PA']: num+=w*r['PA']*(r['wOBA']-L[y]['wOBA']); den+=w*r['PA']
        if den==0: continue
        rel=num/(den+1200*4)  # regress toward league (Marcel: 1200 PA at weight ~4)
        age=(h.get(T-1) or h.get(T-2) or h.get(T-3))['Age']; age=(age or 28)+1
        rel+= (29-age)*0.0015 if age<29 else (29-age)*0.0008
        out[pid]=L[T-1]['wOBA']+rel
    return out
def marcel_pit(T):
    D=seasons('pit'); L=league('pit'); out={}
    for pid,h in D.items():
        num=den=0
        for w,y in ((3,T-1),(2,T-2),(1,T-3)):
            r=h.get(y)
            if r and r['IP']: num+=w*r['IP']*(r['FIP']-L[y]['FIP']); den+=w*r['IP']
        if den==0: continue
        out[pid]=L[T-1]['FIP']+num/(den+134*3)
    return out
if __name__=='__main__':
    for T in (2023,2024):
        print(T,'bat wOBA',score('bat',T,marcel_bat(T),'wOBA'))
        print(T,'pit FIP',score('pit',T,marcel_pit(T),'FIP'))
