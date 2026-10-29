import sys, os, glob, time
sys.path.insert(0, '/home/claude/war/src')
import split, season
years = [int(a) for a in sys.argv[1:]]
for y in years:
    while not glob.glob(f'/home/claude/war/sc/{y}/{y}-10-06.parquet*'):
        time.sleep(60)
    time.sleep(30)
    season.compute_full(y)
    split.compute(y)
print('DRIVER DONE', flush=True)
