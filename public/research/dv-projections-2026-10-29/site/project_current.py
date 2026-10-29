"""Generate local horizon forecasts plus the history inputs for the current site build."""
import argparse, json
from pathlib import Path
import runtime
runtime.configure()
import dvp_site, dvp
from data import seasons
from threadpoolctl import threadpool_limits
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args(); args.output.mkdir(parents=True,exist_ok=True)
dvp.P['n_jobs']=2; threadpool_limits(limits=2)
out={}; established={}; workloads={}
for kind,key,minimum in [('bat','PA',100),('pit','IP',20)]:
    D=seasons(kind); established[kind]=[]; workloads[kind]={}
    for pid,h in D.items():
        values=sorted([float(h[y].get(key) or 0) for y in (2024,2025,2026) if y in h],reverse=True)
        if sum(values)>=minimum: established[kind].append(pid)
        workloads[kind][pid]=values
    for horizon in range(1,6):
        year=2026+horizon
        out[f'{kind}_{year}']=dvp_site.fit(kind,year,horizon,'v3' if kind=='bat' else 'v1')
        print(kind,year,len(out[f'{kind}_{year}']),flush=True)
for name,content in [('dvp_2027_2031_v3.json',out),('established_2024_26.json',established),('workloads_2024_26.json',workloads)]:
    (args.output/name).write_text(json.dumps(content))
